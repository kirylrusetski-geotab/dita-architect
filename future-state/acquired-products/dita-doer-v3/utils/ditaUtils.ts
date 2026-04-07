import { DitaBlock, DitaStep } from "../types";

// Helper to extract text while preserving simple inline tags like <xref>
const getInlineXml = (node: Element): string => {
  let text = '';
  Array.from(node.childNodes).forEach(child => {
    if (child.nodeType === 3) {
      // Text node
      text += child.textContent;
    } else if (child.nodeType === 1) {
      // Element node
      const el = child as Element;
      const tagName = el.tagName.toLowerCase();
      
      switch (tagName) {
        case 'xref':
          const href = el.getAttribute('href') || '';
          text += `<xref href="${href}">${el.textContent}</xref>`;
          break;
        case 'b':
          text += `<b>${el.textContent}</b>`;
          break;
        case 'i':
          text += `<i>${el.textContent}</i>`;
          break;
        case 'uicontrol':
          text += `<uicontrol>${el.textContent}</uicontrol>`;
          break;
        default:
          // Fallback for other tags, just get text
          text += el.textContent;
      }
    }
  });
  return text.trim();
};

// Helper to process a single node and append to blocks array
const processNode = (node: Element, blocks: DitaBlock[]) => {
  const nodeName = node.nodeName.toLowerCase();
  
  // Use getInlineXml for content to preserve links
  const content = getInlineXml(node);

  switch (nodeName) {
    case 'p':
      if (content) blocks.push({ type: 'paragraph', content });
      break;

    case 'context':
      if (content) blocks.push({ type: 'context', content });
      break;

    case 'result':
      if (content) blocks.push({ type: 'result', content });
      break;

    case 'prereq':
      if (content) blocks.push({ type: 'prereq', content });
      break;

    case 'section':
      // Handle Section Title
      const title = node.querySelector('title');
      if (title?.textContent) {
        blocks.push({ type: 'section-title', content: title.textContent.trim() });
      }
      
      // Handle Section Children (flattened)
      Array.from(node.children).forEach(child => {
        if (child.nodeName.toLowerCase() !== 'title') {
          processNode(child, blocks);
        }
      });
      
      // If section has direct text without tags
      const directText = Array.from(node.childNodes)
        .filter(n => n.nodeType === 3 && n.textContent?.trim())
        .map(n => n.textContent?.trim())
        .join(' ');
      
      if (directText && node.children.length === 0) {
         blocks.push({ type: 'paragraph', content: directText });
      }
      break;

    case 'note':
      blocks.push({
        type: 'note',
        noteType: node.getAttribute('type') || 'note',
        content: content
      });
      break;

    case 'ol':
    case 'ul':
      const items = Array.from(node.querySelectorAll('li')).map(li => getInlineXml(li));
      blocks.push({
        type: nodeName === 'ol' ? 'ordered-list' : 'unordered-list',
        items
      });
      break;

    case 'codeblock':
      blocks.push({ type: 'codeblock', content: node.textContent?.trim() || '' });
      break;

    case 'steps':
      const steps: DitaStep[] = Array.from(node.querySelectorAll('step')).map(step => {
        const cmdNode = step.querySelector('cmd');
        const infoNode = step.querySelector('info');
        const substepsNode = step.querySelector('substeps');

        const cmd = cmdNode ? getInlineXml(cmdNode) : '';
        const info = infoNode ? getInlineXml(infoNode) : undefined;
        
        let substeps: string[] | undefined = undefined;
        if (substepsNode) {
          substeps = Array.from(substepsNode.querySelectorAll('substep > cmd'))
            .map(subCmd => getInlineXml(subCmd));
        }

        return { cmd, info, substeps };
      });

      if (steps.length > 0) {
        blocks.push({ type: 'steps', steps });
      }
      break;

    default:
      // Ignore unknown tags for now
      break;
  }
};

