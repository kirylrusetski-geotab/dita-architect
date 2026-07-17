import { $getRoot } from 'lexical';
import { TableCellHeaderStates } from '@lexical/table';
import type { NodeOriginMapType } from './nodeOriginMap';

interface XmlMeta {
  rootTag: string;
  bodyTag: string;
  doctype: string;   // extracted verbatim from raw XML via regex
  xmlDecl: string;   // extracted verbatim (<?xml ...?>)
  doc: Document;     // the parsed original DOM (for cloning)
}

// Per-instance cache for parsed XML metadata, owned by each SyncManager.
export interface XmlMetaCache {
  source: string;
  meta: XmlMeta | null;
}

export const createXmlMetaCache = (): XmlMetaCache => ({ source: '', meta: null });

const RECOGNIZED_BODY_TAGS = new Set([
  'p', 'note', 'section', 'steps', 'ol', 'ul', 'prereq', 'context', 'result', 'postreq', 'table', 'simpletable', 'codeblock', 'dl',
]);

const getXmlMeta = (originalXml: string, cache: XmlMetaCache): XmlMeta => {
  if (originalXml === cache.source && cache.meta) {
    return cache.meta;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(originalXml, 'text/xml');
  const rootElement = doc.documentElement;

  let rootTag = 'task';
  let bodyTag = 'taskbody';
  let doctype = '<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">';

  if (rootElement && rootElement.tagName !== 'html') {
    rootTag = rootElement.tagName.toLowerCase();

    if (rootTag === 'concept') {
      bodyTag = 'conbody';
      doctype = '<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">';
    } else if (rootTag === 'reference') {
      bodyTag = 'refbody';
      doctype = '<!DOCTYPE reference PUBLIC "-//OASIS//DTD DITA Reference//EN" "reference.dtd">';
    } else if (rootTag === 'topic') {
      bodyTag = 'body';
      doctype = '<!DOCTYPE topic PUBLIC "-//OASIS//DTD DITA Topic//EN" "topic.dtd">';
    }
  }

  // Extract xmlDecl and doctype verbatim from raw XML
  const xmlDeclMatch = originalXml.match(/^<\?xml[^?]*\?>/);
  const xmlDecl = xmlDeclMatch ? xmlDeclMatch[0] : '<?xml version="1.0" encoding="UTF-8"?>';

  // Match DOCTYPE including optional internal subset [...]
  const doctypeMatch = originalXml.match(/<!DOCTYPE\s[^[>]*(?:\[[^\]]*\]\s*)?\s*>/);
  if (doctypeMatch) {
    doctype = doctypeMatch[0];
  }

  cache.meta = { rootTag, bodyTag, doctype, xmlDecl, doc };
  cache.source = originalXml;
  return cache.meta;
};

/**
 * Serialize inline content from a Lexical node into child nodes for a DOM element.
 * If originMap is provided, TextNodes parsed from DITA inline elements (e.g.
 * <uicontrol>, <wintitle>) are re-emitted as their original DITA tag instead of
 * the generic <b>/<i> fallback inferred from format flags.
 */
const serializeInlineContent = (lexicalNode: any, doc: Document, originMap?: NodeOriginMapType): Node[] => {
  const nodes: Node[] = [];
  if (!lexicalNode.getChildren) return nodes;

  lexicalNode.getChildren().forEach((child: any) => {
    if (child.getType() === 'tracked-deletion') return;
    // Read-only <info> preview (P2-26 Phase 2): visual-only, never serialized.
    // The original <info> DOM is left byte-stable by the patch path.
    if (child.getType() === 'dita-info-preview') return;
    if (child.getType() === 'text') {
      const text = child.getTextContent();
      const isBold = child.hasFormat('bold');
      const isItalic = child.hasFormat('italic');
      const isCode = child.hasFormat('code');

      const origin = originMap?.get(child.getKey());
      if (origin?.inlineTag) {
        const el = doc.createElement(origin.inlineTag);
        if (origin.inlineAttrs) {
          Object.entries(origin.inlineAttrs).forEach(([k, v]) => el.setAttribute(k, v));
        }
        el.appendChild(doc.createTextNode(text));
        nodes.push(el);
        return;
      }

      if (isCode) {
        const codeph = doc.createElement('codeph');
        codeph.appendChild(doc.createTextNode(text));
        nodes.push(codeph);
      } else if (isBold && isItalic) {
        const b = doc.createElement('b');
        const i = doc.createElement('i');
        i.appendChild(doc.createTextNode(text));
        b.appendChild(i);
        nodes.push(b);
      } else if (isBold) {
        const b = doc.createElement('b');
        b.appendChild(doc.createTextNode(text));
        nodes.push(b);
      } else if (isItalic) {
        const i = doc.createElement('i');
        i.appendChild(doc.createTextNode(text));
        nodes.push(i);
      } else {
        nodes.push(doc.createTextNode(text));
      }
    } else if (child.getType() === 'link') {
      const xref = doc.createElement('xref');
      xref.setAttribute('href', child.getURL());
      xref.setAttribute('format', 'html');
      const linkChildren = serializeInlineContent(child, doc, originMap);
      linkChildren.forEach(n => xref.appendChild(n));
      nodes.push(xref);
    } else if (child.getType() === 'ditaphref') {
      if (child.getRefType() === 'info-chip') {
        // Visual-only affordance chip — not serialized to XML
      } else if (child.getRefType() === 'image') {
        const img = doc.createElement('image');
        img.setAttribute('href', child.getRefValue());
        const altText = child.getTextContent();
        if (altText) {
          const alt = doc.createElement('alt');
          alt.appendChild(doc.createTextNode(altText));
          img.appendChild(alt);
        }
        nodes.push(img);
      } else {
        const ph = doc.createElement('ph');
        ph.setAttribute(child.getRefType(), child.getRefValue());
        const origText = child.getTextContent();
        if (origText) ph.appendChild(doc.createTextNode(origText));
        nodes.push(ph);
      }
    } else {
      nodes.push(doc.createTextNode(child.getTextContent()));
    }
  });

  return nodes;
};

/**
 * Replace all children of a DOM element with inline content from a Lexical node.
 * Preserves any processing instructions (e.g. Heretto review markers).
 */
const replaceElementContent = (domEl: Element, lexicalNode: any, doc: Document, originMap?: NodeOriginMapType) => {
  // Save processing instructions before clearing
  const pis: Node[] = Array.from(domEl.childNodes).filter(
    child => child.nodeType === Node.PROCESSING_INSTRUCTION_NODE
  );
  while (domEl.firstChild) domEl.removeChild(domEl.firstChild);
  serializeInlineContent(lexicalNode, doc, originMap).forEach(n => domEl.appendChild(n));
  // Re-append preserved processing instructions
  pis.forEach(pi => domEl.appendChild(pi));
};

/**
 * Get normalized text content of an element for comparison with Lexical text.
 * Excludes PI-adjacent whitespace and normalizes formatting whitespace
 * (collapses newline-containing runs to a single space, trims edges).
 */
const getNormalizedDomText = (el: Element): string => {
  let text = '';
  const childNodes = Array.from(el.childNodes);
  childNodes.forEach((child, index) => {
    if (child.nodeType === Node.PROCESSING_INSTRUCTION_NODE) return;
    if (child.nodeType === Node.TEXT_NODE) {
      const t = child.textContent || '';
      if (/^\s+$/.test(t)) {
        const prev = index > 0 ? childNodes[index - 1] : null;
        const next = index < childNodes.length - 1 ? childNodes[index + 1] : null;
        if (
          (prev && prev.nodeType === Node.PROCESSING_INSTRUCTION_NODE) ||
          (next && next.nodeType === Node.PROCESSING_INSTRUCTION_NODE)
        ) {
          return;
        }
      }
      text += t;
    } else {
      text += child.textContent || '';
    }
  });
  return text.replace(/[ \t]*\n[ \t\n]*/g, ' ').trim();
};

/**
 * Collect DOM child nodes excluding PIs and PI-adjacent whitespace-only text nodes.
 */
const getDomSegments = (domEl: Element): Node[] => {
  const segments: Node[] = [];
  const childNodes = Array.from(domEl.childNodes);
  childNodes.forEach((child, index) => {
    if (child.nodeType === Node.PROCESSING_INSTRUCTION_NODE) return;
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent || '';
      if (/^\s+$/.test(text)) {
        const prev = index > 0 ? childNodes[index - 1] : null;
        const next = index < childNodes.length - 1 ? childNodes[index + 1] : null;
        if (
          (prev && prev.nodeType === Node.PROCESSING_INSTRUCTION_NODE) ||
          (next && next.nodeType === Node.PROCESSING_INSTRUCTION_NODE)
        ) {
          return;
        }
      }
      segments.push(child);
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      segments.push(child);
    }
  });
  return segments;
};

