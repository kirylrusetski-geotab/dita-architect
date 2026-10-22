import { $getRoot } from 'lexical';
import { TableCellHeaderStates } from '@lexical/table';
import type { NodeOriginMapType } from './nodeOriginMap';
import { reconcileInline, type ReconcileDeps, type ReconcileMode } from './inline-reconcile';
import { NOTE_BLOCK_TAGS, FMT_BOLD as RUN_BOLD, FMT_ITALIC as RUN_ITALIC, FMT_CODE as RUN_CODE } from './inline-units';
import { BLOCK_CHILD_TAGS } from './parseXmlToLexical';

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
  // Troubleshooting topics (ADR-009). Lowercase because the walk lowercases domTag.
  'condition', 'cause', 'remedy', 'troublesolution', 'steps-informal', 'steps-unordered',
]);

// ADR-009: containers the walk patches by recursion (parser stamps containerPath).
// ADR-011: matched by ordinal ("section#2"), never removed mid-walk, and removed
// by the final pass only when the parse produced editor nodes for them that the
// author has since deleted (provenance). An empty <cause/> or a
// <section conref="…"/> produced nothing, so it always survives.
// BUG-27: prereq/context/result/postreq join the container set whenever the
// parser routed them through the container path (block-child case) — see
// parseXmlToLexical.ts. The direct-text case never produces a containerPath,
// so it keeps matching via areTypesCompatible's taskBodyTags branch below.
const TROUBLE_CONTAINER_TAGS_LOWER = new Set(['troublesolution', 'condition', 'cause', 'remedy', 'steps-informal', 'prereq', 'context', 'result', 'postreq', 'section']);

// A task section is a container only in its block-child form (BUG-27) — the
// same rule the parser uses; in direct-text form it is a plain paragraph.
const TASK_SECTION_TAGS = new Set(['prereq', 'context', 'result', 'postreq']);
const isContainerEl = (el: Element): boolean => {
  const tag = el.tagName.toLowerCase();
  if (!TROUBLE_CONTAINER_TAGS_LOWER.has(tag)) return false;
  if (TASK_SECTION_TAGS.has(tag)) return Array.from(el.children).some(c => BLOCK_CHILD_TAGS.has(c.tagName.toLowerCase()));
  return true;
};