export const parseDitaXml = (xmlString: string): DitaBlock[] => {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');

    const parseError = doc.querySelector('parsererror');
    if (parseError) {
      console.error('XML Parse Error:', parseError.textContent);
      return [{ type: 'unknown', rawXml: xmlString }];
    }

    const blocks: DitaBlock[] = [];

    // 1. Extract Header Info
    const title = doc.querySelector('title');
    if (title?.textContent) {
      blocks.push({ type: 'title', content: title.textContent.trim() });
    }

    const shortdesc = doc.querySelector('shortdesc');
    if (shortdesc?.textContent) {
      blocks.push({ type: 'shortdesc', content: shortdesc.textContent.trim() });
    }

    // 2. Extract Body Content
    const body = doc.querySelector('conbody, taskbody, refbody');
    if (body) {
      Array.from(body.children).forEach(child => {
        processNode(child, blocks);
      });
    }

    return blocks;
  } catch (error) {
    console.error('Error parsing XML:', error);
    return [{ type: 'unknown', rawXml: xmlString }];
  }
};

// Helper to escape XML special characters, but preserve recognized tags
const serializeContent = (content: string): string => {
  if (!content) return '';
  
  // Regex to split by allowed tags: <tag>...</tag> or self-closing
  // We use capturing group to keep the delimiters in the split result
  const regex = /(<\/?(?:xref|uicontrol|b|i)[^>]*>)/g;
  
  const parts = content.split(regex);
  
  return parts.map(part => {
    // If it is one of our allowed tags, return as is
    if (regex.test(part)) return part;
    
    // Otherwise escape special chars
    return part.replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
  }).join('');
};

const blockToXml = (block: DitaBlock, indent: number): string => {
  const spaces = ' '.repeat(indent);
  switch (block.type) {
    case 'paragraph':
      return `${spaces}<p>${serializeContent(block.content || '')}</p>\n`;
    case 'context':
      return `${spaces}<context>\n${spaces}  <p>${serializeContent(block.content || '')}</p>\n${spaces}</context>\n`;
    case 'result':
      return `${spaces}<result>\n${spaces}  <p>${serializeContent(block.content || '')}</p>\n${spaces}</result>\n`;
    case 'prereq':
      return `${spaces}<prereq>\n${spaces}  <p>${serializeContent(block.content || '')}</p>\n${spaces}</prereq>\n`;
    case 'note':
      return `${spaces}<note type="${block.noteType || 'note'}">${serializeContent(block.content || '')}</note>\n`;
    case 'ordered-list':
      return `${spaces}<ol>\n${(block.items || []).map(i => `${spaces}  <li>${serializeContent(i)}</li>`).join('\n')}\n${spaces}</ol>\n`;
    case 'unordered-list':
      return `${spaces}<ul>\n${(block.items || []).map(i => `${spaces}  <li>${serializeContent(i)}</li>`).join('\n')}\n${spaces}</ul>\n`;
    case 'codeblock':
      // codeblock content is usually raw text, so we might not want to serialize nested tags inside it, 
      // but standard XML escaping applies.
      return `${spaces}<codeblock>${serializeContent(block.content || '')}</codeblock>\n`;
    case 'steps':
      let stepsXml = `${spaces}<steps>\n`;
      block.steps?.forEach(step => {
        stepsXml += `${spaces}  <step>\n`;
        stepsXml += `${spaces}    <cmd>${serializeContent(step.cmd)}</cmd>\n`;
        if (step.info) {
          stepsXml += `${spaces}    <info><p>${serializeContent(step.info)}</p></info>\n`;
        }
        if (step.substeps && step.substeps.length > 0) {
          stepsXml += `${spaces}    <substeps>\n`;
          step.substeps.forEach(sub => {
            stepsXml += `${spaces}      <substep><cmd>${serializeContent(sub)}</cmd></substep>\n`;
          });
          stepsXml += `${spaces}    </substeps>\n`;
        }
        stepsXml += `${spaces}  </step>\n`;
      });
      stepsXml += `${spaces}</steps>\n`;
      return stepsXml;
    default:
      return '';
  }
};

