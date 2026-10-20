/**
 * XML and DITA Utility Functions
 *
 * This module provides a comprehensive collection of utility functions for working with
 * XML and DITA (Darwin Information Typing Architecture) content within the DITA Architect project.
 *
 * Main functionalities include:
 * - XML escaping and validation
 * - DITA topic ID extraction and validation
 * - Element recognition and validation against DITA standards
 * - Semantic XML comparison and formatting detection
 * - DITA topic type conversion (task, concept, reference)
 * - Time formatting utilities
 */
import { RECOGNIZED_ELEMENTS, STRUCTURAL_CONTAINERS } from '../constants/heretto';
// ── XML Formatting ──────────────────────────────────────────────────────────

type XmlToken = { type: 'opening' | 'closing' | 'self-closing' | 'text' | 'comment' | 'pi' | 'doctype'; text: string };

function tokenizeXml(xml: string): XmlToken[] {
  const tokens: XmlToken[] = [];
  let i = 0;

  while (i < xml.length) {
    if (xml[i] === '<') {
      // Comment
      if (xml.startsWith('<!--', i)) {
        const end = xml.indexOf('-->', i + 4);
        const ce = end === -1 ? xml.length : end + 3;
        tokens.push({ type: 'comment', text: xml.substring(i, ce) });
        i = ce; continue;
      }
      // PI
      if (xml.startsWith('<?', i)) {
        const end = xml.indexOf('?>', i + 2);
        const pe = end === -1 ? xml.length : end + 2;
        tokens.push({ type: 'pi', text: xml.substring(i, pe) });
        i = pe; continue;
      }
      // DOCTYPE
      if (xml.startsWith('<!', i)) {
        const end = xml.indexOf('>', i + 2);
        const de = end === -1 ? xml.length : end + 1;
        tokens.push({ type: 'doctype', text: xml.substring(i, de) });
        i = de; continue;
      }
      // Tag — advance past quotes
      let j = i + 1;
      while (j < xml.length && xml[j] !== '>') {
        if (xml[j] === '"') { j = xml.indexOf('"', j + 1); if (j === -1) j = xml.length; else j++; }
        else if (xml[j] === "'") { j = xml.indexOf("'", j + 1); if (j === -1) j = xml.length; else j++; }
        else j++;
      }
      const tag = xml.substring(i, j + 1);
      if (tag.startsWith('</')) tokens.push({ type: 'closing', text: tag });
      else if (tag.endsWith('/>')) tokens.push({ type: 'self-closing', text: tag });
      else tokens.push({ type: 'opening', text: tag });
      i = j + 1;
    } else {
      let j = i;
      while (j < xml.length && xml[j] !== '<') j++;
      tokens.push({ type: 'text', text: xml.substring(i, j) });
      i = j;
    }
  }
  return tokens;
}

// Inline DITA elements that must stay on the same line as surrounding text
const INLINE_ELEMENTS = new Set([
  'ph', 'codeph', 'b', 'i', 'strong', 'em', 'xref', 'uicontrol', 'term',
  'keyword', 'filepath', 'varname', 'cmdname', 'msgph', 'menucascade',
  'wintitle', 'fn', 'cite', 'q', 'tm', 'option', 'parmname', 'apiname',
  'userinput', 'systemoutput', 'synph', 'abbreviated-form', 'indexterm',
  'boolean', 'state',
]);

function getTokenTagName(tok: XmlToken): string {
  const match = tok.text.match(/^<\/?([a-zA-Z][\w.-]*)/);
  return match ? match[1].toLowerCase() : '';
}

/** Merge runs of text + inline elements into single text tokens so the
 *  formatter keeps them on one line instead of splitting across lines. */
function mergeInlineRuns(tokens: XmlToken[]): XmlToken[] {
  const result: XmlToken[] = [];
  let i = 0;

  while (i < tokens.length) {
    const tok = tokens[i];
    const isText = tok.type === 'text';
    const isInlineOpen = tok.type === 'opening' && INLINE_ELEMENTS.has(getTokenTagName(tok));
    const isInlineSelf = tok.type === 'self-closing' && INLINE_ELEMENTS.has(getTokenTagName(tok));

    if (isText || isInlineOpen || isInlineSelf) {
      // Try to collect a run of text + inline elements
      let j = i;
      let depth = 0;
      let merged = '';
      let hasInline = false;

      while (j < tokens.length) {
        const t = tokens[j];
        const tn = getTokenTagName(t);

        if (t.type === 'text') {
          merged += t.text;
          j++;
        } else if (t.type === 'opening' && INLINE_ELEMENTS.has(tn)) {
          merged += t.text.trim();
          depth++;
          hasInline = true;
          j++;
        } else if (t.type === 'closing' && INLINE_ELEMENTS.has(tn) && depth > 0) {
          merged += t.text.trim();
          depth--;
          j++;
        } else if (t.type === 'self-closing' && INLINE_ELEMENTS.has(tn)) {
          merged += t.text.trim();
          hasInline = true;
          j++;
        } else {
          break;
        }
      }

      if (hasInline && depth === 0) {
        result.push({ type: 'text', text: merged });
        i = j;
      } else {
        // Unbalanced or no inline elements — emit tokens individually
        for (let k = i; k < j; k++) {
          result.push(tokens[k]);
        }
        i = j;
      }
    } else {
      result.push(tok);
      i++;
    }
  }
  return result;
}

