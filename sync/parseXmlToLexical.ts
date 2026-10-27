import {
  $getRoot,
  $createParagraphNode,
  $createTextNode,
} from 'lexical';
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { $createListNode, $createListItemNode } from '@lexical/list';
import {
  $createTableNode,
  $createTableRowNode,
  $createTableCellNode,
  TableCellHeaderStates,
} from '@lexical/table';
import type { NodeOriginMapType } from './nodeOriginMap';
import { scanInlineChildren, scanInlineElement, atomsToLexical, NOTE_BLOCK_TAGS } from './inline-units';
import { $createDitaOpaqueNode } from '../components/DitaOpaqueNode';
import { $createDitaCodeBlockNode } from '../components/DitaCodeBlockNode';
import { $createDitaImageNode } from '../components/DitaImageNode';
import { $createDitaPhRefNode } from '../components/DitaPhRefNode';
import { $createDitaInfoPreviewNode, buildInfoModel } from '../components/DitaInfoPreviewNode';
import { $createDitaContainerBoundaryNode } from '../components/DitaContainerBoundaryNode';

// ---------------------------------------------------------------------------
// Shared parsing helpers — module-level so parseSectionFragment can reuse them
// ---------------------------------------------------------------------------

// ADR-010: both helpers are thin wrappers over the shared inline scanner in
// inline-units.ts. The scanner owns every rule (whitespace collapse, PI-adjacent
// whitespace, edge trim, the inline-element branch order, container flattening,
// token-mode stamping) so the serializer's reconciler reads the same atoms this
// parser builds nodes from — one source of truth, nothing to drift.
const parseTextNodes = (node: Element, originMap?: NodeOriginMapType): any[] =>
  atomsToLexical(scanInlineChildren(Array.from(node.childNodes), 'trim', null), originMap);

// Convert a single inline DITA element into Lexical nodes. Used both by
// parseTextNodes (via the scanner) and by the block-split paths in
// traverseXmlElement / case 'dl', which encounter inline elements one at a time.
// Calling parseTextNodes(el) there was wrong — it descends into el's *children*,
// so an empty inline like <ph conkeyref="…"/> (no children) yielded nothing and
// <uicontrol>x</uicontrol> lost its tag. Parsing the element itself fixes that.
const parseInlineElement = (el: Element, originMap?: NodeOriginMapType): any[] =>
  atomsToLexical(scanInlineElement(el, null), originMap);

// Troubleshooting-topic containers (ADR-009). Each flattens to body-level
// nodes stamped with a containerPath so the serializer can patch the
// preserved element in place. DOM tagName case is kept (`troubleSolution`).
// BUG-27 (FR-064 sampled-corpus finding): prereq/context/result/postreq join
// this set too. They behave like a troubleshooting container whenever they
// wrap a block child (most commonly a single <p>) rather than holding direct
// inline text — the direct-text case (task-info.dita) is unaffected, handled
// separately below where hasBlockChildren is false.
// ADR-011 (BUG-28): <section> is a container too — titled or not, it is
// flattened with a containerPath so the serializer patches the element it came
// from by ordinal identity instead of guessing from h2 order.
export const TROUBLE_CONTAINER_TAGS = new Set(['troubleSolution', 'condition', 'cause', 'remedy', 'steps-informal', 'prereq', 'context', 'result', 'postreq', 'section']);

// Block children that make a <p>, <shortdesc>, or task section split into
// several nodes (and make prereq/context/result/postreq a container, BUG-27).
// Exported: the serializer must decide "is this <result> a container?" by the
// same rule (ADR-011).
export const BLOCK_CHILD_TAGS: ReadonlySet<string> = new Set(['codeblock', 'note', 'ul', 'ol', 'table', 'simpletable', 'fig', 'p', 'section', 'dl']);

// Where a <section> may stand per DITA 1.3 (body-level, or nested in another
// container as Heretto sometimes writes it). Anywhere else (a table cell, a
// <p>, a <dd>) it keeps the pre-ADR-011 flatten with no identity, because the
// walks that patch those places do not group by containerPath.
const SECTION_CONTAINER_PARENTS = new Set(['conbody', 'refbody', 'body', 'taskbody', 'troublebody']);
const SECTION_LIKE_TITLE_PARENTS = new Set(['section', 'condition', 'cause', 'remedy']);

/** "tag#ordinal" for `el` among its parent's same-tag children. */
const containerSegment = (el: Element): string => {
  const siblings = el.parentElement ? Array.from(el.parentElement.children).filter(c => c.tagName === el.tagName) : [el];
  return `${el.tagName}#${siblings.indexOf(el)}`;
};

