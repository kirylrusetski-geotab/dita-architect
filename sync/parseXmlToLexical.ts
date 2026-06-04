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
        // Detect template placeholder text and mark with special class
        const placeholderPatterns = [
          /^Task title$/i,
          /^Enter your task title$/i,
          /^Short description of the task\.?$/i,
          /^Enter a short description of the task\.?$/i,
          /^Concept title$/i,
          /^Enter your concept title$/i,
          /^Short description of the concept\.?$/i,
          /^Enter a short description of the concept\.?$/i,
          /^Reference title$/i,
          /^Enter your reference title$/i,
          /^Short description of the reference\.?$/i,
          /^Enter a short description of the reference\.?$/i,
          /^Brief task description$/i,
          /^Brief description$/i,
          /^Enter task title here$/i,
          /^Enter short description here$/i,
          /^Task description$/i,
          /^Task description goes here$/i,
          /^Short task description$/i
        ];

        const isPlaceholder = placeholderPatterns.some(pattern => pattern.test(text.trim()));

        if (isPlaceholder) {
          // Plain TextNode — no format/style. The parent element gets
          // dita-editor-placeholder-title / dita-editor-placeholder-shortdesc
          // via ShortdescPlugin CSS classes, which provide the muted/italic
          // appearance without affecting Lexical's format state. Setting
          // format/style here causes newly typed characters to inherit
          // the muted italic appearance (Lexical format inheritance bug).
          nodes.push($createTextNode(text.trim()));
        } else {
          nodes.push($createTextNode(text));
        }
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;

      const elTag = el.tagName.toLowerCase();

      if (elTag === 'xref') {
        const href = el.getAttribute('href') || '';
        const linkNode = $createLinkNode(href);
        const linkChildren = parseTextNodes(el, originMap);
        linkChildren.forEach(n => linkNode.append(n));
        nodes.push(linkNode);
      } else if (elTag === 'ph' || elTag === 'term') {
        const ref = el.getAttribute('conkeyref') || el.getAttribute('keyref') || el.getAttribute('conref');
        if (ref) {
          const refType = el.hasAttribute('conkeyref') ? 'conkeyref' : el.hasAttribute('keyref') ? 'keyref' : 'conref';
          nodes.push($createDitaPhRefNode(refType, ref, el.textContent || ''));
        } else {
          // No ref — transparent pass-through
          parseTextNodes(el, originMap).forEach(n => nodes.push(n));
        }
      } else if (elTag === 'image') {
        const href = el.getAttribute('href') || '';
        const alt = el.querySelector('alt')?.textContent || el.getAttribute('alt') || '';
        nodes.push($createDitaPhRefNode('image', href, alt));
      } else if (elTag === 'codeph') {
        const textNode = $createTextNode(el.textContent || '');
        textNode.toggleFormat('code');
        nodes.push(textNode);
      } else if (elTag === 'uicontrol') {
        const textNode = $createTextNode(el.textContent || '');
        textNode.toggleFormat('bold');
        originMap?.set(textNode.getKey(), { tag: 'uicontrol', bodyIndex: -1, inlineTag: 'uicontrol' });
        nodes.push(textNode);
      } else if (elTag === 'wintitle') {
        const textNode = $createTextNode(el.textContent || '');
        textNode.toggleFormat('italic');
        originMap?.set(textNode.getKey(), { tag: 'wintitle', bodyIndex: -1, inlineTag: 'wintitle' });
        nodes.push(textNode);
      } else {
        const textNode = $createTextNode(el.textContent || '');
        if (elTag === 'b' || elTag === 'strong') {
          textNode.toggleFormat('bold');
        } else if (elTag === 'i' || elTag === 'em') {
          textNode.toggleFormat('italic');
        }
        nodes.push(textNode);
      }
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
      const level = xmlNode.parentElement?.tagName.toLowerCase() === 'section' ? 'h2' : 'h1';
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

      // Check if this element contains block-level children that need recursive traversal
      const blockTags = new Set(['codeblock', 'note', 'ul', 'ol', 'table', 'simpletable', 'fig', 'image', 'p', 'section']);
      const hasBlockChildren = Array.from(xmlNode.children).some(
        child => blockTags.has(child.tagName.toLowerCase())
      );

      if (hasBlockChildren) {
        // Split into inline runs and block children
        const results: any[] = [];
        let inlineNodes: any[] = [];

        const flushInline = () => {
          if (inlineNodes.length > 0) {
            const p = $createParagraphNode();
            inlineNodes.forEach(n => p.append(n));
            if (tagName === 'shortdesc') {
              originMap.set(p.getKey(), { tag: 'shortdesc', bodyIndex: -2 });
            } else if (tagName === 'prereq' || tagName === 'context' || tagName === 'result' || tagName === 'postreq') {
              originMap.set(p.getKey(), { tag: tagName, bodyIndex: bodyIndex ?? -1 });
            } else if (tagName === 'p' && bodyIndex !== undefined) {
              originMap.set(p.getKey(), { tag: 'p', bodyIndex });
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
                if (Array.isArray(blockResult)) results.push(...blockResult);
                else results.push(blockResult);
              }
            } else {
              // Inline element — parse as text nodes
              parseTextNodes(el, originMap).forEach(n => inlineNodes.push(n));
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
    case 'ol': {
      const ol = $createListNode('number');
      Array.from(xmlNode.children).forEach(child => {
        if (child.tagName === 'step' || child.tagName === 'li') {
          const li = $createListItemNode();
          const contentNode = child.querySelector('cmd') || child;
          parseTextNodes(contentNode, originMap).forEach(n => li.append(n));

          // Add affordance chips for <info> block children (invisible to serializer)
          if (child.tagName === 'step') {
            Array.from(child.querySelectorAll(':scope > info')).forEach(info => {
              const blockChildren = Array.from(info.children);
              let chipLabel: string;
              if (blockChildren.length === 0) {
                chipLabel = '[info]';
              } else if (blockChildren.length === 1) {
                chipLabel = `[${blockChildren[0].tagName.toLowerCase()}]`;
              } else {
                chipLabel = `[info: ${blockChildren.length} elements]`;
              }
              li.append($createDitaPhRefNode('info-chip', chipLabel, ''));
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
              parseTextNodes(el, originMap).forEach(n => inlineNodes.push(n));
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
              parseTextNodes(el, originMap).forEach(n => inlineNodes.push(n));
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
    const topicElement = doc.querySelector('task, concept, reference, topic');

    // Find title as direct child of topic element
    const title = topicElement?.querySelector(':scope > title');
    if (title) {
      appendResult(traverseXmlElement(title, originMap));
    }

    // Find shortdesc as direct child of topic element
    const shortdesc = topicElement?.querySelector(':scope > shortdesc');
    if (shortdesc) appendResult(traverseXmlElement(shortdesc, originMap));

    const body = doc.querySelector('taskbody, conbody, refbody, body');
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
// Kept in sync with the validation probe in lib/native-api-bridge.ts.
const ALLOWED_FRAGMENT_BLOCK_TAGS = new Set([
  'section', 'p', 'ul', 'ol', 'note', 'codeblock',
  'table', 'simpletable', 'fig', 'image', 'dl', 'example',
  'prereq', 'context', 'result', 'postreq', 'steps',
]);

/**
 * Parse a block-level XML fragment into an array of Lexical nodes, without
 * replacing the entire editor root. Used by SectionInsertPlugin to inject new
 * content into the live tree so TrackedChangesPlugin can highlight the additions.
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