export function formatXml(xml: string): string {
  const indent = '  ';
  const tokens = mergeInlineRuns(tokenizeXml(xml.trim()));
  let result = '';
  let level = 0;

  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];

    if (tok.type === 'pi' || tok.type === 'doctype') {
      result += tok.text.trim() + '\n';
    } else if (tok.type === 'comment') {
      result += indent.repeat(level) + tok.text.trim() + '\n';
    } else if (tok.type === 'closing') {
      level = Math.max(0, level - 1);
      result += indent.repeat(level) + tok.text.trim() + '\n';
    } else if (tok.type === 'self-closing') {
      result += indent.repeat(level) + tok.text.trim() + '\n';
    } else if (tok.type === 'opening') {
      // Inline collapse: <tag>text</tag> on one line
      if (
        i + 2 < tokens.length &&
        tokens[i + 1].type === 'text' &&
        tokens[i + 2].type === 'closing'
      ) {
        const text = tokens[i + 1].text.trim();
        result += indent.repeat(level) + tok.text.trim() + text + tokens[i + 2].text.trim() + '\n';
        i += 2;
      } else {
        result += indent.repeat(level) + tok.text.trim() + '\n';
        level++;
      }
    } else if (tok.type === 'text') {
      const trimmed = tok.text.trim();
      if (trimmed) {
        result += indent.repeat(level) + trimmed + '\n';
      }
    }
  }
  return result.trimEnd();
}

export const escapeXml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export const getTopicId = (xml: string): string | null => {
  if (!xml || !xml.trim()) return null;
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  if (doc.querySelector('parsererror')) return null;
  const root = doc.documentElement;
  if (!root) return null;
  return root.getAttribute('id');
};

export const validateDitaXml = (content: string): { valid: boolean; error?: string } => {
  if (!content.trim()) return { valid: false, error: 'File is empty' };

  const parser = new DOMParser();
  const doc = parser.parseFromString(content, 'text/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    return { valid: false, error: 'Malformed XML: ' + (parseError.textContent || 'parse error') };
  }

  const root = doc.documentElement;
  const rootTag = root.tagName.toLowerCase();
  const validRoots = ['task', 'concept', 'reference', 'topic', 'troubleshooting'];
  if (!validRoots.includes(rootTag)) {
    return { valid: false, error: `Root element <${rootTag}> is not a valid DITA topic type` };
  }

  return { valid: true };
};

export const findUnrecognizedElements = (xmlString: string): string[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'text/xml');
  if (doc.querySelector('parsererror')) return [];

  const unrecognized = new Set<string>();
  const walk = (node: Element) => {
    const tag = node.tagName.toLowerCase();
    if (!RECOGNIZED_ELEMENTS.has(tag) && !STRUCTURAL_CONTAINERS.has(tag)) {
      unrecognized.add(tag);
    }
    for (const child of Array.from(node.children)) {
      walk(child);
    }
  };
  walk(doc.documentElement);
  return Array.from(unrecognized).sort();
};

/**
 * Strip Heretto-injected DITA specialization class attributes (e.g.
 * class="- topic/topic concept/concept ") — Heretto adds them to every element
 * on ingest, causing false 'different' comparisons and unreadable diffs even
 * when the content matches. Strip from both sides before comparing/diffing.
 */
export const stripHerettoClassAttrs = (xml: string): string => xml.replace(/\s+class="[^"]*"/g, '');

/**
 * Compare two XML strings semantically, ignoring whitespace and attribute order.
 * Returns 'identical' if strings match, 'formatting' if only formatting differs,
 * or 'different' if the content is structurally different.
 */