/** Full container path for `el` itself: every enclosing container from the outermost down to `el`. */
const containerPathFor = (el: Element): string => {
  const segments: string[] = [];
  let cur: Element | null = el;
  while (cur && TROUBLE_CONTAINER_TAGS.has(cur.tagName)) {
    segments.unshift(containerSegment(cur));
    cur = cur.parentElement;
  }
  return segments.join('/');
};

// Pre-ADR-011 section flatten, kept for sections the DTD does not allow at
// body level (inside a table cell, a <p>, a <dd>): children become nodes with
// no containerPath, exactly as before.
const parseSectionLegacy = (xmlNode: Element, originMap: NodeOriginMapType, stampId: (node: any) => void): any[] => {
  const sectionNodes: any[] = [];
  Array.from(xmlNode.children).forEach(child => {
    const result = traverseXmlElement(child, originMap);
    if (result) {
      if (Array.isArray(result)) {
        sectionNodes.push(...result);
      } else {
        sectionNodes.push(result);
      }
    }
  });
  // For a <section id="..."> the id rides on the first node (typically the h2 title).
  if (sectionNodes.length > 0) stampId(sectionNodes[0]);
  return sectionNodes;
};

// BUG-25: counter for pWrapperId, reset at the start of every parse so ids are
// deterministic per document.
let pWrapperCounter = 0;

// BUG-29 (ADR-009 amendment): what a table cell treats as a block. Each is
// parsed by traverseXmlElement exactly as in the body (<note> → quote, <dl> →
// dt/dd paragraphs, <fig> → image node); everything else is the cell's inline
// content. Exported: the serializer splits a DOM cell by the same rule.
// <li>/<div> keep their pre-BUG-29 handling (opaque); <image> stays inline, as
// DITA allows it in an entry.
export const CELL_BLOCK_TAGS: ReadonlySet<string> = new Set(['p', 'ul', 'ol', 'li', 'note', 'dl', 'fig', 'codeblock', 'table', 'simpletable', 'section', 'div']);

// What a <dd> treats as a block; everything else is the <dd>'s inline content
// (paragraphs tagged 'dd'). 'image' is intentionally NOT here — an inline
// <image> round-trips in place as a chip (see the case 'p' note below).
// Exported for the same reason as CELL_BLOCK_TAGS (BUG-40).
export const DD_BLOCK_TAGS: ReadonlySet<string> = new Set(['p', 'ul', 'ol', 'codeblock', 'note', 'table', 'simpletable', 'fig', 'section']);

/**
 * BUG-29: the content of one <entry> or <stentry>, shared by both table kinds.
 * Loose inline content becomes paragraphs stamped `cell-inline`; a <p> becomes
 * a paragraph stamped `p`, so the serializer can tell the two apart. A block
 * that produces no editor node (an empty <div>) still gets an opaque node, so
 * the two sides of the cell keep the same shape.
 */
const parseCellContent = (cellEl: Element, originMap: NodeOriginMapType): any[] => {
  const nodes: any[] = [];
  let inlineNodes: any[] = [];

  const flushInline = () => {
    if (inlineNodes.length === 0) return;
    const p = $createParagraphNode();
    inlineNodes.forEach(n => p.append(n));
    originMap.set(p.getKey(), { tag: 'cell-inline', bodyIndex: -1 });
    nodes.push(p);
    inlineNodes = [];
  };

  Array.from(cellEl.childNodes).forEach(child => {
    if (child.nodeType === Node.TEXT_NODE) {
      let text = child.textContent;
      if (!text) return;
      text = text.replace(/[ \t]*\n[ \t\n]*/g, ' ');
      if (text.trim()) inlineNodes.push($createTextNode(text));
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;
      const elTag = el.tagName.toLowerCase();
      if (!CELL_BLOCK_TAGS.has(elTag)) {
        parseInlineElement(el, originMap).forEach(n => inlineNodes.push(n));
        return;
      }
      flushInline();
      // A <section> is not allowed in a cell, and its flatten carries no
      // identity there: keep it whole rather than risk duplicating it.
      const result = elTag === 'section' ? null : traverseXmlElement(el, originMap);
      const blocks = Array.isArray(result) ? result : result ? [result] : [];
      if (blocks.length === 0) {
        nodes.push($createDitaOpaqueNode(elTag, new XMLSerializer().serializeToString(el)));
        return;
      }
      if (elTag === 'p') {
        blocks.forEach(b => {
          if (b.getType() === 'paragraph' && !originMap.has(b.getKey())) originMap.set(b.getKey(), { tag: 'p', bodyIndex: -1 });
        });
      }
      nodes.push(...blocks);
    }
  });
  flushInline();

  if (nodes.length === 0) {
    const p = $createParagraphNode();
    originMap.set(p.getKey(), { tag: 'cell-inline', bodyIndex: -1 });
    nodes.push(p);
  }
  return nodes;
};