/**
 * Try to surgically update text within DOM nodes while preserving inline element
 * wrappers (e.g. <uicontrol>, <wintitle>). Diffs old and new text to locate
 * the change, maps it to a specific DOM segment, and updates only that segment.
 * Returns true if successful, false if a full replacement is needed.
 */
const patchInlineNodes = (domEl: Element, lexicalNode: any): boolean => {
  const domSegments = getDomSegments(domEl);
  if (domSegments.length === 0) return false;

  // Build position map with normalized texts (matching parser whitespace handling)
  const segments: { node: Node; normText: string; start: number; end: number }[] = [];
  for (let i = 0; i < domSegments.length; i++) {
    const node = domSegments[i];
    const normText = (node.textContent || '').replace(/[ \t]*\n[ \t\n]*/g, ' ');
    segments.push({ node, normText, start: 0, end: 0 });
  }
  // Trim leading whitespace on first text segment
  if (segments.length > 0 && segments[0].node.nodeType === Node.TEXT_NODE) {
    segments[0].normText = segments[0].normText.trimStart();
  }
  // Trim trailing whitespace on last text segment
  if (segments.length > 0 && segments[segments.length - 1].node.nodeType === Node.TEXT_NODE) {
    segments[segments.length - 1].normText = segments[segments.length - 1].normText.trimEnd();
  }
  // Remove empty segments and recalculate positions
  const nonEmpty = segments.filter(s => s.normText.length > 0);
  let pos = 0;
  for (const seg of nonEmpty) {
    seg.start = pos;
    seg.end = pos + seg.normText.length;
    pos += seg.normText.length;
  }
  if (nonEmpty.length === 0) return false;

  const oldText = nonEmpty.map(s => s.normText).join('');
  const newText = lexicalNode.getTextContent();
  if (oldText === newText) return true;

  // Find common prefix and suffix to isolate the change region
  let prefixLen = 0;
  while (prefixLen < oldText.length && prefixLen < newText.length && oldText[prefixLen] === newText[prefixLen]) {
    prefixLen++;
  }

  let suffixLen = 0;
  while (
    suffixLen < oldText.length - prefixLen &&
    suffixLen < newText.length - prefixLen &&
    oldText[oldText.length - 1 - suffixLen] === newText[newText.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  const changeStart = prefixLen;
  const changeEndOld = oldText.length - suffixLen;

  // Find which segment contains the start of the change
  let startSegIdx = nonEmpty.length - 1;
  for (let i = 0; i < nonEmpty.length; i++) {
    if (changeStart < nonEmpty[i].end) {
      startSegIdx = i;
      break;
    }
  }

  // Find which segment contains the end of the change
  let endSegIdx = nonEmpty.length - 1;
  for (let i = startSegIdx; i < nonEmpty.length; i++) {
    if (changeEndOld <= nonEmpty[i].end) {
      endSegIdx = i;
      break;
    }
  }

  // If change spans multiple segments (crosses an element boundary), fall back
  if (startSegIdx !== endSegIdx) return false;

  // Apply the change to the specific segment using normalized text
  const seg = nonEmpty[startSegIdx];
  const localStart = changeStart - seg.start;
  const localEndOld = changeEndOld - seg.start;
  const replacement = newText.substring(changeStart, newText.length - suffixLen);
  const newSegText = seg.normText.substring(0, localStart) + replacement + seg.normText.substring(localEndOld);

  if (seg.node.nodeType === Node.TEXT_NODE) {
    seg.node.textContent = newSegText;
  } else if (seg.node.nodeType === Node.ELEMENT_NODE) {
    const el = seg.node as Element;
    const hasOnlyText = Array.from(el.childNodes).every(c => c.nodeType === Node.TEXT_NODE);
    if (!hasOnlyText) return false;
    el.textContent = newSegText;
  }

  return true;
};

/**
 * Compare text content and update only if changed. Returns true if element was left untouched.
 * Uses PI-aware text extraction so review markers don't cause false mismatches.
 * Attempts surgical inline update to preserve element wrappers before falling back
 * to full replacement.
 */
const BLOCKISH_CHILD_TAGS = new Set([
  'p', 'ul', 'ol', 'codeblock', 'table', 'simpletable', 'fig', 'dl', 'section',
]);

const patchElementContent = (domEl: Element, lexicalNode: any, doc: Document, originMap?: NodeOriginMapType): boolean => {
  const domText = getNormalizedDomText(domEl);
  const lexText = lexicalNode.getTextContent();

  // Link-structure check counts xrefs at ANY depth: the parser flattens
  // <note><p>…<xref/></p></note> so the LinkNode is a direct Lexical child
  // while the <xref> sits inside the <p> — counting only direct DOM children
  // reported a false mismatch and destroyed unedited notes (BUG-04/S3).
  const lexLinkCount = lexicalNode.getChildren
    ? lexicalNode.getChildren().filter((c: any) => c.getType() === 'link').length
    : 0;
  const domXrefCount = domEl.querySelectorAll('xref').length;

  if (domText === lexText) {
    if (lexLinkCount === domXrefCount) {
      return true; // untouched — all inline markup preserved
    }
    // Link structure changed — force full replacement
    replaceElementContent(domEl, lexicalNode, doc, originMap);
    return false;
  }

  // Elements with block children (e.g. <note><p>…</p><p>…</p></note>) are
  // flattened by the parser with per-block edge trimming, which DELETES the
  // whitespace between blocks — the Lexical text is whitespace-lossy BY
  // DESIGN, so exact inequality does not mean the user edited anything.
  // Compare with all whitespace removed before concluding a real change;
  // preserving the element wins over honoring a whitespace-only "edit" the
  // flatten may have fabricated (ADR-006).
  const hasBlockChildren = Array.from(domEl.children).some(
    c => BLOCKISH_CHILD_TAGS.has(c.tagName.toLowerCase())
  );
  if (hasBlockChildren) {
    const stripWs = (s: string) => s.replace(/\s+/g, '');
    if (stripWs(domText) === stripWs(lexText) && lexLinkCount === domXrefCount) {
      return true; // untouched modulo flatten whitespace loss
    }
  }

  if (!patchInlineNodes(domEl, lexicalNode)) {
    replaceElementContent(domEl, lexicalNode, doc, originMap);
  }
  return false;
};

/**
 * Create a new DOM element from a Lexical node.
 */
const createElementFromLexical = (lexicalNode: any, doc: Document, rootTag: string, originMap: NodeOriginMapType): Element | null => {
  const type = lexicalNode.getType();
  const origin = originMap.get(lexicalNode.getKey());

  if (type === 'paragraph') {
    if (origin?.tag === 'prereq' || origin?.tag === 'context' || origin?.tag === 'result' || origin?.tag === 'postreq') {
      const el = doc.createElement(origin.tag);
      serializeInlineContent(lexicalNode, doc, originMap).forEach(n => el.appendChild(n));
      return el;
    }
    const el = doc.createElement('p');
    serializeInlineContent(lexicalNode, doc, originMap).forEach(n => el.appendChild(n));
    return el;
  }

  if (type === 'quote') {
    const el = doc.createElement('note');
    serializeInlineContent(lexicalNode, doc, originMap).forEach(n => el.appendChild(n));
    return el;
  }

  if (type === 'list') {
    const isOrdered = lexicalNode.getListType() === 'number';
    const tag = isOrdered ? (rootTag === 'task' ? 'steps' : 'ol') : 'ul';
    const childTag = tag === 'steps' ? 'step' : 'li';
    const el = doc.createElement(tag);

    lexicalNode.getChildren().forEach((li: any) => {
      const liEl = doc.createElement(childTag);
      if (tag === 'steps') {
        const cmd = doc.createElement('cmd');
        serializeInlineContent(li, doc, originMap).forEach(n => cmd.appendChild(n));
        liEl.appendChild(cmd);
      } else {
        serializeInlineContent(li, doc, originMap).forEach(n => liEl.appendChild(n));
      }
      el.appendChild(liEl);
    });
    return el;
  }

  if (type === 'table') {
    return createTableFromLexical(lexicalNode, doc, originMap);
  }

  if (type === 'ditacodeblock') {
    const el = doc.createElement('codeblock');
    const lang = lexicalNode.getLanguage();
    if (lang) el.setAttribute('outputclass', lang);
    el.appendChild(doc.createTextNode(lexicalNode.getCode()));
    return el;
  }

  return null;
};

/**
 * Create a CALS table element from a Lexical TableNode.
 */
const createTableFromLexical = (tableNode: any, doc: Document, originMap?: NodeOriginMapType): Element => {
  const table = doc.createElement('table');
  const rows = tableNode.getChildren ? tableNode.getChildren() : [];
  const headerRows: any[] = [];
  const bodyRows: any[] = [];

  rows.forEach((row: any) => {
    const cells = row.getChildren ? row.getChildren() : [];
    const isHeader = cells.length > 0 && cells[0].getHeaderStyles &&
      (cells[0].getHeaderStyles() & TableCellHeaderStates.ROW) !== 0;
    if (isHeader) headerRows.push(row); else bodyRows.push(row);
  });

  const firstRow = rows[0];
  // Calculate column count by considering colspan values
  let colCount = 1;
  if (firstRow && firstRow.getChildren) {
    const cells = firstRow.getChildren();
    colCount = cells.reduce((count: number, cell: any) => {
      const colspan = cell.getColSpan && cell.getColSpan() > 1 ? cell.getColSpan() : 1;
      return count + colspan;
    }, 0);
  }

  const tgroup = doc.createElement('tgroup');
  tgroup.setAttribute('cols', String(colCount));

  // Generate colspec elements
  for (let i = 1; i <= colCount; i++) {
    const colspec = doc.createElement('colspec');
    colspec.setAttribute('colname', `col${i}`);
    colspec.setAttribute('colwidth', '1*');
    tgroup.appendChild(colspec);
  }

  const serializeRow = (row: any, container: Element) => {
    const rowEl = doc.createElement('row');
    const cells = row.getChildren ? row.getChildren() : [];
    let colIndex = 1; // DITA columns are 1-based

    cells.forEach((cell: any) => {
      const entry = doc.createElement('entry');

      // Handle rowspan (morerows)
      if (cell.getRowSpan && cell.getRowSpan() > 1) {
        entry.setAttribute('morerows', String(cell.getRowSpan() - 1));
      }

      // Handle colspan (namest/nameend)
      if (cell.getColSpan && cell.getColSpan() > 1) {
        const colspan = cell.getColSpan();
        const startCol = `col${colIndex}`;
        const endCol = `col${colIndex + colspan - 1}`;
        entry.setAttribute('namest', startCol);
        entry.setAttribute('nameend', endCol);
      }

      const cellChildren = cell.getChildren ? cell.getChildren() : [];
      if (cellChildren.length === 1 && cellChildren[0].getType() === 'paragraph') {
        serializeInlineContent(cellChildren[0], doc, originMap).forEach((n: Node) => entry.appendChild(n));
      } else {
        cellChildren.forEach((child: any) => {
          if (child.getType() === 'paragraph') {
            const p = doc.createElement('p');
            serializeInlineContent(child, doc, originMap).forEach((n: Node) => p.appendChild(n));
            entry.appendChild(p);
          }
        });
      }
      rowEl.appendChild(entry);

      // Advance column index by colspan amount
      const colspan = cell.getColSpan && cell.getColSpan() > 1 ? cell.getColSpan() : 1;
      colIndex += colspan;
    });
    container.appendChild(rowEl);
  };

  if (headerRows.length > 0) {
    const thead = doc.createElement('thead');
    headerRows.forEach(r => serializeRow(r, thead));
    tgroup.appendChild(thead);
  }
  const tbody = doc.createElement('tbody');
  bodyRows.forEach(r => serializeRow(r, tbody));
  tgroup.appendChild(tbody);

  table.appendChild(tgroup);
  return table;
};

/**
 * Patch a <steps> or <ol> or <ul> list element in the DOM with Lexical list items.
 * For <steps>, only update <cmd> text — leave <info>, <substeps>, etc. untouched.
 */
const patchListElement = (domEl: Element, lexicalNode: any, doc: Document, originMap?: NodeOriginMapType) => {
  const tag = domEl.tagName.toLowerCase();
  const isSteps = tag === 'steps';
  const childTag = isSteps ? 'step' : 'li';

  const domItems = Array.from(domEl.children).filter(
    c => c.tagName.toLowerCase() === childTag
  );
  const lexicalItems = lexicalNode.getChildren ? lexicalNode.getChildren() : [];

  const count = Math.min(domItems.length, lexicalItems.length);

  for (let i = 0; i < count; i++) {
    const domItem = domItems[i];
    const lexItem = lexicalItems[i];

    if (isSteps) {
      // Only patch <cmd> inside <step>, leave everything else
      const cmd = domItem.querySelector('cmd');
      if (cmd) {
        patchElementContent(cmd, lexItem, doc, originMap);
      }
    } else {
      patchElementContent(domItem, lexItem, doc, originMap);
    }
  }

  // Extra Lexical items → append new DOM items
  for (let i = count; i < lexicalItems.length; i++) {
    const newItem = doc.createElement(childTag);
    if (isSteps) {
      const cmd = doc.createElement('cmd');
      serializeInlineContent(lexicalItems[i], doc, originMap).forEach(n => cmd.appendChild(n));
      newItem.appendChild(cmd);
    } else {
      serializeInlineContent(lexicalItems[i], doc, originMap).forEach(n => newItem.appendChild(n));
    }
    domEl.appendChild(newItem);
  }

  // Extra DOM items → remove from DOM
  for (let i = count; i < domItems.length; i++) {
    domEl.removeChild(domItems[i]);
  }
};

/**
 * Patch a <dl> element in the DOM against the run of Lexical nodes that the
 * definition list flattened to. Preserves the <dl>/<dlentry>/<dt>/<dd> skeleton
 * (and any unrecognized children) byte-for-byte, patching only the <dt> term
 * paragraph and the <dd> block content — mirroring how patchListElement leaves a
 * <step>'s <info> untouched and patches only <cmd>.
 */
const patchDlElement = (
  domDl: Element,
  lexicalNodes: any[],
  doc: Document,
  rootTag: string,
  originMap: NodeOriginMapType,
) => {
  const domEntries = Array.from(domDl.children).filter(
    c => c.tagName.toLowerCase() === 'dlentry'
  );

  // Partition the flattened nodes into per-<dlentry> buckets by dlEntryIndex.
  const buckets = new Map<number, any[]>();
  for (const node of lexicalNodes) {
    const origin = originMap.get(node.getKey());
    const idx = origin?.dlEntryIndex;
    if (idx === undefined) continue;
    if (!buckets.has(idx)) buckets.set(idx, []);
    buckets.get(idx)!.push(node);
  }

  for (let i = 0; i < domEntries.length; i++) {
    const bucket = buckets.get(i);
    if (!bucket || bucket.length === 0) continue;

    const entry = domEntries[i];
    const domDt = entry.querySelector(':scope > dt');
    const domDd = entry.querySelector(':scope > dd');

    // The <dt> is the bucket node tagged 'dt'; the rest are <dd> content.
    const dtNode = bucket.find(n => originMap.get(n.getKey())?.tag === 'dt');
    const ddNodes = bucket.filter(n => n !== dtNode);

    if (domDt && dtNode) {
      patchElementContent(domDt, dtNode, doc, originMap);
    }
    if (domDd) {
      // Patch the <dd>'s recognized block children in parallel; unrecognized
      // children are left untouched (same contract as the body walk).
      // groupDl:false — every dd node carries dlEntryIndex; re-grouping them
      // here would wrongly hunt for a nested <dl> (ADR-006).
      patchBodyChildren(Array.from(domDd.children), domDd, ddNodes, doc, rootTag, originMap, { groupDl: false });
    }
  }
};

const isHeaderRow = (row: any): boolean => {
  const cells = row.getChildren ? row.getChildren() : [];
  return cells.length > 0 && cells[0].getHeaderStyles &&
    (cells[0].getHeaderStyles() & TableCellHeaderStates.ROW) !== 0;
};

const buildRowEl = (lexRow: any, doc: Document, originMap?: NodeOriginMapType): Element => {
  const rowEl = doc.createElement('row');
  const cells = lexRow.getChildren ? lexRow.getChildren() : [];
  let colIndex = 1;
  cells.forEach((cell: any) => {
    const entry = doc.createElement('entry');
    if (cell.getRowSpan && cell.getRowSpan() > 1) {
      entry.setAttribute('morerows', String(cell.getRowSpan() - 1));
    }
    if (cell.getColSpan && cell.getColSpan() > 1) {
      const colspan = cell.getColSpan();
      entry.setAttribute('namest', `col${colIndex}`);
      entry.setAttribute('nameend', `col${colIndex + colspan - 1}`);
    }
    const cellChildren = cell.getChildren ? cell.getChildren() : [];
    if (cellChildren.length === 1 && cellChildren[0].getType() === 'paragraph') {
      serializeInlineContent(cellChildren[0], doc, originMap).forEach((n: Node) => entry.appendChild(n));
    } else {
      cellChildren.forEach((child: any) => {
        if (child.getType() === 'paragraph') {
          const p = doc.createElement('p');
          serializeInlineContent(child, doc, originMap).forEach((n: Node) => p.appendChild(n));
          entry.appendChild(p);
        }
      });
    }
    rowEl.appendChild(entry);
    const colspan = cell.getColSpan && cell.getColSpan() > 1 ? cell.getColSpan() : 1;
    colIndex += colspan;
  });
  return rowEl;
};

/**
 * Patch a <table> element in the DOM with Lexical table data.
 * Walks rows and entries in parallel, updating only entry text content.
 */
const patchTableElement = (domEl: Element, lexicalNode: any, doc: Document, originMap?: NodeOriginMapType) => {
  const tag = domEl.tagName.toLowerCase();

  if (tag === 'simpletable') {
    patchSimpleTable(domEl, lexicalNode, doc, originMap);
    return;
  }

  // CALS table
  const tgroup = domEl.querySelector('tgroup');
  if (!tgroup) return;

  const lexicalRows = lexicalNode.getChildren ? lexicalNode.getChildren() : [];

  // Recalculate @cols attribute based on actual column count (considering colspan)
  if (lexicalRows.length > 0) {
    const firstRow = lexicalRows[0];
    const firstRowCells = firstRow.getChildren ? firstRow.getChildren() : [];
    let actualColCount = 1;
    if (firstRowCells.length > 0) {
      actualColCount = firstRowCells.reduce((count: number, cell: any) => {
        const colspan = cell.getColSpan && cell.getColSpan() > 1 ? cell.getColSpan() : 1;
        return count + colspan;
      }, 0);
    }
    if (actualColCount > 0) {
      tgroup.setAttribute('cols', String(actualColCount));
    }
  }
  let lexIdx = 0;

  // Patch thead rows (header rows come first in Lexical's flat row list)
  const thead = tgroup.querySelector('thead');
  if (thead) {
    const domRows = Array.from(thead.children).filter(c => c.tagName.toLowerCase() === 'row');
    const count = Math.min(domRows.length, lexicalRows.length - lexIdx);
    for (let i = 0; i < count; i++) {
      patchTableRow(domRows[i], lexicalRows[lexIdx], doc, originMap);
      lexIdx++;
    }
    // Extra DOM header rows → remove
    for (let i = count; i < domRows.length; i++) {
      thead.removeChild(domRows[i]);
    }
    // Extra Lexical header rows → append (rare, but consistent with the contract)
    for (; lexIdx < lexicalRows.length && isHeaderRow(lexicalRows[lexIdx]); lexIdx++) {
      const rowEl = buildRowEl(lexicalRows[lexIdx], doc, originMap);
      thead.appendChild(rowEl);
    }
  }

  // Patch tbody rows
  const tbody = tgroup.querySelector('tbody');
  if (tbody) {
    const domRows = Array.from(tbody.children).filter(c => c.tagName.toLowerCase() === 'row');
    const bodyLexRows = lexicalRows.slice(lexIdx);
    const count = Math.min(domRows.length, bodyLexRows.length);
    for (let i = 0; i < count; i++) {
      patchTableRow(domRows[i], bodyLexRows[i], doc, originMap);
    }
    // Extra Lexical body rows → append new <row> elements
    for (let i = count; i < bodyLexRows.length; i++) {
      tbody.appendChild(buildRowEl(bodyLexRows[i], doc, originMap));
    }
    // Extra DOM body rows → remove
    for (let i = count; i < domRows.length; i++) {
      tbody.removeChild(domRows[i]);
    }
  }
};

const patchTableRow = (domRow: Element, lexicalRow: any, doc: Document, originMap?: NodeOriginMapType) => {
  const domEntries = Array.from(domRow.children).filter(
    c => c.tagName.toLowerCase() === 'entry'
  );
  const lexCells = lexicalRow.getChildren ? lexicalRow.getChildren() : [];
  const count = Math.min(domEntries.length, lexCells.length);

  for (let i = 0; i < count; i++) {
    patchTableEntry(domEntries[i], lexCells[i], doc, originMap);
  }
};

const patchTableEntry = (domEntry: Element, lexicalCell: any, doc: Document, originMap?: NodeOriginMapType) => {
  const cellChildren = lexicalCell.getChildren ? lexicalCell.getChildren() : [];

  // Update colspan attributes if changed
  const lexColSpan = lexicalCell.getColSpan ? lexicalCell.getColSpan() : 1;
  const lexRowSpan = lexicalCell.getRowSpan ? lexicalCell.getRowSpan() : 1;

  // Handle rowspan (morerows)
  if (lexRowSpan > 1) {
    domEntry.setAttribute('morerows', String(lexRowSpan - 1));
  } else {
    domEntry.removeAttribute('morerows');
  }

  // Handle colspan (namest/nameend) - preserve existing column naming if present
  if (lexColSpan > 1) {
    const existingNamest = domEntry.getAttribute('namest');
    if (existingNamest) {
      // Extract column number from existing namest (e.g., "col3" -> 3)
      const colNumMatch = existingNamest.match(/col(\d+)/);
      if (colNumMatch) {
        const startCol = parseInt(colNumMatch[1], 10);
        const endCol = startCol + lexColSpan - 1;
        domEntry.setAttribute('namest', `col${startCol}`);
        domEntry.setAttribute('nameend', `col${endCol}`);
      }
    }
    // Note: If no existing namest, we can't determine column position during patching
    // This would only happen with new merged cells, which would go through createTableFromLexical
  } else {
    domEntry.removeAttribute('namest');
    domEntry.removeAttribute('nameend');
  }

  // Check if entry has <p> children in DOM
  const domParagraphs = Array.from(domEntry.children).filter(
    c => c.tagName.toLowerCase() === 'p'
  );

  if (domParagraphs.length > 0 && cellChildren.length > 0) {
    // Patch paragraphs in parallel
    const count = Math.min(domParagraphs.length, cellChildren.length);
    for (let i = 0; i < count; i++) {
      if (cellChildren[i].getType() === 'paragraph') {
        patchElementContent(domParagraphs[i], cellChildren[i], doc, originMap);
      }
    }
  } else {
    // Entry with direct text content — compare and patch as a unit
    const domText = domEntry.textContent || '';
    const lexText = lexicalCell.getTextContent();
    if (domText !== lexText) {
      while (domEntry.firstChild) domEntry.removeChild(domEntry.firstChild);
      if (cellChildren.length === 1 && cellChildren[0].getType() === 'paragraph') {
        serializeInlineContent(cellChildren[0], doc, originMap).forEach(n => domEntry.appendChild(n));
      } else {
        cellChildren.forEach((child: any) => {
          if (child.getType() === 'paragraph') {
            const p = doc.createElement('p');
            serializeInlineContent(child, doc, originMap).forEach(n => p.appendChild(n));
            domEntry.appendChild(p);
          }
        });
      }
    }
  }
};

const patchSimpleTable = (domEl: Element, lexicalNode: any, doc: Document, originMap?: NodeOriginMapType) => {
  const domRows = Array.from(domEl.children).filter(
    c => c.tagName.toLowerCase() === 'sthead' || c.tagName.toLowerCase() === 'strow'
  );
  const lexicalRows = lexicalNode.getChildren ? lexicalNode.getChildren() : [];
  const count = Math.min(domRows.length, lexicalRows.length);

  for (let i = 0; i < count; i++) {
    const domEntries = Array.from(domRows[i].children).filter(
      c => c.tagName.toLowerCase() === 'stentry'
    );
    const lexCells = lexicalRows[i].getChildren ? lexicalRows[i].getChildren() : [];
    const entryCount = Math.min(domEntries.length, lexCells.length);

    for (let j = 0; j < entryCount; j++) {
      patchTableEntry(domEntries[j], lexCells[j], doc, originMap);
    }
  }

  // Extra Lexical rows → append new <strow> elements
  for (let i = count; i < lexicalRows.length; i++) {
    const strow = doc.createElement('strow');
    const lexCells = lexicalRows[i].getChildren ? lexicalRows[i].getChildren() : [];
    lexCells.forEach((cell: any) => {
      const stentry = doc.createElement('stentry');
      const cellChildren = cell.getChildren ? cell.getChildren() : [];
      if (cellChildren.length === 1 && cellChildren[0].getType() === 'paragraph') {
        serializeInlineContent(cellChildren[0], doc, originMap).forEach((n: Node) => stentry.appendChild(n));
      } else {
        stentry.appendChild(doc.createTextNode(cell.getTextContent()));
      }
      strow.appendChild(stentry);
    });
    domEl.appendChild(strow);
  }

  // Extra DOM rows → remove
  for (let i = count; i < domRows.length; i++) {
    domEl.removeChild(domRows[i]);
  }
};

/**
 * Patch a <section> in the DOM against the Lexical nodes that belong to it.
 * sectionLexicalNodes = the heading (h2) + all body-level Lexical nodes until the next h2.
 */
const patchSection = (
  sectionEl: Element,
  sectionLexicalNodes: any[],
  doc: Document,
  rootTag: string,
  originMap: NodeOriginMapType,
) => {
  // Separate section title from section body nodes in Lexical
  let lexicalBodyNodes: any[] = sectionLexicalNodes;
  const firstNode = sectionLexicalNodes[0];
  if (firstNode && firstNode.getType() === 'heading' && firstNode.getTag() === 'h2') {
    // Patch section title
    const sectionTitle = sectionEl.querySelector(':scope > title');
    if (sectionTitle) {
      patchElementContent(sectionTitle, firstNode, doc, originMap);
    }
    lexicalBodyNodes = sectionLexicalNodes.slice(1);
  }

  // Now walk recognized children of the section (excluding title)
  const sectionChildren = Array.from(sectionEl.children).filter(
    c => c.tagName.toLowerCase() !== 'title'
  );

  patchBodyChildren(sectionChildren, sectionEl, lexicalBodyNodes, doc, rootTag, originMap);
};

/**
 * THE body walk (ADR-006): walk DOM children and grouped Lexical nodes in
 * parallel, patching recognized elements. Used at body level, inside sections,
 * and inside <dd> — the former top-level walk is gone.
 *
 * Capabilities, unified from both former walks:
 *  - dl-run and section grouping (via groupBodyNodesForSections), including
 *    the Heretto non-standard <p><dl>…</dl></p> wrapper;
 *  - look-ahead on mismatch, so a deleted element does not shift content onto
 *    a wrong-identity sibling (M9);
 *  - the non-recreatable node contract: a DOM element is NEVER removed in
 *    favor of a Lexical node that createElementFromLexical cannot express
 *    (returns null) — the element is preserved in place instead (S1).
 *
 * Unrecognized DOM children are always left untouched.
 * options.groupDl=false disables dl-run grouping — required when patching
 * <dd> content, where every node carries dlEntryIndex by construction.
 */
const patchBodyChildren = (
  domChildren: Element[],
  parentEl: Element,
  lexicalNodes: any[],
  doc: Document,
  rootTag: string,
  originMap: NodeOriginMapType,
  options?: { groupDl?: boolean },
) => {
  const groupDl = options?.groupDl !== false;
  const groups = groupBodyNodesForSections(lexicalNodes, originMap, groupDl);

  const recognizedDomChildren = domChildren.filter(
    c => RECOGNIZED_BODY_TAGS.has(c.tagName.toLowerCase())
  );

  const consumed = new Set<Element>();
  let gIdx = 0;

  for (let domIdx = 0; domIdx < recognizedDomChildren.length && gIdx < groups.length; domIdx++) {
    const domChild = recognizedDomChildren[domIdx];
    if (domChild.parentNode !== parentEl) continue; // already removed by look-ahead
    const domTag = domChild.tagName.toLowerCase();
    const group = groups[gIdx];

    if (group.type === 'dl') {
      // A definition list. The source may author it bare (<dl>) or, as in
      // Heretto, wrapped in a non-standard <p><dl>…</dl></p>. In the wrapped
      // case patch the inner <dl> and leave the <p> wrapper byte-for-byte.
      const innerDl =
        domTag === 'dl'
          ? domChild
          : domTag === 'p'
            ? domChild.querySelector(':scope > dl')
            : null;
      if (innerDl) {
        patchDlElement(innerDl, group.nodes, doc, rootTag, originMap);
        consumed.add(domChild);
      } else {
        const newEl = createDlFromLexical(group.nodes, doc, rootTag, originMap);
        parentEl.insertBefore(newEl, domChild);
        parentEl.removeChild(domChild);
      }
      gIdx++;
    } else if (group.type === 'section') {
      if (domTag === 'section') {
        patchSection(domChild, group.nodes, doc, rootTag, originMap);
        consumed.add(domChild);
      } else {
        const sectionEl = createSectionFromLexical(group.nodes, doc, rootTag, originMap);
        parentEl.insertBefore(sectionEl, domChild);
        parentEl.removeChild(domChild);
      }
      gIdx++;
    } else {
      // Single node group
      const lexNode = group.nodes[0];
      const lexType = lexNode.getType();
      const lexOrigin = originMap.get(lexNode.getKey());

      // Identity-aware deletion detection (M9): when both sides carry ids and
      // they disagree, but a LATER recognized sibling has the Lexical node's
      // id, the current DOM element was deleted in Lexical — remove it and
      // retry this group, instead of patching foreign content into an element
      // whose id other topics may conref/xref.
      const lexXmlId = lexOrigin?.xmlId;
      const domId = domChild.getAttribute('id');
      if (
        lexXmlId && domId && domId !== lexXmlId &&
        recognizedDomChildren.some(
          (c, j) => j > domIdx && c.parentNode === parentEl && c.getAttribute('id') === lexXmlId
        )
      ) {
        parentEl.removeChild(domChild);
        continue; // group retries against a later DOM child
      }

      if (domTag !== 'section' && areTypesCompatible(domTag, lexType, lexOrigin, rootTag)) {
        patchRecognizedElement(domChild, lexNode, doc, rootTag, originMap);
        consumed.add(domChild);
        gIdx++;
      } else {
        // Mismatch — look ahead: does the NEXT recognized DOM child match this
        // node? If so the current element was deleted in Lexical; remove it and
        // retry this group against the next DOM child.
        const nextDomChild = domIdx + 1 < recognizedDomChildren.length ? recognizedDomChildren[domIdx + 1] : null;
        const nextDomTag = nextDomChild ? nextDomChild.tagName.toLowerCase() : null;
        const nextMatches =
          nextDomTag !== null &&
          nextDomTag !== 'section' &&
          areTypesCompatible(nextDomTag, lexType, lexOrigin, rootTag);

        if (nextMatches) {
          parentEl.removeChild(domChild);
          // do not advance gIdx — the group retries against nextDomChild
        } else {
          const newEl = createElementFromLexical(lexNode, doc, rootTag, originMap);
          if (newEl) {
            parentEl.insertBefore(newEl, domChild);
            parentEl.removeChild(domChild);
          } else {
            // Non-recreatable node contract (ADR-006/S1): the Lexical node has
            // no serializable form of its own — the DOM element it was parsed
            // from is its representation. Preserve it; never delete.
            consumed.add(domChild);
          }
          gIdx++;
        }
      }
    }
  }

  // Remove recognized DOM children not consumed by the walk (deletions, or a
  // stale master with more elements than Lexical — e.g. PUT replacing 3
  // paragraphs with 1 note must not leave the 2 old paragraphs behind).
  for (const child of recognizedDomChildren) {
    if (!consumed.has(child) && child.parentNode === parentEl) {
      parentEl.removeChild(child);
    }
  }

  // Append remaining Lexical groups as new DOM elements
  for (let i = gIdx; i < groups.length; i++) {
    const group = groups[i];
    if (group.type === 'section') {
      parentEl.appendChild(createSectionFromLexical(group.nodes, doc, rootTag, originMap));
    } else if (group.type === 'dl') {
      parentEl.appendChild(createDlFromLexical(group.nodes, doc, rootTag, originMap));
    } else {
      const newEl = createElementFromLexical(group.nodes[0], doc, rootTag, originMap);
      if (newEl) parentEl.appendChild(newEl);
    }
  }
};

/**
 * Check if a DOM tag is compatible with a Lexical node type.
 */
const areTypesCompatible = (
  domTag: string,
  lexType: string,
  lexOrigin: { tag: string; bodyIndex: number } | undefined,
  _rootTag: string,
): boolean => {
  const taskBodyTags = ['prereq', 'context', 'result', 'postreq'];
  if (domTag === 'p' && lexType === 'paragraph' && !taskBodyTags.includes(lexOrigin?.tag ?? '')) return true;
  if (taskBodyTags.includes(domTag) && lexType === 'paragraph' && lexOrigin?.tag === domTag) return true;
  if (domTag === 'note' && lexType === 'quote') return true;
  // A ref-carrying <note conkeyref/keyref/conref> parses to a DitaPhRefNode.
  // The pairing is "compatible" so the walk consumes both together — the DOM
  // element is preserved as-is (non-recreatable node contract, ADR-006/S1).
  if (domTag === 'note' && lexType === 'ditaphref') return true;
  if (domTag === 'steps' && lexType === 'list') return true;
  if (domTag === 'ol' && lexType === 'list') return true;
  if (domTag === 'ul' && lexType === 'list') return true;
  if (domTag === 'table' && lexType === 'table') return true;
  if (domTag === 'simpletable' && lexType === 'table') return true;
  if (domTag === 'section' && lexType === 'heading') return true;
  if (domTag === 'codeblock' && lexType === 'ditacodeblock') return true;
  return false;
};

/**
 * Patch a single recognized DOM element with its matching Lexical node.
 */
const patchRecognizedElement = (domEl: Element, lexicalNode: any, doc: Document, rootTag: string, originMap?: NodeOriginMapType) => {
  const tag = domEl.tagName.toLowerCase();

  if (tag === 'p' || tag === 'prereq' || tag === 'context' || tag === 'result' || tag === 'postreq') {
    patchElementContent(domEl, lexicalNode, doc, originMap);
  } else if (tag === 'note') {
    // Ref-carrying note ↔ DitaPhRefNode: the ref IS the content — the DOM
    // element stays byte-stable, never patched from the chip's display text.
    if (lexicalNode.getType() === 'ditaphref') return;
    patchElementContent(domEl, lexicalNode, doc, originMap);
  } else if (tag === 'steps' || tag === 'ol' || tag === 'ul') {
    patchListElement(domEl, lexicalNode, doc, originMap);
  } else if (tag === 'table' || tag === 'simpletable') {
    patchTableElement(domEl, lexicalNode, doc, originMap);
  } else if (tag === 'codeblock') {
    const newCode = lexicalNode.getCode();
    if ((domEl.textContent || '') !== newCode) {
      while (domEl.firstChild) domEl.removeChild(domEl.firstChild);
      domEl.appendChild(doc.createTextNode(newCode));
    }
    const lang = lexicalNode.getLanguage();
    if (lang) {
      domEl.setAttribute('outputclass', lang);
    }
  } else if (tag === 'section') {
    // Collect the section's Lexical nodes: the h2 heading + following nodes until next h2
    // The lexicalNode here is the h2. We need to collect following siblings.
    // But since we're called from patchBodyChildren which handles one node at a time,
    // we handle section differently — see the main serializer logic.
    patchSectionFromHeading(domEl, lexicalNode, doc, rootTag, originMap);
  }
};

/**
 * When we encounter a <section> in the DOM matched to an h2 heading in Lexical,
 * we need to collect the h2 + following Lexical nodes that belong to this section.
 * This is handled specially in the main walk — this function just patches the title.
 */
const patchSectionFromHeading = (sectionEl: Element, headingNode: any, doc: Document, _rootTag: string, originMap?: NodeOriginMapType) => {
  const sectionTitle = sectionEl.querySelector(':scope > title');
  if (sectionTitle) {
    patchElementContent(sectionTitle, headingNode, doc, originMap);
  }
};

/**
 * Strip xmlns="" attributes that XMLSerializer adds spuriously.
 */
const stripSpuriousXmlns = (xml: string): string => {
  return xml
    .replace(/ xmlns=""/g, '')
    .replace(/ xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, '');
};

export const serializeLexicalToXml = (editorState: any, originalXml: string, originMap: NodeOriginMapType, cache: XmlMetaCache): string => {
  const meta = getXmlMeta(originalXml, cache);
  const { rootTag, bodyTag, doctype, xmlDecl, doc: originalDoc } = meta;

  // Clone the original DOM
  const clonedDoc = originalDoc.cloneNode(true) as Document;
  const rootEl = clonedDoc.documentElement;

  if (!rootEl || rootEl.tagName === 'html') {
    // Parse error fallback — return original
    return originalXml;
  }

  editorState.read(() => {
    const root = $getRoot();
    const children = root.getChildren();

    // Separate Lexical children into: title (h1), shortdesc, and body nodes
    let titleNode: any = null;
    let shortdescNode: any = null;
    const bodyNodes: any[] = [];

    children.forEach((node: any) => {
      const type = node.getType();
      const origin = originMap.get(node.getKey());

      if (type === 'heading' && node.getTag() === 'h1' && !titleNode) {
        titleNode = node;
      } else if (type === 'paragraph' && origin?.tag === 'shortdesc') {
        shortdescNode = node;
      } else if (type === 'ditaopaque' || type === 'ditaimage') {
        // Opaque/image nodes represent elements preserved in the original DOM — skip
      } else {
        bodyNodes.push(node);
      }
    });

    // 1. Patch <title>
    const titleEl = rootEl.querySelector(':scope > title');
    if (titleEl && titleNode) {
      patchElementContent(titleEl, titleNode, clonedDoc, originMap);
    } else if (!titleEl && titleNode) {
      const newTitle = clonedDoc.createElement('title');
      serializeInlineContent(titleNode, clonedDoc, originMap).forEach(n => newTitle.appendChild(n));
      rootEl.insertBefore(newTitle, rootEl.firstChild);
    }

    // 2. Patch <shortdesc>
    const shortdescEl = rootEl.querySelector(':scope > shortdesc');
    if (shortdescEl && shortdescNode) {
      patchElementContent(shortdescEl, shortdescNode, clonedDoc, originMap);
    } else if (!shortdescEl && shortdescNode) {
      const newShortdesc = clonedDoc.createElement('shortdesc');
      serializeInlineContent(shortdescNode, clonedDoc, originMap).forEach(n => newShortdesc.appendChild(n));
      // Insert after title
      const afterTitle = rootEl.querySelector(':scope > title');
      if (afterTitle && afterTitle.nextSibling) {
        rootEl.insertBefore(newShortdesc, afterTitle.nextSibling);
      } else {
        rootEl.appendChild(newShortdesc);
      }
    }

    // 3. Patch body element — delegated entirely to THE body walk (ADR-006).
    const bodyEl = rootEl.querySelector(bodyTag);
    if (bodyEl && bodyNodes.length > 0) {
      patchBodyChildren(Array.from(bodyEl.children), bodyEl, bodyNodes, clonedDoc, rootTag, originMap);
    } else if (!bodyEl && bodyNodes.length > 0) {
      // No body element exists — create one
      const newBody = clonedDoc.createElement(bodyTag);
      bodyNodes.forEach(node => {
        const el = createElementFromLexical(node, clonedDoc, rootTag, originMap);
        if (el) newBody.appendChild(el);
      });
      rootEl.appendChild(newBody);
    }
  });

  // Serialize the cloned document
  const serializer = new XMLSerializer();
  let output = serializer.serializeToString(clonedDoc);

  // Strip spurious xmlns=""
  output = stripSpuriousXmlns(output);

  // XMLSerializer doesn't include <?xml?> or DOCTYPE — prepend them
  // First remove any xml declaration or DOCTYPE that XMLSerializer may have kept
  output = output.replace(/^<\?xml[^?]*\?>\s*/, '');
  output = output.replace(/^<!DOCTYPE\s[^[>]*(?:\[[^\]]*\]\s*)?\s*>\s*/, '');

  return `${xmlDecl}\n${doctype}\n${output}`;
};

/**
 * Group body-level Lexical nodes: an h2 heading starts a "section" group that
 * includes all following nodes until the next h2 or end.
 */
interface NodeGroup {
  type: 'single' | 'section' | 'dl';
  nodes: any[];
}

const groupBodyNodesForSections = (bodyNodes: any[], originMap?: NodeOriginMapType, groupDl: boolean = true): NodeGroup[] => {
  const groups: NodeGroup[] = [];
  let i = 0;

  while (i < bodyNodes.length) {
    const node = bodyNodes[i];
    const origin = originMap?.get(node.getKey());

    // Definition-list group: a run of nodes carrying dlEntryIndex (one <dt>
    // paragraph + the <dd>'s block children, repeated per <dlentry>). A fresh
    // entry-0 <dt> signals the start of the *next* <dl>, so it bounds the run.
    // Disabled inside <dd> patching (groupDl=false), where every node carries
    // dlEntryIndex by construction and must be treated as singles.
    if (groupDl && origin?.dlEntryIndex !== undefined) {
      const dlNodes: any[] = [node];
      i++;
      while (i < bodyNodes.length) {
        const next = bodyNodes[i];
        const nextOrigin = originMap?.get(next.getKey());
        if (nextOrigin?.dlEntryIndex === undefined) break;
        if (nextOrigin.tag === 'dt' && nextOrigin.dlEntryIndex === 0) break; // next <dl> begins
        dlNodes.push(next);
        i++;
      }
      groups.push({ type: 'dl', nodes: dlNodes });
    } else if (node.getType() === 'heading' && node.getTag() === 'h2') {
      // Start a section group
      const sectionNodes: any[] = [node];
      i++;
      while (i < bodyNodes.length) {
        const next = bodyNodes[i];
        if (next.getType() === 'heading' && next.getTag() === 'h2') break;
        sectionNodes.push(next);
        i++;
      }
      groups.push({ type: 'section', nodes: sectionNodes });
    } else {
      groups.push({ type: 'single', nodes: [node] });
      i++;
    }
  }

  return groups;
};

/**
 * Create a <section> DOM element from a group of Lexical nodes (h2 + body children).
 */
const createSectionFromLexical = (nodes: any[], doc: Document, rootTag: string, originMap: NodeOriginMapType): Element => {
  const section = doc.createElement('section');
  const first = nodes[0];

  if (first && first.getType() === 'heading' && first.getTag() === 'h2') {
    const title = doc.createElement('title');
    serializeInlineContent(first, doc, originMap).forEach(n => title.appendChild(n));
    section.appendChild(title);
  }

  const bodyNodes = first && first.getType() === 'heading' ? nodes.slice(1) : nodes;
  bodyNodes.forEach(node => {
    const el = createElementFromLexical(node, doc, rootTag, originMap);
    if (el) section.appendChild(el);
  });

  return section;
};

/**
 * Create a <dl> DOM element from a definition-list group created from scratch
 * (e.g. via insert-fragment). Not exercised on a no-edit round-trip — the source
 * <dl> is preserved and patched in place — but needed when no original <dl> exists.
 */
const createDlFromLexical = (nodes: any[], doc: Document, rootTag: string, originMap: NodeOriginMapType): Element => {
  const dl = doc.createElement('dl');

  // Partition into per-entry buckets by dlEntryIndex (preserving order).
  const order: number[] = [];
  const buckets = new Map<number, any[]>();
  for (const node of nodes) {
    const idx = originMap.get(node.getKey())?.dlEntryIndex ?? 0;
    if (!buckets.has(idx)) { buckets.set(idx, []); order.push(idx); }
    buckets.get(idx)!.push(node);
  }

  for (const idx of order) {
    const bucket = buckets.get(idx)!;
    const dtNode = bucket.find(n => originMap.get(n.getKey())?.tag === 'dt');
    const ddNodes = bucket.filter(n => n !== dtNode);

    const dlentry = doc.createElement('dlentry');
    const dt = doc.createElement('dt');
    if (dtNode) serializeInlineContent(dtNode, doc, originMap).forEach(n => dt.appendChild(n));
    dlentry.appendChild(dt);

    const dd = doc.createElement('dd');
    ddNodes.forEach(node => {
      const el = createElementFromLexical(node, doc, rootTag, originMap);
      if (el) dd.appendChild(el);
    });
    dlentry.appendChild(dd);

    dl.appendChild(dlentry);
  }

  return dl;
};