export const compareXml = (a: string, b: string): 'identical' | 'formatting' | 'different' => {
  if (a.trim() === b.trim()) return 'identical';

  // Tier 1: normalize through formatXml
  try {
    if (formatXml(a) === formatXml(b)) return 'formatting';
  } catch { /* fall through to DOM comparison */ }

  // Tier 2: DOM structural comparison
  const parser = new DOMParser();
  const docA = parser.parseFromString(a, 'text/xml');
  const docB = parser.parseFromString(b, 'text/xml');
  if (docA.querySelector('parsererror') || docB.querySelector('parsererror')) return 'different';

  const nodesEqual = (na: Node, nb: Node): boolean => {
    if (na.nodeType !== nb.nodeType) return false;

    if (na.nodeType === Node.TEXT_NODE) {
      return (na.textContent || '').trim() === (nb.textContent || '').trim();
    }

    if (na.nodeType === Node.ELEMENT_NODE) {
      const ea = na as Element, eb = nb as Element;
      if (ea.tagName !== eb.tagName) return false;

      // Compare attributes (order-independent)
      if (ea.attributes.length !== eb.attributes.length) return false;
      for (let i = 0; i < ea.attributes.length; i++) {
        const attr = ea.attributes[i];
        if (eb.getAttribute(attr.name) !== attr.value) return false;
      }

      // Compare children (skip whitespace-only text nodes)
      const childrenA = Array.from(ea.childNodes).filter(n => !(n.nodeType === Node.TEXT_NODE && !(n.textContent || '').trim()));
      const childrenB = Array.from(eb.childNodes).filter(n => !(n.nodeType === Node.TEXT_NODE && !(n.textContent || '').trim()));
      if (childrenA.length !== childrenB.length) return false;
      return childrenA.every((child, i) => nodesEqual(child, childrenB[i]));
    }

    return true; // comments, processing instructions, etc.
  };

  return nodesEqual(docA.documentElement, docB.documentElement) ? 'formatting' : 'different';
};

import type { DitaTopicType } from '../constants/dita';
export type { DitaTopicType };

/** Extract `<title>` text from the root topic element. Returns null if the XML is invalid or has no title. */
export function getTitleFromXml(xml: string): string | null {
  if (!xml || !xml.trim()) return null;
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'text/xml');
  if (doc.querySelector('parsererror')) return null;
  const titleEl = doc.documentElement?.querySelector(':scope > title');
  return titleEl?.textContent?.trim() || null;
}

/** Sanitize a title to a filename-safe slug (lowercase, hyphens). E.g. "My FAQ Page" → "my-faq-page" */
export function slugifyToFilename(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'topic';
}

/** Sanitize a title to an XML ID-safe slug (lowercase, underscores). E.g. "My FAQ Page" → "my_faq_page" */
export function slugifyToId(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'topic';
}

const DEFAULT_TOPIC_IDS = new Set(['new_task', 'new_concept', 'new_reference']);

/**
 * If the root element's `id` attribute is still a template default, replace it with `newId`.
 * Returns the original XML unchanged if the ID has already been customized.
 */
export function withUpdatedTopicId(xml: string, newId: string): string {
  const idMatch = xml.match(/(<(?:task|concept|reference|topic)[^>]*\bid=")([^"]+)"/);
  if (!idMatch || !DEFAULT_TOPIC_IDS.has(idMatch[2])) return xml;
  return xml.replace(idMatch[0], `${idMatch[1]}${newId}"`);
}

const BODY_TAG_MAP: Record<string, string> = {
  task: 'taskbody',
  concept: 'conbody',
  reference: 'refbody',
  topic: 'body',
};

const DOCTYPE_MAP: Record<DitaTopicType, string> = {
  task: '<!DOCTYPE task PUBLIC "-//OASIS//DTD DITA Task//EN" "task.dtd">',
  concept: '<!DOCTYPE concept PUBLIC "-//OASIS//DTD DITA Concept//EN" "concept.dtd">',
  reference: '<!DOCTYPE reference PUBLIC "-//OASIS//DTD DITA Reference//EN" "reference.dtd">',
};

/**
 * Convert task-specific elements to generic block equivalents:
 *   <steps>/<step>/<cmd>  →  <ol>/<li>
 *   <prereq>              →  <p>
 */
