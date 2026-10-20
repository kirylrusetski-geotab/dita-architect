import {
  $getRoot,
  $createParagraphNode,
  $createTextNode,
} from 'lexical';
import { $createHeadingNode, $createQuoteNode } from '@lexical/rich-text';
import { $createListNode, $createListItemNode } from '@lexical/list';
import { $createLinkNode } from '@lexical/link';
import {
  $createTableNode,
  $createTableRowNode,
  $createTableCellNode,
  TableCellHeaderStates,
} from '@lexical/table';
import type { NodeOriginMapType } from './nodeOriginMap';
import { $createDitaOpaqueNode } from '../components/DitaOpaqueNode';
import { $createDitaCodeBlockNode } from '../components/DitaCodeBlockNode';
import { $createDitaImageNode } from '../components/DitaImageNode';
import { $createDitaPhRefNode } from '../components/DitaPhRefNode';
import { $createDitaInfoPreviewNode, buildInfoModel } from '../components/DitaInfoPreviewNode';
import { $createDitaContainerBoundaryNode } from '../components/DitaContainerBoundaryNode';

// ---------------------------------------------------------------------------
// Shared parsing helpers — module-level so parseSectionFragment can reuse them
// ---------------------------------------------------------------------------

const parseTextNodes = (node: Element, originMap?: NodeOriginMapType): any[] => {
  const nodes: any[] = [];
  const childNodes = Array.from(node.childNodes);
  childNodes.forEach((child, index) => {
    if (child.nodeType === Node.PROCESSING_INSTRUCTION_NODE) {
      return; // Skip processing instructions (e.g. Heretto review markers)
    }
    if (child.nodeType === Node.TEXT_NODE) {
      let text = child.textContent;
      if (!text) return;
      // Skip whitespace-only text nodes adjacent to processing instructions
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
      // Normalize formatting whitespace: collapse runs containing newlines
      // to a single space so XML beautification doesn't affect Lexical rendering
      text = text.replace(/[ \t]*\n[ \t\n]*/g, ' ');

      if (text) {
        // FR-049: placeholder-ness is a property of emptiness, decided by
        // ShortdescPlugin at render time. Text is always real content here —
        // the old 19-pattern template-prose detector is gone.
        nodes.push($createTextNode(text));
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      parseInlineElement(child as Element, originMap).forEach(n => nodes.push(n));
    }
  });
  // Trim leading formatting whitespace from first text node
  if (nodes.length > 0 && nodes[0].getType?.() === 'text') {
    const t = nodes[0].getTextContent();
    const trimmed = t.replace(/^\s+/, '');
    if (!trimmed) nodes.shift();
    else if (trimmed !== t) nodes[0] = $createTextNode(trimmed);
  }
  // Trim trailing formatting whitespace from last text node
  if (nodes.length > 0 && nodes[nodes.length - 1].getType?.() === 'text') {
    const t = nodes[nodes.length - 1].getTextContent();
    const trimmed = t.replace(/\s+$/, '');
    if (!trimmed) nodes.pop();
    else if (trimmed !== t) nodes[nodes.length - 1] = $createTextNode(trimmed);
  }
  return nodes;
};

// Convert a single inline DITA element into Lexical nodes. Used both by
// parseTextNodes (iterating a parent's children) and by the block-split paths in
// traverseXmlElement / case 'dl', which encounter inline elements one at a time.
// Calling parseTextNodes(el) there was wrong — it descends into el's *children*,
// so an empty inline like <ph conkeyref="…"/> (no children) yielded nothing and
// <uicontrol>x</uicontrol> lost its tag. Parsing the element itself fixes that.
const parseInlineElement = (el: Element, originMap?: NodeOriginMapType): any[] => {
  const nodes: any[] = [];
  const elTag = el.tagName.toLowerCase();

  if (elTag === 'xref') {
    const href = el.getAttribute('href') || '';
    const linkNode = $createLinkNode(href);
    parseTextNodes(el, originMap).forEach(n => linkNode.append(n));
    const inlineAttrs: Record<string, string> = {};
    for (const attr of Array.from(el.attributes)) {
      if (attr.name !== 'href') inlineAttrs[attr.name] = attr.value;
    }
    if (Object.keys(inlineAttrs).length > 0) {
      originMap?.set(linkNode.getKey(), { tag: 'xref', bodyIndex: -1, inlineAttrs });
    }
    nodes.push(linkNode);
  } else if (
    (elTag === 'ph' || elTag === 'term') &&
    (el.getAttribute('conkeyref') || el.getAttribute('keyref') || el.getAttribute('conref'))
  ) {
    // ph/term carrying a reference → DitaPhRefNode (chip). Refless ph/term fall
    // through to the generic branch below so their tag is preserved via inlineTag.
    const refType = el.hasAttribute('conkeyref') ? 'conkeyref' : el.hasAttribute('keyref') ? 'keyref' : 'conref';
    const ref = el.getAttribute('conkeyref') || el.getAttribute('keyref') || el.getAttribute('conref');
    nodes.push($createDitaPhRefNode(refType, ref!, el.textContent || ''));
  } else if (elTag === 'image') {
    const href = el.getAttribute('href') || '';
    const alt = el.querySelector('alt')?.textContent || el.getAttribute('alt') || '';
    nodes.push($createDitaPhRefNode('image', href, alt));
  } else if (elTag === 'codeph') {
    // Kept as a format flag (not inlineTag) so code toggles stay inside the S2
    // format-run comparison set (b/i/codeph).
    const textNode = $createTextNode(el.textContent || '');
    textNode.toggleFormat('code');
    nodes.push(textNode);
  } else if (elTag === 'b' || elTag === 'strong') {
    const textNode = $createTextNode(el.textContent || '');
    textNode.toggleFormat('bold');
    nodes.push(textNode);
  } else if (elTag === 'i' || elTag === 'em') {
    const textNode = $createTextNode(el.textContent || '');
    textNode.toggleFormat('italic');
    nodes.push(textNode);
  } else if (Array.from(el.childNodes).some(c => c.nodeType === Node.ELEMENT_NODE)) {
    // Container inline element (e.g. <menucascade>, or a phrase wrapping other
    // inline tags). It can't be one stamped text node without losing the
    // children, so flatten its inline content — nested leaf tags are preserved
    // by the recursion below; the wrapper itself round-trips on the no-edit
    // patch path (full container reconstruction is FR-046 territory).
    parseTextNodes(el, originMap).forEach(n => nodes.push(n));
  } else {
    // M1: generic leaf inline element. Stamp the tag + its attributes so it
    // survives a content rewrite instead of flattening to plain text. This
    // generalizes the former uicontrol/wintitle point-patches to every inline
    // phrase element (filepath, term, cite, varname, cmdname, keyword, …).
    // A couple of elements carry an established editor affordance as a format
    // flag; the flag only drives appearance — inlineTag still governs output.
    //
    // Token mode is essential: without it Lexical merges this node with its
    // adjacent plain-text siblings during normalization (isSimpleText requires
    // mode 'normal'), which orphans the inlineTag stamp keyed on this node and
    // flattens the element back to plain text. uicontrol/wintitle previously
    // survived only because their bold/italic format differed from neighbors —
    // token mode makes preservation robust for every tag, including adjacent
    // same-tag runs (e.g. the <uicontrol>s inside a <menucascade>).
    const textNode = $createTextNode(el.textContent || '');
    textNode.setMode('token');
    if (elTag === 'uicontrol') textNode.toggleFormat('bold');
    else if (elTag === 'wintitle') textNode.toggleFormat('italic');
    const inlineAttrs: Record<string, string> = {};
    for (const attr of Array.from(el.attributes)) {
      inlineAttrs[attr.name] = attr.value;
    }
    originMap?.set(
      textNode.getKey(),
      Object.keys(inlineAttrs).length > 0
        ? { tag: elTag, bodyIndex: -1, inlineTag: elTag, inlineAttrs }
        : { tag: elTag, bodyIndex: -1, inlineTag: elTag }
    );
    nodes.push(textNode);
  }
  return nodes;
};

// Troubleshooting-topic containers (ADR-009). Each flattens to body-level
// nodes stamped with a containerPath so the serializer can patch the
// preserved element in place. DOM tagName case is kept (`troubleSolution`).
export const TROUBLE_CONTAINER_TAGS = new Set(['troubleSolution', 'condition', 'cause', 'remedy', 'steps-informal']);
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

// BUG-25: counter for pWrapperId, reset at the start of every parse so ids are
// deterministic per document.
let pWrapperCounter = 0;

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
          return $createDitaPhRefNode(refType, refValue!, `[${refType}: ${refValue}]`);
        }

        const noteType = (xmlNode.getAttribute('type') || 'note').toUpperCase();
        const quote = $createQuoteNode();
        // When <note> contains block children (e.g. <note><p>…<xref/>…</p></note>),
        // flatten each block child's inline content into the quote so xrefs become
        // LinkNodes. Direct parseTextNodes() on the note element would treat <p> as an
        // unknown inline and flatten it to textContent, destroying any xref inside it.
        const noteBlockTags = new Set(['p', 'ul', 'ol', 'codeblock', 'table', 'simpletable', 'fig', 'image', 'section']);
        const noteHasBlockChildren = Array.from(xmlNode.children).some(
          child => noteBlockTags.has(child.tagName.toLowerCase())
        );
        if (noteHasBlockChildren) {
          Array.from(xmlNode.childNodes).forEach(child => {
            if (child.nodeType === Node.ELEMENT_NODE) {
              const el = child as Element;
              if (noteBlockTags.has(el.tagName.toLowerCase())) {
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
      const blockTags = new Set(['codeblock', 'note', 'ul', 'ol', 'table', 'simpletable', 'fig', 'p', 'section', 'dl']);
      const hasBlockChildren = Array.from(xmlNode.children).some(
        child => blockTags.has(child.tagName.toLowerCase())
      );

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

      const parseCellContent = (entryEl: Element) => {
        const nodes: any[] = [];
        let inlineNodes: any[] = [];

        const blockTags = new Set(['p', 'ul', 'ol', 'li', 'table', 'section', 'div']);

        const flushInline = () => {
          if (inlineNodes.length > 0) {
            const p = $createParagraphNode();
            inlineNodes.forEach(n => p.append(n));
            nodes.push(p);
            inlineNodes = [];
          }
        };

        // Process all child nodes sequentially (both text and element nodes)
        Array.from(entryEl.childNodes).forEach(child => {
          if (child.nodeType === Node.TEXT_NODE) {
            let text = child.textContent;
            if (!text) return;
            text = text.replace(/[ \t]*\n[ \t\n]*/g, ' ');
            if (text.trim()) inlineNodes.push($createTextNode(text));
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            const el = child as Element;
            const elTag = el.tagName.toLowerCase();

            if (blockTags.has(elTag)) {
              // Block element: flush inline content, then add block
              flushInline();
              const blockResult = traverseXmlElement(el, originMap);
              if (blockResult) {
                if (Array.isArray(blockResult)) nodes.push(...blockResult);
                else nodes.push(blockResult);
              }
            } else {
              // Inline element: parse as text nodes
              parseInlineElement(el, originMap).forEach(n => inlineNodes.push(n));
            }
          }
        });

        flushInline();

        // If no content was processed, create an empty paragraph
        return nodes.length > 0 ? nodes : [$createParagraphNode()];
      };

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

            parseCellContent(entry).forEach(n => cellNode.append(n));
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

      const parseCellContent = (entryEl: Element) => {
        const nodes: any[] = [];
        let inlineNodes: any[] = [];

        const blockTags = new Set(['p', 'ul', 'ol', 'li', 'table', 'section', 'div']);

        const flushInline = () => {
          if (inlineNodes.length > 0) {
            const p = $createParagraphNode();
            inlineNodes.forEach(n => p.append(n));
            nodes.push(p);
            inlineNodes = [];
          }
        };

        // Process all child nodes sequentially (both text and element nodes)
        Array.from(entryEl.childNodes).forEach(child => {
          if (child.nodeType === Node.TEXT_NODE) {
            let text = child.textContent;
            if (!text) return;
            text = text.replace(/[ \t]*\n[ \t\n]*/g, ' ');
            if (text.trim()) inlineNodes.push($createTextNode(text));
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            const el = child as Element;
            const elTag = el.tagName.toLowerCase();

            if (blockTags.has(elTag)) {
              // Block element: flush inline content, then add block
              flushInline();
              const blockResult = traverseXmlElement(el, originMap);
              if (blockResult) {
                if (Array.isArray(blockResult)) nodes.push(...blockResult);
                else nodes.push(blockResult);
              }
            } else {
              // Inline element: parse as text nodes
              parseInlineElement(el, originMap).forEach(n => inlineNodes.push(n));
            }
          }
        });

        flushInline();

        // If no content was processed, create an empty paragraph
        return nodes.length > 0 ? nodes : [$createParagraphNode()];
      };

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
          parseCellContent(entry).forEach(n => cellNode.append(n));
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

    case 'section': {
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
      // 'image' is intentionally NOT a dd block tag — inline <image> is handled by
      // parseInlineElement so it round-trips in place (see the case 'p' note above).
      const ddBlockTags = new Set(['p', 'ul', 'ol', 'codeblock', 'note', 'table', 'simpletable', 'fig', 'section']);
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
                  const existing = originMap.get(n.getKey());
                  originMap.set(n.getKey(), {
                    ...(existing ?? { tag: 'dd', bodyIndex: bodyIndex ?? -1 }),
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
      Array.from(body.children).forEach(child => {
        appendResult(traverseXmlElement(child, originMap));
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
