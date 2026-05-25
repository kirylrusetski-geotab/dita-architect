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

    const traverse = (xmlNode: Element, bodyIndex?: number): any | any[] | null => {
      const tagName = xmlNode.tagName.toLowerCase();

      const parseTextNodes = (node: Element) => {
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
                const textNode = $createTextNode(text.trim());
                textNode.setFormat('italic');
                textNode.setStyle('color: var(--app-text-muted)');
                nodes.push(textNode);
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
              const linkChildren = parseTextNodes(el);
              linkChildren.forEach(n => linkNode.append(n));
              nodes.push(linkNode);
            } else if (elTag === 'ph' || elTag === 'term') {
              const ref = el.getAttribute('conkeyref') || el.getAttribute('keyref') || el.getAttribute('conref');
              if (ref) {
                const refType = el.hasAttribute('conkeyref') ? 'conkeyref' : el.hasAttribute('keyref') ? 'keyref' : 'conref';
                nodes.push($createDitaPhRefNode(refType, ref, el.textContent || ''));
              } else {
                // No ref — transparent pass-through
                parseTextNodes(el).forEach(n => nodes.push(n));
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
              nodes.push(textNode);
            } else if (elTag === 'wintitle') {
              const textNode = $createTextNode(el.textContent || '');
              textNode.toggleFormat('italic');
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

      switch (tagName) {
        case 'title': {
          const level = xmlNode.parentElement?.tagName.toLowerCase() === 'section' ? 'h2' : 'h1';
          const heading = $createHeadingNode(level);
          parseTextNodes(xmlNode).forEach(n => heading.append(n));
          if (level === 'h2') {
            originMap.set(heading.getKey(), { tag: 'section-title', bodyIndex: -1 });
          }
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
            parseTextNodes(xmlNode).forEach(n => quote.append(n));
            originMap.set(quote.getKey(), { tag: 'note', bodyIndex: bodyIndex ?? -1, noteType });
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
                  const blockResult = traverse(el);
                  if (blockResult) {
                    if (Array.isArray(blockResult)) results.push(...blockResult);
                    else results.push(blockResult);
                  }
                } else {
                  // Inline element — parse as text nodes
                  parseTextNodes(el).forEach(n => inlineNodes.push(n));
                }
              }
            });
            flushInline();
            return results.length === 1 ? results[0] : results;
          }

          const p = $createParagraphNode();
          parseTextNodes(xmlNode).forEach(n => p.append(n));
          if (tagName === 'shortdesc') {
            originMap.set(p.getKey(), { tag: 'shortdesc', bodyIndex: -2 });
          } else if (tagName === 'prereq' || tagName === 'context' || tagName === 'result' || tagName === 'postreq') {
            originMap.set(p.getKey(), { tag: tagName, bodyIndex: bodyIndex ?? -1 });
          } else if (tagName === 'p' && bodyIndex !== undefined) {
            originMap.set(p.getKey(), { tag: 'p', bodyIndex });
          }
          return p;
        }

        case 'steps':
        case 'ol': {
          const ol = $createListNode('number');
          Array.from(xmlNode.children).forEach(child => {
            if (child.tagName === 'step' || child.tagName === 'li') {
              const li = $createListItemNode();
              const contentNode = child.querySelector('cmd') || child;
              parseTextNodes(contentNode).forEach(n => li.append(n));

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
          return ol;
        }

        case 'ul': {
          const ul = $createListNode('bullet');
          Array.from(xmlNode.children).forEach(child => {
            const li = $createListItemNode();
            parseTextNodes(child).forEach(n => li.append(n));
            ul.append(li);
          });
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
                  const blockResult = traverse(el);
                  if (blockResult) {
                    if (Array.isArray(blockResult)) nodes.push(...blockResult);
                    else nodes.push(blockResult);
                  }
                } else {
                  // Inline element: parse as text nodes
                  parseTextNodes(el).forEach(n => inlineNodes.push(n));
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
                  const blockResult = traverse(el);
                  if (blockResult) {
                    if (Array.isArray(blockResult)) nodes.push(...blockResult);
                    else nodes.push(blockResult);
                  }
                } else {
                  // Inline element: parse as text nodes
                  parseTextNodes(el).forEach(n => inlineNodes.push(n));
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

          return tableNode;
        }

        case 'section': {
          const sectionNodes: any[] = [];
          Array.from(xmlNode.children).forEach(child => {
            const result = traverse(child);
            if (result) {
              if (Array.isArray(result)) {
                sectionNodes.push(...result);
              } else {
                sectionNodes.push(result);
              }
            }
          });
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
          return $createDitaCodeBlockNode(code, language);
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
      appendResult(traverse(title));
    }

    // Find shortdesc as direct child of topic element
    const shortdesc = topicElement?.querySelector(':scope > shortdesc');
    if (shortdesc) appendResult(traverse(shortdesc));

    const body = doc.querySelector('taskbody, conbody, refbody, body');
    if (body) {
      Array.from(body.children).forEach(child => {
        appendResult(traverse(child));
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