function convertTaskElementsInPlace(parent: Element, doc: Document): void {
  const steps = Array.from(parent.querySelectorAll('steps'));
  for (const stepsEl of steps) {
    const ol = doc.createElement('ol');
    const stepChildren = Array.from(stepsEl.querySelectorAll('step'));
    for (const step of stepChildren) {
      const li = doc.createElement('li');
      const cmd = step.querySelector('cmd');
      if (cmd) {
        while (cmd.firstChild) li.appendChild(cmd.firstChild);
      } else {
        while (step.firstChild) li.appendChild(step.firstChild);
      }
      ol.appendChild(li);
    }
    stepsEl.parentNode?.replaceChild(ol, stepsEl);
  }

  const prereqs = Array.from(parent.querySelectorAll('prereq'));
  for (const prereq of prereqs) {
    const p = doc.createElement('p');
    while (prereq.firstChild) p.appendChild(prereq.firstChild);
    prereq.parentNode?.replaceChild(p, prereq);
  }
}

/**
 * Convert a DITA XML string from its current topic type to `targetType`.
 *
 * Returns `{ ok: true, xml: string }` on success, or `{ ok: false, reason: string }`
 * if the input is invalid or already the target type.
 */
export function convertDitaTopic(
  xmlContent: string,
  targetType: DitaTopicType,
): { ok: true; xml: string } | { ok: false; reason: string } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'text/xml');
  const root = doc.documentElement;

  if (!root || root.tagName === 'html' || root.tagName === 'parsererror') {
    return { ok: false, reason: 'invalid-xml' };
  }

  const currentType = root.tagName.toLowerCase();
  if (currentType === targetType) {
    return { ok: false, reason: 'same-type' };
  }

  const newRoot = doc.createElement(targetType);
  Array.from(root.attributes).forEach(attr => {
    newRoot.setAttribute(attr.name, attr.value);
  });

  const oldBodyTag = BODY_TAG_MAP[currentType] ?? 'body';
  const newBodyTag = BODY_TAG_MAP[targetType];

  let bodyFound = false;
  while (root.firstChild) {
    const child = root.firstChild;
    if (
      child.nodeType === Node.ELEMENT_NODE &&
      (child as Element).tagName.toLowerCase() === oldBodyTag
    ) {
      bodyFound = true;
      const newBody = doc.createElement(newBodyTag);
      while (child.firstChild) {
        newBody.appendChild(child.firstChild);
      }
      if (currentType === 'task' && targetType !== 'task') {
        convertTaskElementsInPlace(newBody, doc);
      }
      newRoot.appendChild(newBody);
      root.removeChild(child);
    } else {
      newRoot.appendChild(child);
    }
  }

  // If the source had no body element, append an empty one so the converted
  // document remains structurally valid.
  if (!bodyFound) {
    const newBody = doc.createElement(newBodyTag);
    // If converting to task, ensure required <steps> element exists
    if (targetType === 'task') {
      const steps = doc.createElement('steps');
      const step = doc.createElement('step');
      const cmd = doc.createElement('cmd');
      cmd.textContent = 'Add your task step here';
      step.appendChild(cmd);
      steps.appendChild(step);
      newBody.appendChild(steps);
    }
    newRoot.appendChild(newBody);
  }

  // If converting to task and body exists but no steps element, add one
  if (targetType === 'task' && bodyFound) {
    const taskBody = newRoot.querySelector(newBodyTag);
    if (taskBody && !taskBody.querySelector('steps, steps-unordered, steps-informal')) {
      const steps = doc.createElement('steps');
      const step = doc.createElement('step');
      const cmd = doc.createElement('cmd');
      cmd.textContent = 'Add your task step here';
      step.appendChild(cmd);
      steps.appendChild(step);
      taskBody.appendChild(steps);
    }
  }

  // FR-049: title/shortdesc are empty until the writer types, so there is no
  // template prose to swap between topic types any more.

  const serializer = new XMLSerializer();
  const newXml =
    `<?xml version="1.0" encoding="UTF-8"?>\n${DOCTYPE_MAP[targetType]}\n` +
    serializer.serializeToString(newRoot);

  return { ok: true, xml: newXml };
}

export function extractXmlIds(xmlString: string): Set<string> {
  const ids = new Set<string>();
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlString, 'text/xml');

    if (doc.querySelector('parsererror')) {
      return ids;
    }

    // Walk through all elements and collect ID attributes
    const walk = (element: Element) => {
      const id = element.getAttribute('id');
      if (id) {
        ids.add(id);
      }

      // Recursively process child elements
      for (const child of Array.from(element.children)) {
        walk(child);
      }
    };

    if (doc.documentElement) {
      walk(doc.documentElement);
    }
  } catch (error) {
    console.warn('Error extracting XML IDs:', error);
  }

  return ids;
}

export const formatRelativeTime = (date: Date): string => {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 0) return 'just now';
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};
