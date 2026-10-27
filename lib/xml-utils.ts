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
//
// formatXml backs the Format button and Monaco's Format Document. BUG-45: it
// must never change text. The old formatter trimmed every text run and put
// any element missing from an inline list on its own line, so
// "H<sub>2</sub>O" read "H 2 O", review PIs mid-sentence doubled spaces, and a
// <codeblock> lost its first-line indentation. The rule now: whitespace moves
// only between the children of an element that holds no text of its own and
// whose element children are all known block elements; every other element
// is copied verbatim, byte for byte, on one line. An element we do not know
// can only make the output less tidy, never different.

/** Elements that never sit in running text, so the whitespace around them
 *  inside a text-free parent carries no meaning. */
const BLOCK_ELEMENTS = new Set([
  // topics and their top level
  'concept', 'task', 'reference', 'topic', 'troubleshooting', 'glossentry', 'glossgroup',
  'title', 'titlealts', 'navtitle', 'searchtitle', 'shortdesc', 'abstract', 'prolog', 'related-links',
  'conbody', 'taskbody', 'refbody', 'body', 'troublebody', 'glossBody', 'glossdef', 'glossterm',
  // prolog
  'metadata', 'author', 'source', 'publisher', 'copyright', 'copyryear', 'copyrholder', 'critdates',
  'created', 'revised', 'permissions', 'audience', 'category', 'keywords', 'prodinfo', 'prodname',
  'vrmlist', 'vrm', 'brand', 'series', 'platform', 'prognum', 'featnum', 'component', 'othermeta', 'resourceid',
  // body blocks
  'section', 'sectiondiv', 'bodydiv', 'example', 'p', 'note', 'lq', 'dl', 'dlhead', 'dthd', 'ddhd',
  'dlentry', 'dt', 'dd', 'ul', 'ol', 'sl', 'li', 'sli', 'fig', 'figgroup', 'codeblock', 'pre', 'lines',
  'msgblock', 'screen', 'object', 'table', 'tgroup', 'colspec', 'thead', 'tbody', 'row', 'entry',
  'simpletable', 'sthead', 'strow', 'stentry', 'draft-comment', 'required-cleanup',
  // task
  'prereq', 'context', 'steps', 'steps-unordered', 'steps-informal', 'step', 'substeps', 'substep',
  'cmd', 'info', 'stepxmp', 'stepresult', 'steptroubleshooting', 'tutorialinfo', 'choices', 'choice',
  'choicetable', 'chhead', 'chrow', 'choptionhd', 'chdeschd', 'choption', 'chdesc', 'result', 'postreq',
  'tasktroubleshooting',
  // reference
  'refsyn', 'properties', 'prophead', 'proptypehd', 'propvaluehd', 'propdeschd', 'property',
  'proptype', 'propvalue', 'propdesc',
  // troubleshooting
  'condition', 'troubleSolution', 'cause', 'remedy', 'responsibleParty',
  // related links
  'link', 'linktext', 'desc', 'linkpool', 'linklist', 'linkinfo',
]);

/** Elements whose own whitespace is content: always copied verbatim. */
const PREFORMATTED_ELEMENTS = new Set(['codeblock', 'pre', 'lines', 'msgblock', 'screen']);

type FmtNode =
  | { kind: 'el'; name: string; start: number; end: number; open: string; close: string | null; attrs: string; children: FmtNode[] }
  | { kind: 'text'; raw: string }
  | { kind: 'other'; raw: string; cdata: boolean };

const FMT_TOKEN = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<!DOCTYPE(?:[^[>]|\[[^\]]*\])*>|<\/([^\s>]+)\s*>|<([^\s/>!?]+)((?:\s+[^\s=/>]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|[^<]+/y;

/** Parse into a node list; null on anything not well-formed (left unformatted). */
const parseForFormat = (xml: string): FmtNode[] | null => {
  const top: FmtNode[] = [];
  const stack: Array<Extract<FmtNode, { kind: 'el' }>> = [];
  const add = (n: FmtNode) => (stack.length ? stack[stack.length - 1].children : top).push(n);
  let pos = 0;
  while (pos < xml.length) {
    FMT_TOKEN.lastIndex = pos;
    const m = FMT_TOKEN.exec(xml);
    if (!m || m[0].length === 0) return null;
    const raw = m[0];
    const end = pos + raw.length;
    if (m[1] !== undefined) {
      const el = stack.pop();
      if (!el || el.name !== m[1]) return null;
      el.close = raw;
      el.end = end;
    } else if (m[2] !== undefined) {
      const el: Extract<FmtNode, { kind: 'el' }> = { kind: 'el', name: m[2], start: pos, end, open: raw, close: null, attrs: m[3], children: [] };
      add(el);
      if (!m[4]) stack.push(el);
    } else if (raw[0] === '<') {
      add({ kind: 'other', raw, cdata: raw.startsWith('<![CDATA[') });
    } else {
      add({ kind: 'text', raw });
    }
    pos = end;
  }
  return stack.length ? null : top;
};

const isBlockChild = (n: Extract<FmtNode, { kind: 'el' }>): boolean =>
  BLOCK_ELEMENTS.has(n.name) || (n.name === 'image' && /\splacement\s*=\s*["']break["']/.test(n.attrs));

/** True when the whitespace between this element's children carries no meaning. */
const canReindent = (el: Extract<FmtNode, { kind: 'el' }>): boolean =>
  el.close !== null &&
  el.children.length > 0 &&
  !PREFORMATTED_ELEMENTS.has(el.name) &&
  !/\sxml:space\s*=\s*["']preserve["']/.test(el.attrs) &&
  el.children.every(c =>
    c.kind === 'text' ? !c.raw.trim() : c.kind === 'el' ? isBlockChild(c) : !c.cdata);

export function formatXml(xml: string): string {
  const nodes = parseForFormat(xml);
  if (!nodes) return xml;
  const indent = '  ';
  const lines: string[] = [];
  const emit = (n: FmtNode, level: number) => {
    if (n.kind === 'text') {
      // Text reaches here only between top-level nodes (whitespace, by
      // well-formedness) or as a child of a re-indentable element (whitespace
      // too, by canReindent): it is the layout being replaced.
      if (n.raw.trim()) lines.push(indent.repeat(level) + n.raw);
      return;
    }
    if (n.kind === 'other') { lines.push(indent.repeat(level) + n.raw); return; }
    if (!canReindent(n)) { lines.push(indent.repeat(level) + xml.slice(n.start, n.end)); return; }
    lines.push(indent.repeat(level) + n.open);
    for (const c of n.children) emit(c, level + 1);
    lines.push(indent.repeat(level) + n.close);
  };
  for (const n of nodes) emit(n, 0);
  return lines.join('\n');
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