export const generateDitaXml = (blocks: DitaBlock[], originalXml?: string): string => {
  // 1. Determine Root and Body tags
  let rootTag = 'topic';
  let bodyTag = 'body';
  let title = 'Untitled';
  let shortdesc = '';

  // Heuristic: Check for task-specific blocks to auto-detect task type
  const hasTaskBlocks = blocks.some(b => ['context', 'result', 'prereq', 'steps'].includes(b.type));
  if (hasTaskBlocks) {
    rootTag = 'task';
    bodyTag = 'taskbody';
  } else if (originalXml) {
    const match = originalXml.match(/<(\w+)(?:\s+[^>]*)?>/);
    if (match && ['concept', 'task', 'reference', 'topic'].includes(match[1])) {
      rootTag = match[1];
      const bodyMap: Record<string, string> = {
        concept: 'conbody',
        task: 'taskbody',
        reference: 'refbody',
        topic: 'body'
      };
      bodyTag = bodyMap[rootTag] || 'body';
    }
  }

  // 2. Separate Header and Body blocks
  const headerBlocks = blocks.filter(b => b.type === 'title' || b.type === 'shortdesc');
  const bodyBlocks = blocks.filter(b => b.type !== 'title' && b.type !== 'shortdesc');

  // Extract title and shortdesc content
  const titleBlock = headerBlocks.find(b => b.type === 'title');
  if (titleBlock?.content) title = titleBlock.content;

  const shortDescBlock = headerBlocks.find(b => b.type === 'shortdesc');
  if (shortDescBlock?.content) shortdesc = shortDescBlock.content;

  // 3. Build XML
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<!DOCTYPE ${rootTag} PUBLIC "-//OASIS//DTD DITA ${rootTag.charAt(0).toUpperCase() + rootTag.slice(1)}//EN" "${rootTag}.dtd">\n`;
  xml += `<${rootTag} id="generated_id">\n`;
  xml += `  <title>${serializeContent(title)}</title>\n`;
  if (shortdesc) {
    xml += `  <shortdesc>${serializeContent(shortdesc)}</shortdesc>\n`;
  }

  xml += `  <${bodyTag}>\n`;

  let currentSectionOpen = false;

  for (let i = 0; i < bodyBlocks.length; i++) {
    const block = bodyBlocks[i];

    if (block.type === 'section-title') {
      // If we are already in a section, close it first
      if (currentSectionOpen) {
        xml += `    </section>\n`;
      }
      // Start new section
      xml += `    <section>\n      <title>${serializeContent(block.content || '')}</title>\n`;
      currentSectionOpen = true;
    } else {
      // If we are in a section, indent more
      const indent = currentSectionOpen ? 6 : 4;
      xml += blockToXml(block, indent);
    }
  }

  // Close any open section
  if (currentSectionOpen) {
    xml += `    </section>\n`;
  }

  xml += `  </${bodyTag}>\n`;
  xml += `</${rootTag}>`;

  return xml;
};


/**
 * Extracts plain text from an array of DitaBlocks for readability analysis.
 * This ensures a consistent text source for all calculations.
 */
export const extractTextFromBlocks = (blocks: DitaBlock[]): string => {
  return blocks.map(b => {
    let t = b.content || '';
    // Strip inline XML tags (like <xref>, <b>) to get pure text
    t = t.replace(/<[^>]+>/g, '');
    
    if (b.items) {
      t += ' ' + b.items.map(i => i.replace(/<[^>]+>/g, '')).join(' ');
    }
    if (b.steps) {
      t += ' ' + b.steps.map(s => {
          const cmd = s.cmd.replace(/<[^>]+>/g, '');
          const info = (s.info || '').replace(/<[^>]+>/g, '');
          const subs = (s.substeps || []).map(sub => sub.replace(/<[^>]+>/g, '')).join(' ');
          return `${cmd} ${info} ${subs}`;
      }).join(' ');
    }
    return t;
  }).join('\n');
};