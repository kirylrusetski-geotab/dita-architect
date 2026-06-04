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
  'p', 'note', 'section', 'steps', 'ol', 'ul', 'prereq', 'context', 'result', 'postreq', 'table', 'simpletable', 'codeblock',
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
const patchElementContent = (domEl: Element, lexicalNode: any, doc: Document, originMap?: NodeOriginMapType): boolean => {
  const domText = getNormalizedDomText(domEl);
  const lexText = lexicalNode.getTextContent();
  if (domText === lexText) {
    // Text matches, but check if inline link structure changed (e.g. a LinkNode was added)
    const lexLinkCount = lexicalNode.getChildren
      ? lexicalNode.getChildren().filter((c: any) => c.getType() === 'link').length
      : 0;
    const domXrefCount = Array.from(domEl.children).filter((el: Element) => el.tagName === 'xref').length;
    if (lexLinkCount === domXrefCount) {
      return true; // untouched — all inline markup preserved
    }
    // Link structure changed — force full replacement
    replaceElementContent(domEl, lexicalNode, doc, originMap);
    return false;
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

  // Patch thead rows
  const thead = tgroup.querySelector('thead');
  if (thead) {
    const domRows = Array.from(thead.children).filter(c => c.tagName.toLowerCase() === 'row');
    for (const domRow of domRows) {
      if (lexIdx >= lexicalRows.length) break;
      patchTableRow(domRow, lexicalRows[lexIdx], doc, originMap);
      lexIdx++;
    }
  }

  // Patch tbody rows
  const tbody = tgroup.querySelector('tbody');
  if (tbody) {
    const domRows = Array.from(tbody.children).filter(c => c.tagName.toLowerCase() === 'row');
    for (const domRow of domRows) {
      if (lexIdx >= lexicalRows.length) break;
      patchTableRow(domRow, lexicalRows[lexIdx], doc, originMap);
      lexIdx++;
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
 * Core routine: walk DOM children and Lexical nodes in parallel, patching recognized elements.
 * Unrecognized DOM children are left untouched.
 */
const patchBodyChildren = (
  domChildren: Element[],
  parentEl: Element,
  lexicalNodes: any[],
  doc: Document,
  rootTag: string,
  originMap: NodeOriginMapType,
) => {
  let lexIdx = 0;

  // Track which DOM children are "recognized" for removal later
  const recognizedDomChildren: Element[] = [];
  const unrecognizedDomChildren: Element[] = [];

  for (const child of domChildren) {
    const tag = child.tagName.toLowerCase();
    if (RECOGNIZED_BODY_TAGS.has(tag)) {
      recognizedDomChildren.push(child);
    } else {
      unrecognizedDomChildren.push(child);
    }
  }

  // Patch recognized children in parallel with Lexical nodes.
  // maxIterations guards against infinite loops when createElementFromLexical
  // returns null repeatedly for the same DOM child (recognizedIdx-- never advances).
  let recognizedIdx = 0;
  const maxIterations = recognizedDomChildren.length + lexicalNodes.length + 1;
  let iterations = 0;
  for (; recognizedIdx < recognizedDomChildren.length && lexIdx < lexicalNodes.length; recognizedIdx++) {
    if (++iterations > maxIterations) break;
    const domChild = recognizedDomChildren[recognizedIdx];
    const domTag = domChild.tagName.toLowerCase();
    const lexNode = lexicalNodes[lexIdx];
    const lexType = lexNode.getType();
    const lexOrigin = originMap.get(lexNode.getKey());

    if (areTypesCompatible(domTag, lexType, lexOrigin, rootTag)) {
      patchRecognizedElement(domChild, lexNode, doc, rootTag, originMap);
      lexIdx++;
    } else {
      // Type mismatch — check if the next DOM child matches this Lexical node (look-ahead)
      const nextDomChild = recognizedIdx + 1 < recognizedDomChildren.length ? recognizedDomChildren[recognizedIdx + 1] : null;
      const nextDomTag = nextDomChild ? nextDomChild.tagName.toLowerCase() : null;

      if (nextDomTag && areTypesCompatible(nextDomTag, lexType, lexOrigin, rootTag)) {
        // Next DOM child matches — remove current DOM child and let the for-loop advance
        // to the next DOM child which will match this Lexical node on the next iteration.
        parentEl.removeChild(domChild);
      } else {
        // No look-ahead match — replace this DOM child with the new Lexical element
        const newEl = createElementFromLexical(lexNode, doc, rootTag, originMap);
        if (newEl) {
          parentEl.insertBefore(newEl, domChild);
        }
        parentEl.removeChild(domChild);
        lexIdx++;
      }
    }
  }

  // Remove unmatched recognized DOM children
  for (let i = recognizedIdx; i < recognizedDomChildren.length; i++) {
    parentEl.removeChild(recognizedDomChildren[i]);
  }

  // Append remaining Lexical nodes as new DOM elements
  for (let i = lexIdx; i < lexicalNodes.length; i++) {
    const newEl = createElementFromLexical(lexicalNodes[i], doc, rootTag, originMap);
    if (newEl) {
      parentEl.appendChild(newEl);
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

    // 3. Patch body element
    const bodyEl = rootEl.querySelector(bodyTag);
    if (bodyEl && bodyNodes.length > 0) {
      // Group body nodes: sections are an h2 followed by nodes until next h2
      const groupedNodes = groupBodyNodesForSections(bodyNodes);

      const domChildren = Array.from(bodyEl.children);

      // Walk DOM children and grouped Lexical nodes in parallel
      let lexGroupIdx = 0;
      const recognizedDomSections: { el: Element; idx: number }[] = [];
      const recognizedDomOther: { el: Element; idx: number }[] = [];

      domChildren.forEach((child, idx) => {
        const tag = child.tagName.toLowerCase();
        if (tag === 'section') {
          recognizedDomSections.push({ el: child, idx });
        } else if (RECOGNIZED_BODY_TAGS.has(tag)) {
          recognizedDomOther.push({ el: child, idx });
        }
        // Unrecognized children: left untouched
      });

      // Track which recognized DOM children were consumed by the walk
      const consumedDomChildren = new Set<Element>();

      // Process in document order: walk all DOM children
      for (const child of domChildren) {
        if (lexGroupIdx >= groupedNodes.length) break;
        const tag = child.tagName.toLowerCase();

        if (!RECOGNIZED_BODY_TAGS.has(tag)) {
          continue; // skip unrecognized — preserved automatically
        }

        const group = groupedNodes[lexGroupIdx];

        if (tag === 'section' && group.type === 'section') {
          patchSection(child, group.nodes, clonedDoc, rootTag, originMap);
          consumedDomChildren.add(child);
          lexGroupIdx++;
        } else if (tag !== 'section' && group.type === 'single') {
          const lexNode = group.nodes[0];
          const lexType = lexNode.getType();
          const lexOrigin = originMap.get(lexNode.getKey());

          if (areTypesCompatible(tag, lexType, lexOrigin, rootTag)) {
            patchRecognizedElement(child, lexNode, clonedDoc, rootTag, originMap);
            consumedDomChildren.add(child);
            lexGroupIdx++;
          } else {
            // Type mismatch — insert new element, remove old
            const newEl = createElementFromLexical(lexNode, clonedDoc, rootTag, originMap);
            if (newEl) {
              bodyEl.insertBefore(newEl, child);
            }
            bodyEl.removeChild(child);
            // child was removed, so it does not need to go into consumedDomChildren
            lexGroupIdx++;
          }
        } else if (tag === 'section' && group.type === 'single') {
          // DOM has a section but Lexical has a non-section node
          // The section might have been deleted — remove it and insert the new node
          const newEl = createElementFromLexical(group.nodes[0], clonedDoc, rootTag, originMap);
          if (newEl) {
            bodyEl.insertBefore(newEl, child);
          }
          bodyEl.removeChild(child);
          lexGroupIdx++;
        } else if (tag !== 'section' && group.type === 'section') {
          // DOM has a non-section element but Lexical has a section group
          // Remove old element, create section
          const sectionEl = createSectionFromLexical(group.nodes, clonedDoc, rootTag, originMap);
          bodyEl.insertBefore(sectionEl, child);
          bodyEl.removeChild(child);
          lexGroupIdx++;
        }
      }

      // Remove any recognized DOM children not consumed by the walk above.
      // This handles the case where Lexical has fewer nodes than the master XML —
      // e.g. after a PUT that replaces 3 paragraphs with 1 note: without this, the
      // 2 unmatched <p> elements would remain in the output alongside the new note.
      for (const child of domChildren) {
        if (!RECOGNIZED_BODY_TAGS.has(child.tagName.toLowerCase())) continue;
        if (!consumedDomChildren.has(child) && child.parentNode === bodyEl) {
          bodyEl.removeChild(child);
        }
      }

      // The loop above handles replacements inline, so remaining
      // Lexical groups just need to be appended.

      for (let i = lexGroupIdx; i < groupedNodes.length; i++) {
        const group = groupedNodes[i];
        if (group.type === 'section') {
          const sectionEl = createSectionFromLexical(group.nodes, clonedDoc, rootTag, originMap);
          bodyEl.appendChild(sectionEl);
        } else {
          const newEl = createElementFromLexical(group.nodes[0], clonedDoc, rootTag, originMap);
          if (newEl) bodyEl.appendChild(newEl);
        }
      }
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
  type: 'single' | 'section';
  nodes: any[];
}

const groupBodyNodesForSections = (bodyNodes: any[]): NodeGroup[] => {
  const groups: NodeGroup[] = [];
  let i = 0;

  while (i < bodyNodes.length) {
    const node = bodyNodes[i];
    if (node.getType() === 'heading' && node.getTag() === 'h2') {
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
