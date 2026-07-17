import { validateDitaXml } from './xml-utils';
import { ALLOWED_FRAGMENT_BLOCK_TAGS } from '../sync/parseXmlToLexical';

/**
 * FR-045 — deterministic XML-level insertion for the API review surface.
 *
 * Computes `proposedXml` from `currentXml` by splicing a block fragment into
 * the raw document STRING (append before the closing body tag, or replace the
 * element carrying `replaceId`). No DOM re-serialization of the document —
 * XMLSerializer normalizes entities and attribute forms across the whole file,
 * which would flood the review diff with noise and churn Heretto on accept.
 * Untouched content stays byte-identical (Gate 1 ethos).
 *
 * The fragment itself IS serialized through XMLSerializer (it is new,
 * machine-generated content with no byte-stability contract).
 */

export type ProposedXmlResult = { proposedXml: string } | { error: string };

const CLOSING_BODY_RE = /<\/(conbody|taskbody|refbody|body)>/g;

const escapeRegExp = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Parse + allowlist-check the fragment; returns serialized top-level blocks (section unwrapped). */
function parseFragmentBlocks(fragmentXml: string): { blocks: string[] } | { error: string } {
  if (!fragmentXml.trim()) return { error: 'Fragment is empty' };

  const doc = new DOMParser().parseFromString(`<root>${fragmentXml}</root>`, 'application/xml');
  if (doc.querySelector('parsererror')) return { error: 'Fragment is not well-formed XML' };

  const root = doc.querySelector('root');
  const topChildren = root ? Array.from(root.children) : [];
  if (topChildren.length === 0) return { error: 'Fragment contains no elements' };

  for (const child of topChildren) {
    if (!ALLOWED_FRAGMENT_BLOCK_TAGS.has(child.tagName.toLowerCase())) {
      return { error: `Disallowed top-level element <${child.tagName}>` };
    }
  }

  const serializer = new XMLSerializer();
  const blocks: string[] = [];
  for (const child of topChildren) {
    if (child.tagName.toLowerCase() === 'section') {
      // Documented API contract: <section> children are unwrapped before insertion.
      for (const grandchild of Array.from(child.children)) {
        blocks.push(serializer.serializeToString(grandchild));
      }
    } else {
      blocks.push(serializer.serializeToString(child));
    }
  }
  if (blocks.length === 0) return { error: 'Fragment contains no insertable elements' };
  return { blocks };
}

/** Indent every line of a serialized block with `indent`. */
function indentBlock(block: string, indent: string): string {
  return block
    .split('\n')
    .map(line => (line.trim() ? indent + line : line))
    .join('\n');
}

/** Start-of-line index and leading whitespace for the position `at`. */
function lineContext(xml: string, at: number): { lineStart: number; indent: string } {
  const lineStart = xml.lastIndexOf('\n', at - 1) + 1;
  const prefix = xml.slice(lineStart, at);
  return { lineStart, indent: /^\s*$/.test(prefix) ? prefix : '' };
}

function appendToBody(currentXml: string, blocks: string[]): ProposedXmlResult {
  let lastMatch: RegExpExecArray | null = null;
  CLOSING_BODY_RE.lastIndex = 0;
  for (let m = CLOSING_BODY_RE.exec(currentXml); m; m = CLOSING_BODY_RE.exec(currentXml)) {
    lastMatch = m;
  }
  if (!lastMatch) return { error: 'No <conbody>/<taskbody>/<refbody>/<body> found in document' };

  const { lineStart, indent: closeIndent } = lineContext(currentXml, lastMatch.index);
  const childIndent = closeIndent + '  ';
  const insertion = blocks.map(b => indentBlock(b, childIndent)).join('\n') + '\n';

  // Closing tag on its own line: insert whole lines above it. Otherwise
  // (content and closing tag share a line) break the line before the tag.
  if (/^\s*$/.test(currentXml.slice(lineStart, lastMatch.index))) {
    return { proposedXml: currentXml.slice(0, lineStart) + insertion + currentXml.slice(lineStart) };
  }
  return {
    proposedXml:
      currentXml.slice(0, lastMatch.index) + '\n' + insertion + closeIndent + currentXml.slice(lastMatch.index),
  };
}

function replaceById(currentXml: string, blocks: string[], replaceId: string): ProposedXmlResult {
  const doc = new DOMParser().parseFromString(currentXml, 'application/xml');
  const withId = Array.from(doc.getElementsByTagName('*')).filter(el => el.getAttribute('id') === replaceId);
  if (withId.length === 0) return { error: `No element with id="${replaceId}" found` };
  if (withId.length > 1) return { error: `Multiple elements with id="${replaceId}" — cannot replace safely` };
  const tag = withId[0].tagName;

  // Locate the element's opening tag in the raw string, then walk same-tag
  // nesting depth to find its full extent.
  const openRe = new RegExp(
    `<${escapeRegExp(tag)}(?=[\\s/>])[^>]*\\bid="${escapeRegExp(replaceId)}"[^>]*>`,
    'g',
  );
  const opens: RegExpExecArray[] = [];
  for (let m = openRe.exec(currentXml); m; m = openRe.exec(currentXml)) opens.push(m);
  if (opens.length !== 1) {
    return { error: `Could not locate <${tag} id="${replaceId}"> unambiguously in the document text` };
  }
  const open = opens[0];

  let extentEnd: number;
  if (open[0].endsWith('/>')) {
    extentEnd = open.index + open[0].length;
  } else {
    const tokenRe = new RegExp(`<${escapeRegExp(tag)}(?=[\\s/>])[^>]*>|</${escapeRegExp(tag)}>`, 'g');
    tokenRe.lastIndex = open.index + open[0].length;
    let depth = 1;
    extentEnd = -1;
    for (let t = tokenRe.exec(currentXml); t; t = tokenRe.exec(currentXml)) {
      if (t[0].startsWith('</')) {
        depth--;
        if (depth === 0) {
          extentEnd = t.index + t[0].length;
          break;
        }
      } else if (!t[0].endsWith('/>')) {
        depth++;
      }
    }
    if (extentEnd === -1) return { error: `Malformed document: no closing </${tag}> for id="${replaceId}"` };
  }

  const { indent } = lineContext(currentXml, open.index);
  const replacement = blocks
    .map((b, i) => (i === 0 ? indentBlock(b, indent).slice(indent.length) : indentBlock(b, indent)))
    .join('\n');
  return {
    proposedXml: currentXml.slice(0, open.index) + replacement + currentXml.slice(extentEnd),
  };
}

/**
 * Compute the proposed document for an API insertion. Pure and synchronous:
 * validation runs BEFORE any success is reported (no 50 ms contract).
 */
export function computeProposedXml(
  currentXml: string,
  fragmentXml: string,
  replaceId?: string,
): ProposedXmlResult {
  const docCheck = new DOMParser().parseFromString(currentXml, 'application/xml');
  if (docCheck.querySelector('parsererror')) {
    return { error: 'Current document is not well-formed XML' };
  }

  const parsed = parseFragmentBlocks(fragmentXml);
  if ('error' in parsed) return parsed;

  const result = replaceId
    ? replaceById(currentXml, parsed.blocks, replaceId)
    : appendToBody(currentXml, parsed.blocks);
  if ('error' in result) return result;

  const validation = validateDitaXml(result.proposedXml);
  if (!validation.valid) {
    return { error: `Proposed document failed validation: ${validation.error ?? 'unknown error'}` };
  }
  return result;
}