const traverseXmlElement = (xmlNode: Element, originMap: NodeOriginMapType, bodyIndex?: number): any | any[] | null => {
  const tagName = xmlNode.tagName.toLowerCase();
  const xmlId = xmlNode.getAttribute('id') || undefined;

  const stampId = (node: any) => {
    if (!xmlId || !node || typeof node.getKey !== 'function') return;
    const existing = originMap.get(node.getKey());
    if (existing) {
      originMap.set(node.getKey(), { ...existing, xmlId });
    } else {
      originMap.set(node.getKey(), { tag: tagName, bodyIndex: bodyIndex ?? -1, xmlId });
    }
  };

  switch (tagName) {
    case 'title': {
      const level = SECTION_LIKE_TITLE_PARENTS.has(xmlNode.parentElement?.tagName ?? '') ? 'h2' : 'h1';
      const heading = $createHeadingNode(level);
      parseTextNodes(xmlNode, originMap).forEach(n => heading.append(n));
      if (level === 'h2') {
        originMap.set(heading.getKey(), { tag: 'section-title', bodyIndex: -1 });
      }
      stampId(heading);
      return heading;
    }

    case 'shortdesc':
    case 'prereq':
    case 'context':
    case 'result':
    case 'postreq':
    case 'p':
    case 'cmd':
    case 'note': {
      if (tagName === 'note') {
        // Check for conkeyref/keyref/conref attributes first
        const conkeyref = xmlNode.getAttribute('conkeyref');
        const keyref = xmlNode.getAttribute('keyref');
        const conref = xmlNode.getAttribute('conref');

        if (conkeyref || keyref || conref) {
          const refType = conkeyref ? 'conkeyref' : keyref ? 'keyref' : 'conref';
          const refValue = conkeyref || keyref || conref;
          return $createDitaPhRefNode(refType, refValue!, `[${refType}: ${refValue}]`, 'note');
        }

        const noteType = (xmlNode.getAttribute('type') || 'note').toUpperCase();
        const quote = $createQuoteNode();
        // When <note> contains block children (e.g. <note><p>…<xref/>…</p></note>),
        // flatten each block child's inline content into the quote so xrefs become
        // LinkNodes. Direct parseTextNodes() on the note element would treat <p> as an
        // unknown inline and flatten it to textContent, destroying any xref inside it.
        const noteHasBlockChildren = Array.from(xmlNode.children).some(
          child => NOTE_BLOCK_TAGS.has(child.tagName.toLowerCase())
        );
        if (noteHasBlockChildren) {
          Array.from(xmlNode.childNodes).forEach(child => {
            if (child.nodeType === Node.ELEMENT_NODE) {
              const el = child as Element;
              if (NOTE_BLOCK_TAGS.has(el.tagName.toLowerCase())) {
                parseTextNodes(el, originMap).forEach(n => quote.append(n));
              }
            } else if (child.nodeType === Node.TEXT_NODE) {
              const text = child.textContent?.replace(/[ \t]*\n[ \t\n]*/g, ' ');
              if (text?.trim()) quote.append($createTextNode(text));
            }
          });
        } else {
          parseTextNodes(xmlNode, originMap).forEach(n => quote.append(n));
        }
        originMap.set(quote.getKey(), { tag: 'note', bodyIndex: bodyIndex ?? -1, noteType });
        stampId(quote);
        return quote;
      }

      // Check if this element contains block-level children that need recursive traversal.
      // 'dl' is included so a non-standard <p><dl>…</dl></p> wrapper (as authored in
      // Heretto) is treated as a block child and routed to case 'dl' instead of being
      // flattened to text by parseTextNodes. 'image' is intentionally NOT here: an
      // <image> inside a <p> is inline per DITA and is handled inline (DitaPhRefNode)
      // so it round-trips in place instead of being split into a separate block node.
      const blockTags = BLOCK_CHILD_TAGS;
      const hasBlockChildren = Array.from(xmlNode.children).some(
        child => blockTags.has(child.tagName.toLowerCase())
      );

      // BUG-27 (found via FR-064's sampled real-topic corpus, 2026-10-20):
      // <prereq>/<context>/<result>/<postreq> wrapping a block child (almost
      // always a single <p>, e.g. <prereq><p audience="partner">…</p></prereq>)
      // used to fall into the generic block-split below, which recurses into
      // the <p> via a bare `traverseXmlElement(el, originMap)` call with no
      // bodyIndex — the inner <p> comes back completely untagged (the
      // `tagName === 'p' && bodyIndex !== undefined` guard in the no-block-
      // children branch below never passes for a recursive call), so the
      // serializer's `areTypesCompatible` can't match it to the DOM <prereq>,
      // treats it as a mismatch, deletes the original element, and recreates
      // a bare <p> with no attributes — losing the wrapper tag, its class,
      // and even the inner element's own attributes (e.g. `audience`) on an
      // UNEDITED round-trip. Fixed by handling this exactly like the ADR-009
      // troubleshooting containers: flatten to body-level nodes stamped with
      // `containerPath`, so the serializer patches <prereq> et al. in place
      // via `patchContainer` instead of losing their identity. The
      // direct-inline-text case (no block children) is untouched — it keeps
      // using the plain-paragraph `{tag: tagName, bodyIndex}` origin below.
      if (hasBlockChildren && (tagName === 'prereq' || tagName === 'context' || tagName === 'result' || tagName === 'postreq')) {
        const path = containerPathFor(xmlNode);
        const nodes: any[] = [];
        Array.from(xmlNode.children).forEach(child => {
          const result = traverseXmlElement(child, originMap);
          if (!result) return;
          if (Array.isArray(result)) nodes.push(...result); else nodes.push(result);
        });
        nodes.forEach(n => {
          if (!n || typeof n.getKey !== 'function') return;
          const existing = originMap.get(n.getKey());
          originMap.set(n.getKey(), {
            ...(existing ?? { tag: n.getType?.() ?? 'p', bodyIndex: bodyIndex ?? -1 }),
            containerPath: existing?.containerPath ?? path,
          });
        });
        if (nodes.length > 0) stampId(nodes[0]);
        return nodes;
      }

      if (hasBlockChildren) {
        // Split into inline runs and block children
        const results: any[] = [];
        let inlineNodes: any[] = [];
        // BUG-25: a <p> wrapping blocks — tie every resulting node to this <p>
        // so the serializer patches the wrapper in place. <p><dl> keeps using
        // the dl path (the serializer's dl grouping takes precedence there).
        const pWrapperId = tagName === 'p' ? ++pWrapperCounter : undefined;

        const flushInline = () => {
          if (inlineNodes.length > 0) {
            const p = $createParagraphNode();
            inlineNodes.forEach(n => p.append(n));
            if (tagName === 'shortdesc') {
              originMap.set(p.getKey(), { tag: 'shortdesc', bodyIndex: -2 });
            } else if (tagName === 'prereq' || tagName === 'context' || tagName === 'result' || tagName === 'postreq') {
              originMap.set(p.getKey(), { tag: tagName, bodyIndex: bodyIndex ?? -1 });
            } else if (tagName === 'p') {
              originMap.set(p.getKey(), { tag: 'p', bodyIndex: bodyIndex ?? -1, pWrapperId });
            }
            results.push(p);
            inlineNodes = [];
          }
        };

        Array.from(xmlNode.childNodes).forEach(child => {
          if (child.nodeType === Node.TEXT_NODE) {
            let text = child.textContent;
            if (!text) return;
            text = text.replace(/[ \t]*\n[ \t\n]*/g, ' ');
            if (text.trim()) inlineNodes.push($createTextNode(text));
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            const el = child as Element;
            const elTag = el.tagName.toLowerCase();
            if (blockTags.has(elTag)) {
              flushInline();
              const blockResult = traverseXmlElement(el, originMap);
              if (blockResult) {
                const blocks = Array.isArray(blockResult) ? blockResult : [blockResult];
                if (pWrapperId !== undefined) {
                  blocks.forEach(b => {
                    if (!b || typeof b.getKey !== 'function') return;
                    const existing = originMap.get(b.getKey());
                    originMap.set(b.getKey(), { ...(existing ?? { tag: b.getType(), bodyIndex: -1 }), pWrapperId });
                  });
                }
                results.push(...blocks);
              }
            } else {
              // Inline element — parse as text nodes
              parseInlineElement(el, originMap).forEach(n => inlineNodes.push(n));
            }
          }
        });
        flushInline();
        if (results.length > 0) stampId(results[0]);
        return results.length === 1 ? results[0] : results;
      }

      const p = $createParagraphNode();
      parseTextNodes(xmlNode, originMap).forEach(n => p.append(n));
      if (tagName === 'shortdesc') {
        originMap.set(p.getKey(), { tag: 'shortdesc', bodyIndex: -2 });
      } else if (tagName === 'prereq' || tagName === 'context' || tagName === 'result' || tagName === 'postreq') {
        originMap.set(p.getKey(), { tag: tagName, bodyIndex: bodyIndex ?? -1 });
      } else if (tagName === 'p' && bodyIndex !== undefined) {
        originMap.set(p.getKey(), { tag: 'p', bodyIndex });
      }
      stampId(p);
      return p;
    }

    case 'steps':
    case 'steps-unordered':
    case 'ol': {
      // <steps-unordered> (troubleshooting remedies) is a bullet list of <step>s.
      const ol = $createListNode(tagName === 'steps-unordered' ? 'bullet' : 'number');
      Array.from(xmlNode.children).forEach(child => {
        if (child.tagName === 'step' || child.tagName === 'li') {
          const li = $createListItemNode();
          const contentNode = child.querySelector('cmd') || child;
          parseTextNodes(contentNode, originMap).forEach(n => li.append(n));

          // Render <info> block children as a read-only nested preview under the
          // step (P2-26 Phase 2). The preview serializes to nothing, so the
          // serializer keeps the original <info> byte-stable.
          if (child.tagName === 'step') {
            Array.from(child.querySelectorAll(':scope > info')).forEach(info => {
              li.append($createDitaInfoPreviewNode(buildInfoModel(info)));
            });
          }

          ol.append(li);
        }
      });
      stampId(ol);
      return ol;
    }

    case 'ul': {
      const ul = $createListNode('bullet');
      Array.from(xmlNode.children).forEach(child => {
        const li = $createListItemNode();
        parseTextNodes(child, originMap).forEach(n => li.append(n));
        ul.append(li);
      });
      stampId(ul);
      return ul;
    }

    case 'table': {
      const tableNode = $createTableNode();
      const tgroup = xmlNode.querySelector('tgroup');
      if (!tgroup) return null;

      const parseRows = (container: Element, isHeader: boolean) => {
        Array.from(container.children).forEach(child => {
          if (child.tagName.toLowerCase() !== 'row') return;
          const rowNode = $createTableRowNode();
          let hasEntries = false;
          Array.from(child.children).forEach(entry => {
            if (entry.tagName.toLowerCase() !== 'entry') return;
            hasEntries = true;
            const headerState = isHeader
              ? TableCellHeaderStates.ROW
              : TableCellHeaderStates.NO_STATUS;
            const cellNode = $createTableCellNode(headerState);

            // Handle rowspan (morerows)
            const morerows = entry.getAttribute('morerows');
            if (morerows) {
              const span = parseInt(morerows, 10);
              if (span > 0) cellNode.setRowSpan(span + 1);
            }

            // Handle colspan (namest/nameend)
            const namest = entry.getAttribute('namest');
            const nameend = entry.getAttribute('nameend');
            if (namest && nameend) {
              // Extract column numbers (e.g., "col1" -> 1, "col3" -> 3)
              const startMatch = namest.match(/col(\d+)/);
              const endMatch = nameend.match(/col(\d+)/);
              if (startMatch && endMatch) {
                const startCol = parseInt(startMatch[1], 10);
                const endCol = parseInt(endMatch[1], 10);
                const colspan = endCol - startCol + 1;
                if (colspan > 1) {
                  cellNode.setColSpan(colspan);
                }
              }
            }

            parseCellContent(entry, originMap).forEach(n => cellNode.append(n));
            rowNode.append(cellNode);
          });
          // Only append the row if it has entries
          if (hasEntries) {
            tableNode.append(rowNode);
          }
        });
      };

      const thead = tgroup.querySelector('thead');
      if (thead) parseRows(thead, true);
      const tbody = tgroup.querySelector('tbody');
      if (tbody) parseRows(tbody, false);

      stampId(tableNode);
      return tableNode;
    }

    case 'simpletable': {
      const tableNode = $createTableNode();

      Array.from(xmlNode.children).forEach(child => {
        const tag = child.tagName.toLowerCase();
        if (tag !== 'sthead' && tag !== 'strow') return;
        const isHeader = tag === 'sthead';
        const rowNode = $createTableRowNode();
        let hasEntries = false;
        Array.from(child.children).forEach(entry => {
          if (entry.tagName.toLowerCase() !== 'stentry') return;
          hasEntries = true;
          const headerState = isHeader
            ? TableCellHeaderStates.ROW
            : TableCellHeaderStates.NO_STATUS;
          const cellNode = $createTableCellNode(headerState);
          parseCellContent(entry, originMap).forEach(n => cellNode.append(n));
          rowNode.append(cellNode);
        });
        // Only append the row if it has entries
        if (hasEntries) {
          tableNode.append(rowNode);
        }
      });

      stampId(tableNode);
      return tableNode;
    }

    case 'section':
      if (
        !SECTION_CONTAINER_PARENTS.has(xmlNode.parentElement?.tagName.toLowerCase() ?? '') &&
        !TROUBLE_CONTAINER_TAGS.has(xmlNode.parentElement?.tagName ?? '')
      ) {
        return parseSectionLegacy(xmlNode, originMap, stampId);
      }
    // falls through — a body-level <section> is a container (ADR-011)
    case 'troublesolution': // tagName is lowercased for the switch; containerPathFor uses the DOM's original case
    case 'condition':
    case 'cause':
    case 'remedy':
    case 'steps-informal': {
      // ADR-009: flatten the container's children to body-level nodes (its
      // optional <title> becomes an h2 via the title case above) and stamp each
      // top-level result with this container's path. Nodes produced by a nested
      // container already carry a deeper path; keep theirs.
      const path = containerPathFor(xmlNode);
      const nodes: any[] = [];
      // Section-class containers open with a boundary marker: the author's only
      // cue of the structure, and the guard against Lexical merging a list in
      // this container with a same-type list at the end of the previous one.
      if (tagName === 'condition' || tagName === 'cause' || tagName === 'remedy') {
        nodes.push($createDitaContainerBoundaryNode(tagName));
      } else if (
        tagName === 'section' &&
        !Array.from(xmlNode.children).some(c => c.tagName === 'title') &&
        xmlNode.children.length > 0
      ) {
        // ADR-011: an untitled section with content has no other visual cue,
        // and the marker keeps Lexical from merging a list at the end of one
        // untitled section into a list at the start of the next. Empty and
        // conref'd sections (no element children) stay invisible as before.
        nodes.push($createDitaContainerBoundaryNode('section'));
      }
      Array.from(xmlNode.children).forEach(child => {
        const result = traverseXmlElement(child, originMap);
        if (!result) return;
        if (Array.isArray(result)) nodes.push(...result); else nodes.push(result);
      });
      nodes.forEach(n => {
        if (!n || typeof n.getKey !== 'function') return;
        const existing = originMap.get(n.getKey());
        originMap.set(n.getKey(), {
          ...(existing ?? { tag: n.getType(), bodyIndex: -1 }),
          containerPath: existing?.containerPath ?? path,
        });
      });
      if (nodes.length > 0) stampId(nodes[0]);
      return nodes;
    }

    case 'codeblock': {
      // Extract text content while preserving whitespace and ignoring processing instructions
      let code = '';
      const extractCodeText = (node: Node): void => {
        for (const child of Array.from(node.childNodes)) {
          if (child.nodeType === Node.TEXT_NODE) {
            code += child.textContent || '';
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            extractCodeText(child);
          }
          // Skip processing instructions
        }
      };
      extractCodeText(xmlNode);
      const language = xmlNode.getAttribute('outputclass') || '';
      const cb = $createDitaCodeBlockNode(code, language);
      stampId(cb);
      return cb;
    }

    case 'fig': {
      const imageEl = xmlNode.querySelector('image');
      if (!imageEl) {
        const serializer = new XMLSerializer();
        const xml = serializer.serializeToString(xmlNode);
        return $createDitaOpaqueNode(tagName, xml);
      }
      const figTitle = xmlNode.querySelector(':scope > title')?.textContent || '';
      const href = imageEl.getAttribute('href') || '';
      const alt = imageEl.querySelector('alt')?.textContent || imageEl.getAttribute('alt') || '';
      return $createDitaImageNode(href, alt, figTitle, true);
    }

    case 'image': {
      const href = xmlNode.getAttribute('href') || '';
      const alt = xmlNode.querySelector('alt')?.textContent || xmlNode.getAttribute('alt') || '';
      return $createDitaImageNode(href, alt, '', false);
    }

    case 'dl': {
      // Definition list. Lexical has no native definition-list node, so we flatten
      // the <dl> to a sequence of ordinary nodes — each <dt> becomes a styled
      // paragraph (tag 'dt') and each <dd>'s content becomes its block children
      // (inline runs as 'dd' paragraphs; nested block elements via their own cases).
      // Every produced node is tagged with dlEntryIndex so the serializer can
      // re-group the run and patch the preserved <dl>/<dlentry>/<dt>/<dd> skeleton.
      const results: any[] = [];
      const ddBlockTags = DD_BLOCK_TAGS;
      const dlEntries = Array.from(xmlNode.children).filter(
        c => c.tagName.toLowerCase() === 'dlentry'
      );

      dlEntries.forEach((entry, entryIndex) => {
        // <dt> → emphasized term paragraph
        const dt = entry.querySelector(':scope > dt');
        if (dt) {
          const dtPara = $createParagraphNode();
          parseTextNodes(dt, originMap).forEach(n => dtPara.append(n));
          originMap.set(dtPara.getKey(), { tag: 'dt', bodyIndex: bodyIndex ?? -1, dlEntryIndex: entryIndex });
          results.push(dtPara);
        }

        // <dd> → block/inline split (mirrors the <p>/<note> block handler and
        // parseCellContent), so nested <p>/<table>/<note> render via their cases.
        const dd = entry.querySelector(':scope > dd');
        if (dd) {
          const ddNodes: any[] = [];
          let inlineNodes: any[] = [];

          const flushInline = () => {
            if (inlineNodes.length > 0) {
              const p = $createParagraphNode();
              inlineNodes.forEach(n => p.append(n));
              originMap.set(p.getKey(), { tag: 'dd', bodyIndex: bodyIndex ?? -1, dlEntryIndex: entryIndex });
              ddNodes.push(p);
              inlineNodes = [];
            }
          };

          Array.from(dd.childNodes).forEach(child => {
            if (child.nodeType === Node.TEXT_NODE) {
              let text = child.textContent;
              if (!text) return;
              text = text.replace(/[ \t]*\n[ \t\n]*/g, ' ');
              if (text.trim()) inlineNodes.push($createTextNode(text));
            } else if (child.nodeType === Node.ELEMENT_NODE) {
              const el = child as Element;
              const elTag = el.tagName.toLowerCase();
              if (ddBlockTags.has(elTag)) {
                flushInline();
                const blockResult = traverseXmlElement(el, originMap);
                const arr = Array.isArray(blockResult) ? blockResult : blockResult ? [blockResult] : [];
                arr.forEach(n => {
                  // Preserve the nested element's own identity (tag, noteType, …)
                  // and merge in dl membership so the grouper can claim it.
                  // BUG-40: a <p> is tagged 'p', so the serializer can tell it
                  // from the <dd>'s own loose inline content (tagged 'dd').
                  const existing = originMap.get(n.getKey());
                  originMap.set(n.getKey(), {
                    ...(existing ?? { tag: elTag === 'p' ? 'p' : 'dd', bodyIndex: bodyIndex ?? -1 }),
                    dlEntryIndex: entryIndex,
                  });
                  ddNodes.push(n);
                });
              } else {
                parseInlineElement(el, originMap).forEach(n => inlineNodes.push(n));
              }
            }
          });
          flushInline();

          // Guarantee at least one node so an empty <dd> still round-trips.
          if (ddNodes.length === 0) {
            const p = $createParagraphNode();
            originMap.set(p.getKey(), { tag: 'dd', bodyIndex: bodyIndex ?? -1, dlEntryIndex: entryIndex });
            ddNodes.push(p);
          }

          // Mark the first node of the <dd> so CSS/serializer can find entry starts.
          const first = ddNodes[0];
          const firstOrigin = originMap.get(first.getKey());
          if (firstOrigin) originMap.set(first.getKey(), { ...firstOrigin, ddFirst: true });

          results.push(...ddNodes);
        }
      });

      if (results.length > 0) stampId(results[0]);
      return results.length > 0 ? results : null;
    }

    default: {
      const serializer = new XMLSerializer();
      const xml = serializer.serializeToString(xmlNode);
      if (!xml || !xmlNode.textContent?.trim()) return null;
      return $createDitaOpaqueNode(tagName, xml);
    }
  }
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export const parseXmlToLexical = (xmlString: string, editor: any, originMap: NodeOriginMapType, skipSelection?: boolean): boolean => {
  pWrapperCounter = 0; // BUG-25: deterministic wrapper ids per document
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');

  if (doc.querySelector('parsererror')) {
    console.warn('Invalid XML, skipping sync to Lexical');
    return false;
  }

  const updateFn = () => {
    const root = $getRoot();
    root.clear();
    originMap.clear();

    const appendResult = (result: any) => {
      if (Array.isArray(result)) {
        result.forEach(n => root.append(n));
      } else if (result) {
        root.append(result);
      }
    };

    // Get the topic root element
    const topicElement = doc.querySelector('task, concept, reference, troubleshooting, topic');

    // Find title as direct child of topic element
    const title = topicElement?.querySelector(':scope > title');
    if (title) {
      appendResult(traverseXmlElement(title, originMap));
    }

    // Find shortdesc as direct child of topic element
    const shortdesc = topicElement?.querySelector(':scope > shortdesc');
    if (shortdesc) appendResult(traverseXmlElement(shortdesc, originMap));

    // troublebody: DITA 1.3 troubleshooting topics (P2-25 / ADR-009).
    const body = doc.querySelector('taskbody, conbody, refbody, troublebody, body');
    if (body) {
      // BUG-26: the last node this loop appended, so two body-level lists of
      // the same type with nothing between them (no container, so ADR-009's
      // boundary never fires for them) can be caught before Lexical's own
      // ListNode.transform() merges them into one on this very update.
      let lastBodyNode: any = null;
      Array.from(body.children).forEach((child, bodyIndex) => {
        const result = traverseXmlElement(child, originMap);
        // ADR-011 decision 7: every top-level node the parser produces carries
        // its real bodyIndex (>= 0). A node without one — and without a
        // containerPath — was created by the author, and the serializer lets it
        // join the container of the node before it.
        const produced = Array.isArray(result) ? result : result ? [result] : [];
        produced.forEach(n => {
          if (!n || typeof n.getKey !== 'function') return;
          const existing = originMap.get(n.getKey());
          if (existing?.containerPath) return;
          originMap.set(n.getKey(), { ...(existing ?? { tag: n.getType() }), bodyIndex });
        });
        const firstNew = produced[0];
        if (
          firstNew && lastBodyNode &&
          firstNew.getType() === 'list' && lastBodyNode.getType() === 'list' &&
          firstNew.getListType() === lastBodyNode.getListType()
        ) {
          root.append($createDitaContainerBoundaryNode('list-break'));
        }
        appendResult(result);
        if (produced.length > 0) lastBodyNode = produced[produced.length - 1];
      });
    }
  };

  if (skipSelection) {
    editor.update(updateFn, { tag: 'skip-selection', discrete: true });
  } else {
    editor.update(updateFn);
  }

  return true;
};

// Block-level tags the API accepts at the top level of an insert fragment.
// Single source of truth — also consumed by lib/xml-insert.ts (FR-045).
export const ALLOWED_FRAGMENT_BLOCK_TAGS = new Set([
  'section', 'p', 'ul', 'ol', 'note', 'codeblock',
  'table', 'simpletable', 'fig', 'image', 'dl', 'example',
  'prereq', 'context', 'result', 'postreq', 'steps',
]);

/**
 * Parse a block-level XML fragment into an array of Lexical nodes, without
 * replacing the entire editor root. (The API insert path now goes through
 * lib/xml-insert.ts — FR-045; this remains for fragment-level tests and tools.)
 *
 * Accepts one or more block-level children: <section>, <p>, <ul>, <ol>, <note>,
 * <codeblock>, <table>, <simpletable>, <fig>, <image>, etc. When the root element
 * is <section>, its children are recursed into (preserving the original behavior
 * of parseSectionFragment).
 *
 * Must be called inside editor.update().
 */
export const parseBlockFragment = (fragmentXml: string, originMap: NodeOriginMapType): any[] | null => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<root>${fragmentXml}</root>`, 'application/xml');

  if (doc.querySelector('parsererror')) {
    console.warn('parseBlockFragment: invalid XML fragment');
    return null;
  }

  const root = doc.querySelector('root');
  if (!root) return null;

  const topChildren = Array.from(root.children);
  if (topChildren.length === 0) {
    console.warn('parseBlockFragment: no top-level elements');
    return null;
  }

  for (const child of topChildren) {
    if (!ALLOWED_FRAGMENT_BLOCK_TAGS.has(child.tagName.toLowerCase())) {
      console.warn(`parseBlockFragment: disallowed top-level element <${child.tagName}>`);
      return null;
    }
  }

  const nodes: any[] = [];
  topChildren.forEach(child => {
    if (child.tagName.toLowerCase() === 'section') {
      // Unwrap <section>: recurse into its children. Matches the legacy
      // parseSectionFragment behavior so inserted sections render as a flat
      // sequence of body-level nodes rather than a nested DitaOpaqueNode.
      Array.from(child.children).forEach(grandchild => {
        const result = traverseXmlElement(grandchild, originMap);
        if (result) {
          if (Array.isArray(result)) nodes.push(...result);
          else nodes.push(result);
        }
      });
    } else {
      const result = traverseXmlElement(child, originMap);
      if (result) {
        if (Array.isArray(result)) nodes.push(...result);
        else nodes.push(result);
      }
    }
  });

  return nodes.length > 0 ? nodes : null;
};

// Back-compat alias — existing callers use parseSectionFragment.
export const parseSectionFragment = parseBlockFragment;

/**
 * Walk the origin map looking for a Lexical node key whose origin has the
 * given XML id. Returns null if not found.
 */
export const findLexicalKeyByXmlId = (originMap: NodeOriginMapType, xmlId: string): string | null => {
  for (const [key, origin] of originMap.entries()) {
    if (origin.xmlId === xmlId) return key;
  }
  return null;
};