// FR-046 tripwire: tracked marks are resolved before serialization by design
// (sync suspended during suggesting mode). Warn once — not per node — if one
// ever reaches the serializer, so a broken invariant is visible without
// flooding the console.
let warnedTrackedTextReachedSerializer = false;
const warnTrackedTextReachedSerializer = (): void => {
  if (warnedTrackedTextReachedSerializer) return;
  warnedTrackedTextReachedSerializer = true;
  console.warn(
    '[FR-046] A tracked-change mark reached the serializer — marks should be accepted/rejected before serialization. Delete/split marks were skipped; insert marks were serialized as plain text.',
  );
};

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
    } else if (rootTag === 'troubleshooting') {
      bodyTag = 'troublebody';
      doctype = '<!DOCTYPE troubleshooting PUBLIC "-//OASIS//DTD DITA Troubleshooting//EN" "troubleshooting.dtd">';
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
/** One text run as DITA: plain, <codeph>, <b>, <i>, or <b><i>. Shared by the
 *  full-rewrite path below and the inline reconciler (ADR-010). */
const serializeTextRun = (text: string, fmt: number, doc: Document): Node => {
  if (fmt & RUN_CODE) {
    const codeph = doc.createElement('codeph');
    codeph.appendChild(doc.createTextNode(text));
    return codeph;
  }
  const isBold = (fmt & RUN_BOLD) !== 0;
  const isItalic = (fmt & RUN_ITALIC) !== 0;
  if (isBold && isItalic) {
    const b = doc.createElement('b');
    const i = doc.createElement('i');
    i.appendChild(doc.createTextNode(text));
    b.appendChild(i);
    return b;
  }
  if (isBold) {
    const b = doc.createElement('b');
    b.appendChild(doc.createTextNode(text));
    return b;
  }
  if (isItalic) {
    const i = doc.createElement('i');
    i.appendChild(doc.createTextNode(text));
    return i;
  }
  return doc.createTextNode(text);
};

const lexicalFmt = (child: any): number =>
  (child.hasFormat('bold') ? RUN_BOLD : 0) | (child.hasFormat('italic') ? RUN_ITALIC : 0) | (child.hasFormat('code') ? RUN_CODE : 0);

/**
 * Serialize one inline Lexical child into DOM nodes. The per-child rules live
 * here once; serializeInlineContent walks a node's children with them and the
 * reconciler emits only the changed run with them.
 */
const serializeInlineChild = (child: any, doc: Document, originMap?: NodeOriginMapType): Node[] => {
  const type = child.getType();
  // Read-only <info> preview (P2-26 Phase 2): visual-only, never serialized.
  // The original <info> DOM is left byte-stable by the patch path.
  if (type === 'dita-info-preview') return [];
  if (type === 'dita-container-boundary') return []; // ADR-009 visual-only marker
  // FR-046 defensive guard: tracked marks must be resolved (accepted or
  // rejected) before serialization — sync is suspended during suggesting
  // mode, so this path is unreachable in practice. If a mark does slip
  // through: delete/split marks are not document content (skip); insert
  // marks serialize as the plain text they carry (fall through below).
  if (type === 'tracked-text') {
    warnTrackedTextReachedSerializer();
    if (child.getMark().kind !== 'insert') return [];
  }
  if (type === 'text' || type === 'tracked-text') {
    const text = child.getTextContent();
    const origin = originMap?.get(child.getKey());
    if (origin?.inlineTag) {
      const el = doc.createElement(origin.inlineTag);
      if (origin.inlineAttrs) {
        Object.entries(origin.inlineAttrs).forEach(([k, v]) => el.setAttribute(k, v));
      }
      el.appendChild(doc.createTextNode(text));
      return [el];
    }
    return [serializeTextRun(text, lexicalFmt(child), doc)];
  }
  if (type === 'link') {
    const xref = doc.createElement('xref');
    // BUG-36: an <xref keyref> has no href; the LinkNode's URL is then '' and
    // writing it would invent href="" on every rewrite.
    const href = child.getURL();
    if (href) xref.setAttribute('href', href);
    const linkOrigin = originMap?.get(child.getKey());
    if (linkOrigin?.inlineAttrs) {
      Object.entries(linkOrigin.inlineAttrs).forEach(([k, v]) => xref.setAttribute(k, v));
    } else if (href) {
      xref.setAttribute('format', href.startsWith('http://') || href.startsWith('https://') ? 'html' : 'dita');
    }
    serializeInlineContent(child, doc, originMap).forEach(n => xref.appendChild(n));
    return [xref];
  }
  if (type === 'ditaphref') {
    if (child.getRefType() === 'info-chip') {
      return []; // Visual-only affordance chip — not serialized to XML
    }
    if (child.getRefType() === 'image') {
      const img = doc.createElement('image');
      img.setAttribute('href', child.getRefValue());
      const altText = child.getTextContent();
      if (altText) {
        const alt = doc.createElement('alt');
        alt.appendChild(doc.createTextNode(altText));
        img.appendChild(alt);
      }
      return [img];
    }
    const ph = doc.createElement('ph');
    ph.setAttribute(child.getRefType(), child.getRefValue());
    const origText = child.getTextContent();
    if (origText) ph.appendChild(doc.createTextNode(origText));
    return [ph];
  }
  return [doc.createTextNode(child.getTextContent())];
};

const serializeInlineContent = (lexicalNode: any, doc: Document, originMap?: NodeOriginMapType): Node[] => {
  const nodes: Node[] = [];
  if (!lexicalNode.getChildren) return nodes;
  lexicalNode.getChildren().forEach((child: any) => {
    serializeInlineChild(child, doc, originMap).forEach(n => nodes.push(n));
  });
  return nodes;
};

/** ADR-010: the reconciler's emitters, bound to a document. */
const reconcileDeps = (doc: Document, originMap?: NodeOriginMapType): ReconcileDeps => ({
  serializeChild: (child: any) => serializeInlineChild(child, doc, originMap),
  serializeTextRun: (text: string, fmt: number) => serializeTextRun(text, fmt, doc),
});

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

// ─── S2 (Session 4B): formatting-only edit detection ──────────────────────────
//
// A bold/italic/code toggle leaves the text identical, so the text+link-count
// comparison below reports "untouched" and the edit never reaches the XML.
// These helpers compare format-run signatures between the DOM element and the
// Lexical node — but ONLY over a provably-safe inline subset, because the
// failure asymmetry is stark: a missed toggle is an annoyance (today's bug); a
// spurious rewrite silently corrupts refs/attributes the serializer cannot
// recreate. Anything outside the subset bails to "no change detected":
//   - xref / ph / term / image / uicontrol / wintitle (refs, attrs, inlineTag
//     stamps — rewriting these is FR-046 marks-as-data territory),
//   - nested inline tags like <b><i>… (the parser flattens them to the OUTER
//     tag's format only, so flags can't faithfully express them),
//   - b/i/codeph carrying attributes, PIs, comments.
// Final guard: the two sides' concatenated run text must agree byte-for-byte;
// any divergence means the DOM mirror below drifted from the parser — bail
// rather than risk a rewrite built on a wrong model.

const FMT_BOLD = 1;
const FMT_ITALIC = 2;
const FMT_CODE = 4;

interface InlineRun { text: string; fmt: number }

const SAFE_INLINE_FMT: Record<string, number> = {
  b: FMT_BOLD,
  i: FMT_ITALIC,
  codeph: FMT_CODE,
};

/**
 * Build format runs from a DOM element's inline content, mirroring exactly what
 * parseTextNodes would produce in Lexical: newline-collapse on text nodes (raw
 * textContent for inline elements), then edge-trim of the first/last run —
 * including the parser's quirk of dropping the format flag when an edge trim
 * rewrites the node. Returns null (bail) on anything outside the safe subset.
 */
const buildDomInlineRuns = (domEl: Element): InlineRun[] | null => {
  const runs: InlineRun[] = [];
  for (const child of Array.from(domEl.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      let text = child.textContent || '';
      if (!text) continue;
      text = text.replace(/[ \t]*\n[ \t\n]*/g, ' ');
      if (text) runs.push({ text, fmt: 0 });
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;
      const fmt = SAFE_INLINE_FMT[el.tagName.toLowerCase()];
      if (fmt === undefined) return null;
      if (el.attributes.length > 0) return null;
      if (Array.from(el.childNodes).some(c => c.nodeType !== Node.TEXT_NODE)) return null;
      runs.push({ text: el.textContent || '', fmt });
    } else {
      return null; // PI, comment, CDATA — outside the modeled subset
    }
  }
  if (runs.length > 0) {
    const first = runs[0];
    const trimmed = first.text.replace(/^\s+/, '');
    if (!trimmed) runs.shift();
    else if (trimmed !== first.text) { first.text = trimmed; first.fmt = 0; }
  }
  if (runs.length > 0) {
    const last = runs[runs.length - 1];
    const trimmed = last.text.replace(/\s+$/, '');
    if (!trimmed) runs.pop();
    else if (trimmed !== last.text) { last.text = trimmed; last.fmt = 0; }
  }
  return runs;
};

/**
 * Build format runs from a Lexical node's inline children. Bails (null) on any
 * non-text child or inlineTag-stamped text (uicontrol/wintitle). Only the three
 * serializable flags are read — underline etc. can't be expressed in this DITA
 * mapping, so toggling them must not trigger a rewrite.
 */
const buildLexicalInlineRuns = (lexicalNode: any, originMap?: NodeOriginMapType): InlineRun[] | null => {
  if (!lexicalNode.getChildren) return null;
  const runs: InlineRun[] = [];
  for (const child of lexicalNode.getChildren()) {
    const type = child.getType();
    if (type === 'dita-info-preview') continue; // visual-only, never serialized
    if (type === 'dita-container-boundary') continue; // visual-only, never serialized
    if (type !== 'text') return null;
    if (originMap?.get(child.getKey())?.inlineTag) return null;
    let fmt = 0;
    if (child.hasFormat('bold')) fmt |= FMT_BOLD;
    if (child.hasFormat('italic')) fmt |= FMT_ITALIC;
    if (child.hasFormat('code')) fmt |= FMT_CODE;
    runs.push({ text: child.getTextContent(), fmt });
  }
  return runs;
};

/** Merge adjacent same-format runs so Lexical's text-node normalization
 *  (which merges adjacent identical-format nodes) can't fake a difference. */
const mergeRuns = (runs: InlineRun[]): InlineRun[] => {
  const out: InlineRun[] = [];
  for (const r of runs) {
    if (!r.text) continue;
    const prev = out[out.length - 1];
    if (prev && prev.fmt === r.fmt) prev.text += r.text;
    else out.push({ ...r });
  }
  return out;
};

/**
 * True ONLY when confident the inline formatting differs between the DOM
 * element and the Lexical node. Every uncertainty path returns false, keeping
 * the element untouched (preservation beats honoring a toggle we can't model).
 */
const hasFormattingChange = (domEl: Element, lexicalNode: any, originMap?: NodeOriginMapType): boolean => {
  const domRuns = buildDomInlineRuns(domEl);
  if (!domRuns) return false;
  const lexRuns = buildLexicalInlineRuns(lexicalNode, originMap);
  if (!lexRuns) return false;

  const d = mergeRuns(domRuns);
  const l = mergeRuns(lexRuns);

  if (d.map(r => r.text).join('') !== l.map(r => r.text).join('')) {
    return false; // mirror diverged from the parser — do not risk a rewrite
  }
  if (d.length !== l.length) return true;
  for (let i = 0; i < d.length; i++) {
    if (d[i].text !== l[i].text || d[i].fmt !== l[i].fmt) return true;
  }
  return false;
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
  // ADR-010: reconcile inline structure around preserved anchors first. The
  // text-equality fast path below cannot see a structure-only change (a new
  // inline element around unchanged text) and the full rewrite it falls to is
  // lossy for container inlines and chip attributes (BUG-32) — so the
  // reconciler runs before either. It falls through only when it bails.
  {
    const tag = domEl.tagName.toLowerCase();
    let mode: ReconcileMode = 'trim';
    if (tag === 'note') {
      const hasBlocks = Array.from(domEl.children).some(c => NOTE_BLOCK_TAGS.has(c.tagName.toLowerCase()));
      mode = hasBlocks ? 'note' : 'trim';
    }
    const r = reconcileInline(domEl, Array.from(domEl.childNodes), lexicalNode, originMap, mode, reconcileDeps(doc, originMap));
    if (r === 'untouched') return true;
    if (r === 'patched') return false;
  }

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
      // S2: identical text can still hide a bold/italic/code toggle — compare
      // format-run signatures (safe subset only; bails to "untouched").
      if (hasFormattingChange(domEl, lexicalNode, originMap)) {
        replaceElementContent(domEl, lexicalNode, doc, originMap);
        return false;
      }
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
    const noteType = origin?.noteType;
    if (noteType && noteType !== 'NOTE') el.setAttribute('type', noteType.toLowerCase());
    serializeInlineContent(lexicalNode, doc, originMap).forEach(n => el.appendChild(n));
    return el;
  }

  if (type === 'list') {
    const isOrdered = lexicalNode.getListType() === 'number';
    // Inside a troubleshooting <remedy> the only valid list children are
    // <steps> / <steps-unordered> (ADR-009), never <ol>/<ul>.
    const inRemedy = /(^|\/)remedy#\d+$/.test(origin?.containerPath ?? '');
    const tag = isOrdered
      ? (rootTag === 'task' || inRemedy ? 'steps' : 'ol')
      : (inRemedy ? 'steps-unordered' : 'ul');
    const isStepList = tag === 'steps' || tag === 'steps-unordered';
    const childTag = isStepList ? 'step' : 'li';
    const el = doc.createElement(tag);

    lexicalNode.getChildren().forEach((li: any) => {
      const liEl = doc.createElement(childTag);
      if (isStepList) {
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
// BUG-35: cell children the parser's parseCellContent turns into block nodes.
const CELL_WALK_TAGS = new Set(['p', 'ul', 'ol', 'table', 'section']);

/**
 * BUG-35: write a table cell's Lexical content into an <entry>/<stentry>.
 * One paragraph → its inline content directly; otherwise each paragraph as a
 * <p> and every other block (lists, notes, …) through createElementFromLexical.
 * Every rebuild path uses this, so no path can drop a cell's lists again.
 */
const writeCellContent = (entry: Element, cellChildren: any[], doc: Document, originMap?: NodeOriginMapType): void => {
  if (cellChildren.length === 1 && cellChildren[0].getType() === 'paragraph') {
    serializeInlineContent(cellChildren[0], doc, originMap).forEach(n => entry.appendChild(n));
    return;
  }
  cellChildren.forEach((child: any) => {
    if (child.getType() === 'paragraph') {
      const p = doc.createElement('p');
      serializeInlineContent(child, doc, originMap).forEach(n => p.appendChild(n));
      entry.appendChild(p);
    } else {
      const el = createElementFromLexical(child, doc, '', originMap ?? new Map());
      if (el) entry.appendChild(el);
    }
  });
};

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

      writeCellContent(entry, cell.getChildren ? cell.getChildren() : [], doc, originMap);
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
  const isSteps = tag === 'steps' || tag === 'steps-unordered';
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
  basePath: string = '',
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
      // ADR-011: the <dd>'s nodes carry the enclosing container's path, so the
      // walk inherits that base path — at base '' it would re-wrap them.
      patchBodyChildren(Array.from(domDd.children), domDd, ddNodes, doc, rootTag, originMap, { groupDl: false, basePath });
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
    writeCellContent(entry, cell.getChildren ? cell.getChildren() : [], doc, originMap);
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

  const onlyParagraphs = cellChildren.every((c: any) => c.getType() === 'paragraph');
  // BUG-35: the blocks the cell parser turns into editor nodes. Anything else
  // in a cell (a <note>, an <image> — BUG-29) has no node, so the walk below
  // must never see it: it would be "unconsumed" and deleted.
  const walkable = Array.from(domEntry.children).filter(c => CELL_WALK_TAGS.has(c.tagName.toLowerCase()));
  const domHasLists = walkable.some(c => c.tagName.toLowerCase() !== 'p');
  if (domParagraphs.length > 0 && cellChildren.length > 0 && onlyParagraphs && !domHasLists) {
    // Patch paragraphs in parallel (unchanged pre-BUG-35 path)
    const count = Math.min(domParagraphs.length, cellChildren.length);
    for (let i = 0; i < count; i++) {
      patchElementContent(domParagraphs[i], cellChildren[i], doc, originMap);
    }
  } else if (domParagraphs.length > 0 && cellChildren.length > 0) {
    // BUG-35: a cell holding lists (in the source or the editor) is walked
    // like any block container, so a list is patched, added, or removed
    // instead of silently skipped.
    patchBodyChildren(walkable, domEntry, cellChildren, doc, '', originMap ?? new Map());
  } else {
    // ADR-010: a cell with direct inline content and one Lexical paragraph is
    // reconciled with the cell parser's segment rules; bail → legacy below.
    const cellBlockTags = new Set(['p', 'ul', 'ol', 'li', 'table', 'section', 'div']);
    const hasCellBlocks = Array.from(domEntry.children).some(c => cellBlockTags.has(c.tagName.toLowerCase()));
    if (!hasCellBlocks && cellChildren.length === 1 && cellChildren[0].getType() === 'paragraph') {
      const r = reconcileInline(domEntry, Array.from(domEntry.childNodes), cellChildren[0], originMap, 'segment', reconcileDeps(doc, originMap));
      if (r !== 'bail') return;
    }
    // Entry with direct text content — compare and patch as a unit.
    // S2: equal text can still hide a formatting toggle in the cell's single
    // paragraph — same signature check as patchElementContent.
    const domText = domEntry.textContent || '';
    const lexText = lexicalCell.getTextContent();
    const formattingChanged =
      domText === lexText &&
      cellChildren.length === 1 &&
      cellChildren[0].getType() === 'paragraph' &&
      hasFormattingChange(domEntry, cellChildren[0], originMap);
    const structureChanged = !onlyParagraphs;
    if (domText !== lexText || formattingChanged || structureChanged) {
      while (domEntry.firstChild) domEntry.removeChild(domEntry.firstChild);
      writeCellContent(domEntry, cellChildren, doc, originMap);
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
      writeCellContent(stentry, cell.getChildren ? cell.getChildren() : [], doc, originMap);
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
 * ADR-011: did the parse produce any editor *content* node inside the
 * container at `path`? Boundary markers do not count: the parser emits one for
 * every condition/cause/remedy, so an empty <cause/> would otherwise look like
 * deleted content.
 */
const producedNodesFor = (path: string, originMap: NodeOriginMapType): boolean => {
  for (const origin of originMap.values()) {
    if (origin.tag === 'dita-container-boundary') continue;
    const cp = origin.containerPath;
    if (cp && (cp === path || cp.startsWith(path + '/'))) return true;
  }
  return false;
};

/**
 * ADR-011 decision 7: a body-level node the author created (no containerPath,
 * no parser bodyIndex >= 0) belongs to the container of the nearest preceding
 * node that has one — unless it is an h2, which starts a new section that the
 * following author-created nodes join. Grouping-only: returns an overlay of
 * originMap (the real map is never written), or the map itself if nothing
 * inherits.
 */
const withInheritedContainers = (bodyNodes: any[], originMap: NodeOriginMapType): NodeOriginMapType => {
  let overlay: NodeOriginMapType | null = null;
  let lastPath: string | undefined;
  let inNewSection = false;
  for (const node of bodyNodes) {
    const origin = originMap.get(node.getKey());
    if (origin?.containerPath) { lastPath = origin.containerPath; inNewSection = false; continue; }
    const parsed = origin !== undefined && origin.bodyIndex >= 0;
    if (parsed) { lastPath = undefined; inNewSection = false; continue; }
    if (node.getType() === 'heading' && node.getTag() === 'h2') { lastPath = undefined; inNewSection = true; continue; }
    if (lastPath && !inNewSection) {
      overlay ??= new Map(originMap);
      overlay.set(node.getKey(), { ...(origin ?? { tag: node.getType(), bodyIndex: -1 }), containerPath: lastPath });
    }
  }
  return overlay ?? originMap;
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
  options?: { groupDl?: boolean; basePath?: string; groupPWrap?: boolean },
) => {
  const groupDl = options?.groupDl !== false;
  const basePath = options?.basePath ?? '';
  const groupPWrap = options?.groupPWrap !== false;
  const groups = groupBodyNodesForSections(lexicalNodes, originMap, groupDl, basePath, groupPWrap);

  const recognizedDomChildren = domChildren.filter(
    c => RECOGNIZED_BODY_TAGS.has(c.tagName.toLowerCase())
  );

  const consumed = new Set<Element>();
  let gIdx = 0;

  // ADR-011: container identity is its "tag#ordinal" among the parent's
  // same-tag children — the same segment the parser stamped. Computed before
  // any removal or insertion so ordinals cannot shift under the walk.
  const segmentOf = new Map<Element, string>();
  const bySegment = new Map<string, Element>();
  {
    const seen = new Map<string, number>();
    for (const el of Array.from(parentEl.children)) {
      const n = seen.get(el.tagName) ?? 0;
      seen.set(el.tagName, n + 1);
      if (!isContainerEl(el)) continue;
      const segment = `${el.tagName}#${n}`;
      segmentOf.set(el, segment);
      bySegment.set(segment, el);
    }
  }
  /** Insert `el` before `domChild`; a container `domChild` is never removed here (ADR-011). */
  const insertInstead = (el: Element, domChild: Element): 'kept' | 'replaced' => {
    parentEl.insertBefore(el, domChild);
    if (isContainerEl(domChild)) return 'kept';
    parentEl.removeChild(domChild);
    return 'replaced';
  };

  for (let domIdx = 0; domIdx < recognizedDomChildren.length && gIdx < groups.length; domIdx++) {
    const domChild = recognizedDomChildren[domIdx];
    if (domChild.parentNode !== parentEl) continue; // already removed by look-ahead
    const domTag = domChild.tagName.toLowerCase();
    const group = groups[gIdx];

    // ADR-011: a container the parse produced no content for (empty, conref'd)
    // has no counterpart in the editor, so it is not an anchor for any group:
    // step past it, preserved, instead of placing groups before it.
    if (isContainerEl(domChild) && !consumed.has(domChild)) {
      const segment = segmentOf.get(domChild);
      const path = segment ? (basePath ? `${basePath}/${segment}` : segment) : null;
      if (path && !producedNodesFor(path, originMap)) {
        consumed.add(domChild);
        continue;
      }
    }

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
        patchDlElement(innerDl, group.nodes, doc, rootTag, originMap, basePath);
        consumed.add(domChild);
      } else {
        const newEl = createDlFromLexical(group.nodes, doc, rootTag, originMap);
        if (insertInstead(newEl, domChild) === 'kept') domIdx--;
      }
      gIdx++;
    } else if (group.type === 'section') {
      // ADR-011: every <section> in the source is a container group, so a
      // legacy h2 group is always a NEW section the author typed: create it,
      // never patch it into an existing <section> element.
      const sectionEl = createSectionFromLexical(group.nodes, doc, rootTag, originMap);
      parentEl.insertBefore(sectionEl, domChild);
      domIdx--; // the current DOM child is still unmatched
      gIdx++;
    } else if (group.type === 'pwrap') {
      // BUG-25: a <p> wrapping blocks — patch the wrapper in place.
      if (domTag === 'p') {
        patchPWrapper(domChild, group.nodes, doc, rootTag, originMap, basePath);
        consumed.add(domChild);
      } else {
        const el = createPWrapperFromLexical(group.nodes, doc, rootTag, originMap);
        if (insertInstead(el, domChild) === 'kept') domIdx--;
      }
      gIdx++;
    } else if (group.type === 'container') {
      // ADR-011: patch exactly the element whose "tag#ordinal" segment the
      // group's path names. Elements the walk passes over are left for the
      // final pass (removed only by provenance). If the source has no such
      // element (the master predates the container), create it.
      const segment = group.path!.split('/').pop()!;
      const target = bySegment.get(segment);
      if (target && target.parentNode === parentEl && !consumed.has(target)) {
        patchContainer(target, group, doc, rootTag, originMap);
        consumed.add(target);
        const t = recognizedDomChildren.indexOf(target);
        if (t >= domIdx) domIdx = t;
        else domIdx--; // target was behind the pointer; re-examine domChild
      } else {
        const el = createContainerFromLexical(group, doc, rootTag, originMap);
        parentEl.insertBefore(el, domChild);
        domIdx--;
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
        lexXmlId && domId && domId !== lexXmlId && !isContainerEl(domChild) &&
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

        if (isContainerEl(domChild)) {
          // ADR-011: a container is never deleted to make room for a single;
          // place the single before it and keep the container for its own
          // group (or the final provenance pass).
          const newEl = createElementFromLexical(lexNode, doc, rootTag, originMap);
          if (newEl) parentEl.insertBefore(newEl, domChild);
          domIdx--;
          gIdx++;
        } else if (nextMatches) {
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
      // ADR-011 provenance: an unconsumed container is removed only if the
      // parse produced editor nodes for it (originMap keeps entries for nodes
      // the author has since deleted). Otherwise it produced nothing — an empty
      // <cause/>, a <section conref="…"/> — and is preserved byte-for-byte.
      if (isContainerEl(child)) {
        const segment = segmentOf.get(child);
        const path = segment ? (basePath ? `${basePath}/${segment}` : segment) : null;
        if (!path || !producedNodesFor(path, originMap)) continue;
      }
      parentEl.removeChild(child);
    }
  }

  // Append remaining Lexical groups as new DOM elements
  for (let i = gIdx; i < groups.length; i++) {
    const group = groups[i];
    if (group.type === 'section') {
      parentEl.appendChild(createSectionFromLexical(group.nodes, doc, rootTag, originMap));
    } else if (group.type === 'container') {
      parentEl.appendChild(createContainerFromLexical(group, doc, rootTag, originMap));
    } else if (group.type === 'pwrap') {
      parentEl.appendChild(createPWrapperFromLexical(group.nodes, doc, rootTag, originMap));
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
  if (domTag === 'steps-unordered' && lexType === 'list') return true;
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
  } else if (tag === 'steps' || tag === 'steps-unordered' || tag === 'ol' || tag === 'ul') {
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
  }
  // (ADR-011: a <section> is a container, patched by patchContainer; the walk
  // never hands one to this function, so there is no section branch.)
};

/**
 * Strip xmlns="" attributes that XMLSerializer adds spuriously.
 * Operates only inside start-tags to avoid corrupting codeblock text
 * that happens to contain the namespace string literally.
 */
const stripSpuriousXmlns = (xml: string): string => {
  return xml.replace(/<[^>]+>/g, tag =>
    tag
      .replace(/ xmlns=""/g, '')
      .replace(/ xmlns="http:\/\/www\.w3\.org\/1999\/xhtml"/g, '')
  );
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
      const walkMap = withInheritedContainers(bodyNodes, originMap); // ADR-011 decision 7
      patchBodyChildren(Array.from(bodyEl.children), bodyEl, bodyNodes, clonedDoc, rootTag, walkMap);
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
  type: 'single' | 'section' | 'dl' | 'container' | 'pwrap';
  nodes: any[];
  /** container groups only (ADR-009): element tag in source case, and the full path of this container */
  tag?: string;
  path?: string;
}

/** ADR-009: visual-only markers never take part in the DOM walk. */
const isVisualOnly = (node: any): boolean => {
  const t = node?.getType?.();
  return t === 'dita-container-boundary' || t === 'dita-info-preview';
};

/** ADR-009: the next "tag#ordinal" segment of `containerPath` below `basePath`, or null if the node is not inside a deeper container. */
const nextContainerSegment = (containerPath: string | undefined, basePath: string): { segment: string; path: string } | null => {
  if (!containerPath) return null;
  let rest: string;
  if (basePath === '') rest = containerPath;
  else if (containerPath.startsWith(basePath + '/')) rest = containerPath.slice(basePath.length + 1);
  else return null; // at or above basePath → treated as a direct child of this level
  if (!rest) return null;
  const segment = rest.split('/')[0];
  return { segment, path: basePath === '' ? segment : `${basePath}/${segment}` };
};

const groupBodyNodesForSections = (bodyNodes: any[], originMap?: NodeOriginMapType, groupDl: boolean = true, basePath: string = '', groupPWrap: boolean = true): NodeGroup[] => {
  const groups: NodeGroup[] = [];
  let i = 0;

  while (i < bodyNodes.length) {
    const node = bodyNodes[i];
    const origin = originMap?.get(node.getKey());

    // Troubleshooting container group (ADR-009): a run of nodes whose
    // containerPath descends into the same next container below basePath.
    // Takes precedence over section/dl grouping so an h2 title inside a
    // <condition> cannot swallow the following <troubleSolution>.
    const next = nextContainerSegment(origin?.containerPath, basePath);
    if (next) {
      const containerNodes: any[] = [node];
      i++;
      while (i < bodyNodes.length) {
        const n = nextContainerSegment(originMap?.get(bodyNodes[i].getKey())?.containerPath, basePath);
        if (!n || n.path !== next.path) break;
        containerNodes.push(bodyNodes[i]);
        i++;
      }
      groups.push({ type: 'container', nodes: containerNodes, tag: next.segment.split('#')[0], path: next.path });
      continue;
    }

    // BUG-25: a <p> that wrapped block children. A run of nodes sharing a
    // pWrapperId (inline runs as paragraphs, blocks as themselves) is patched
    // back into the one source <p>. Nodes that also carry dlEntryIndex belong
    // to the <p><dl> path below, which predates this and must keep winning.
    // Disabled inside patchPWrapper's own block walk (groupPWrap=false), where
    // every node carries the wrapper's id by construction.
    if (groupPWrap && origin?.pWrapperId !== undefined && origin.dlEntryIndex === undefined) {
      const id = origin.pWrapperId;
      const wrapNodes: any[] = [node];
      i++;
      while (i < bodyNodes.length) {
        const o = originMap?.get(bodyNodes[i].getKey());
        if (o?.pWrapperId !== id || o.dlEntryIndex !== undefined) break;
        wrapNodes.push(bodyNodes[i]);
        i++;
      }
      groups.push({ type: 'pwrap', nodes: wrapNodes });
      continue;
    }

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
        // ADR-011: a new heading never swallows an existing container.
        if (originMap?.get(next.getKey())?.containerPath) break;
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
 * ADR-009: patch a troubleshooting container (<condition>, <cause>, <remedy>,
 * <troubleSolution>, <steps-informal>) in place. An optional leading h2 is the
 * container's <title>; everything else is walked by patchBodyChildren with the
 * container's path as the new base, so nested containers recurse naturally.
 */
const patchContainer = (
  containerEl: Element,
  group: NodeGroup,
  doc: Document,
  rootTag: string,
  originMap: NodeOriginMapType,
) => {
  let bodyNodes: any[] = group.nodes.filter(n => !isVisualOnly(n));
  const first = bodyNodes[0];
  if (first && first.getType() === 'heading' && first.getTag() === 'h2') {
    const title = containerEl.querySelector(':scope > title');
    if (title) patchElementContent(title, first, doc, originMap);
    bodyNodes = bodyNodes.slice(1);
  }
  const children = Array.from(containerEl.children).filter(c => c.tagName.toLowerCase() !== 'title');
  patchBodyChildren(children, containerEl, bodyNodes, doc, rootTag, originMap, { basePath: group.path });
};

/**
 * BUG-25: patch a <p> that wraps block children. The DOM <p> alternates inline
 * segments (text + inline elements) with block elements; the Lexical run
 * alternates paragraphs (the inline segments) with block nodes. Blocks are
 * patched through the normal walk; an inline segment is rewritten only when
 * its text actually changed. If the two shapes no longer line up (the author
 * restructured the paragraph), the wrapper is rebuilt from Lexical.
 */
const patchPWrapper = (
  pEl: Element,
  nodes: any[],
  doc: Document,
  rootTag: string,
  originMap: NodeOriginMapType,
  basePath: string = '',
) => {
  const isBlockEl = (n: Node): n is Element =>
    n.nodeType === Node.ELEMENT_NODE && RECOGNIZED_BODY_TAGS.has((n as Element).tagName.toLowerCase());

  // Partition DOM children into inline segments and block elements, in order.
  type Segment = { kind: 'inline'; nodes: Node[] } | { kind: 'block'; el: Element };
  const segments: Segment[] = [];
  let currentInline: Node[] = [];
  const flush = () => {
    const hasContent = currentInline.some(n =>
      n.nodeType === Node.ELEMENT_NODE || (n.textContent ?? '').trim().length > 0,
    );
    if (hasContent) segments.push({ kind: 'inline', nodes: currentInline });
    currentInline = [];
  };
  Array.from(pEl.childNodes).forEach(n => {
    if (isBlockEl(n)) { flush(); segments.push({ kind: 'block', el: n }); }
    else currentInline.push(n);
  });
  flush();

  const lexInline = nodes.filter(n => n.getType() === 'paragraph');
  const lexBlocks = nodes.filter(n => n.getType() !== 'paragraph');
  const domInline = segments.filter(s => s.kind === 'inline') as Extract<Segment, { kind: 'inline' }>[];
  const domBlocks = segments.filter(s => s.kind === 'block').map(s => (s as Extract<Segment, { kind: 'block' }>).el);

  const shapesAlign =
    lexInline.length === domInline.length &&
    segments.map(s => s.kind).join() === nodes.map(n => (n.getType() === 'paragraph' ? 'inline' : 'block')).join();

  if (!shapesAlign) {
    // Rebuild the wrapper: keep the <p>'s own attributes, regenerate children.
    while (pEl.firstChild) pEl.removeChild(pEl.firstChild);
    nodes.forEach(n => {
      if (n.getType() === 'paragraph') serializeInlineContent(n, doc, originMap).forEach(x => pEl.appendChild(x));
      else { const el = createElementFromLexical(n, doc, rootTag, originMap); if (el) pEl.appendChild(el); }
    });
    return;
  }

  // Blocks: the ordinary walk, scoped to this <p> (wrapper grouping off — these
  // nodes all carry this wrapper's id).
  patchBodyChildren(domBlocks, pEl, lexBlocks, doc, rootTag, originMap, { groupPWrap: false, basePath });

  // Inline segments: rewrite only when text changed (whitespace-insensitive,
  // like the S3 rule — the parser collapses inter-node whitespace).
  const stripWs = (s: string) => s.replace(/\s+/g, '');
  domInline.forEach((seg, i) => {
    const lex = lexInline[i];
    // ADR-010: reconcile the segment with the block-split (segment) rules;
    // only a bail reaches the whitespace-insensitive rewrite below.
    if (reconcileInline(pEl, seg.nodes, lex, originMap, 'segment', reconcileDeps(doc, originMap)) !== 'bail') return;
    const domText = seg.nodes.map(n => n.textContent ?? '').join('');
    if (stripWs(domText) === stripWs(lex.getTextContent())) return;
    const anchor = seg.nodes[seg.nodes.length - 1].nextSibling;
    seg.nodes.forEach(n => { if (n.parentNode === pEl) pEl.removeChild(n); });
    serializeInlineContent(lex, doc, originMap).forEach(x => pEl.insertBefore(x, anchor));
  });
};

/** BUG-25: create a block-wrapping <p> from scratch. */
const createPWrapperFromLexical = (nodes: any[], doc: Document, rootTag: string, originMap: NodeOriginMapType): Element => {
  const p = doc.createElement('p');
  nodes.forEach(n => {
    if (n.getType() === 'paragraph') serializeInlineContent(n, doc, originMap).forEach(x => p.appendChild(x));
    else { const el = createElementFromLexical(n, doc, rootTag, originMap); if (el) p.appendChild(el); }
  });
  return p;
};

/**
 * ADR-009: create a troubleshooting container from scratch (author added one in
 * the visual editor, or the master lacks it). Children are produced by the same
 * walk with an empty DOM, so nested containers are created recursively.
 */
const createContainerFromLexical = (group: NodeGroup, doc: Document, rootTag: string, originMap: NodeOriginMapType): Element => {
  const el = doc.createElement(group.tag!);
  let bodyNodes: any[] = group.nodes.filter(n => !isVisualOnly(n));
  const first = bodyNodes[0];
  if (first && first.getType() === 'heading' && first.getTag() === 'h2') {
    const title = doc.createElement('title');
    serializeInlineContent(first, doc, originMap).forEach(n => title.appendChild(n));
    el.appendChild(title);
    bodyNodes = bodyNodes.slice(1);
  }
  patchBodyChildren([], el, bodyNodes, doc, rootTag, originMap, { basePath: group.path });
  return el;
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
