// FR-063 — post-sync structural mismatch warning.
//
// After each Lexical → XML serialize, compare cheap structural counts between
// the editor tree and the XML it produced. The check is one-directional on
// purpose: it flags only "the editor has MORE of X than the XML", which is
// what a serializer drop looks like (P1-13: a link the author can see, no
// <xref> in the XML). The XML legitimately holds more than the editor renders
// (preserved <info>, opaque elements, untouched unrecognized markup), so
// "XML has more" is never a warning — that is what keeps false positives at
// zero across the byte-stability corpus (pinned by test).
//
// Counts only, no diff: a tree walk and a handful of regex scans per sync.
import { $getRoot, $isElementNode, type LexicalNode } from 'lexical';
import { toast } from 'sonner';
import type { NodeOriginMapType } from './nodeOriginMap';

export interface StructureMismatch {
  /** Stable key, e.g. 'xref', 'note', 'inline:uicontrol', 'attr:conkeyref'. */
  key: string;
  /** How the author sees it in the visual editor. */
  noun: { one: string; many: string };
  /** What the XML is missing, as written in the toast. */
  xmlName: string;
  editorCount: number;
  xmlCount: number;
}

type Kind = { noun: { one: string; many: string }; xmlName: string; tags?: string[]; attr?: string };

const KINDS: Record<string, Kind> = {
  xref: { noun: { one: 'link', many: 'links' }, xmlName: '<xref>', tags: ['xref'] },
  note: { noun: { one: 'note', many: 'notes' }, xmlName: '<note>', tags: ['note'] },
  table: { noun: { one: 'table', many: 'tables' }, xmlName: '<table>', tags: ['table', 'simpletable'] },
  list: { noun: { one: 'list', many: 'lists' }, xmlName: 'list element', tags: ['ul', 'ol', 'steps', 'steps-unordered'] },
  codeblock: { noun: { one: 'code block', many: 'code blocks' }, xmlName: '<codeblock>', tags: ['codeblock'] },
  image: { noun: { one: 'image', many: 'images' }, xmlName: '<image>', tags: ['image'] },
  codeph: { noun: { one: 'code phrase', many: 'code phrases' }, xmlName: '<codeph>', tags: ['codeph'] },
};

const refKind = (attr: string): Kind => ({
  noun: { one: `${attr} reference`, many: `${attr} references` },
  xmlName: `element with ${attr}`,
  attr,
});

const inlineKind = (tag: string): Kind => ({
  noun: { one: `<${tag}> element`, many: `<${tag}> elements` },
  xmlName: `<${tag}>`,
  tags: [tag],
});

/** Editor-side counts, keyed like KINDS / 'inline:<tag>' / 'attr:<name>'. Call inside a read. */
const $countEditor = (originMap: NodeOriginMapType): Map<string, number> => {
  const counts = new Map<string, number>();
  const bump = (key: string) => counts.set(key, (counts.get(key) ?? 0) + 1);
  const isCode = (n: LexicalNode) => (n as unknown as { hasFormat(f: string): boolean }).hasFormat('code');

  const visit = (node: LexicalNode) => {
    const type = node.getType();
    const prev = node.getPreviousSibling();
    if (type === 'link') bump('xref');
    else if (type === 'quote') bump('note');
    else if (type === 'table') bump('table');
    else if (type === 'list') bump('list');
    else if (type === 'ditacodeblock') bump('codeblock');
    else if (type === 'ditaimage') bump('image');
    else if (type === 'ditaphref') {
      const chip = node as unknown as { getRefType(): string };
      const refType = chip.getRefType();
      if (refType === 'image') bump('image');
      else if (refType === 'conkeyref' || refType === 'keyref' || refType === 'conref') bump(`attr:${refType}`);
      // 'info-chip' is visual-only.
    } else if (type === 'text') {
      const origin = originMap.get(node.getKey());
      if (origin?.inlineTag) bump(`inline:${origin.inlineTag}`);
      else if (isCode(node) && !(prev && prev.getType() === 'text' && !originMap.get(prev.getKey())?.inlineTag && isCode(prev))) {
        // One <codeph> per run of adjacent code text: a <codeph> holding a
        // nested <b> parses to several code nodes (BUG-44).
        bump('codeph');
      }
    }
    if ($isElementNode(node)) node.getChildren().forEach(visit);
  };
  $getRoot().getChildren().forEach(visit);
  return counts;
};

/** XML-side counts for exactly the keys the editor produced. */
const countXml = (xml: string, keys: Iterable<string>): Map<string, number> => {
  // Markup inside comments, CDATA, and PIs is not structure.
  const markup = xml
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, '')
    .replace(/<\?[\s\S]*?\?>/g, '')
    .replace(/<!DOCTYPE[^[>]*(?:\[[^\]]*\])?\s*>/, '');
  const startTags = markup.match(/<[A-Za-z][^>]*>/g) ?? [];
  const nameOf = (tag: string) => tag.slice(1).split(/[\s/>]/)[0].toLowerCase();

  const out = new Map<string, number>();
  for (const key of keys) {
    const kind = kindFor(key);
    let n = 0;
    if (kind.attr) {
      const re = new RegExp(`\\s${kind.attr}\\s*=`);
      for (const t of startTags) if (re.test(t)) n++;
    } else if (kind.tags) {
      const wanted = new Set(kind.tags);
      for (const t of startTags) if (wanted.has(nameOf(t))) n++;
    }
    out.set(key, n);
  }
  return out;
};

const kindFor = (key: string): Kind => {
  if (key.startsWith('inline:')) return inlineKind(key.slice('inline:'.length));
  if (key.startsWith('attr:')) return refKind(key.slice('attr:'.length));
  return KINDS[key];
};

/**
 * Mismatches where the editor holds more of something than the serialized XML.
 * Pure with respect to its inputs; reads the editor state.
 */
export const checkSerializedStructure = (
  editorState: { read<T>(fn: () => T): T },
  xml: string,
  originMap: NodeOriginMapType,
): StructureMismatch[] => {
  const editorCounts = editorState.read(() => $countEditor(originMap));
  const xmlCounts = countXml(xml, editorCounts.keys());
  const mismatches: StructureMismatch[] = [];
  for (const [key, editorCount] of editorCounts) {
    const xmlCount = xmlCounts.get(key) ?? 0;
    if (xmlCount < editorCount) {
      const kind = kindFor(key);
      mismatches.push({ key, noun: kind.noun, xmlName: kind.xmlName, editorCount, xmlCount });
    }
  }
  return mismatches;
};

/** Toast copy. Leads with the biggest gap; names how many other kinds differ. */
export const describeMismatches = (mismatches: StructureMismatch[]): string => {
  const sorted = [...mismatches].sort((a, b) => (b.editorCount - b.xmlCount) - (a.editorCount - a.xmlCount));
  const top = sorted[0];
  const missing = top.editorCount - top.xmlCount;
  const noun = missing === 1 ? top.noun.one : top.noun.many;
  const verb = missing === 1 ? 'has' : 'have';
  const others = sorted.length - 1;
  const tail = others > 0 ? ` ${others} other element ${others === 1 ? 'type differs' : 'types differ'} too.` : '';
  return `${missing} ${noun} in the visual editor ${verb} no matching ${top.xmlName} in the XML. Check the source pane.${tail}`;
};

// One warning per distinct message per 10 s: a dropped element would otherwise
// re-toast on every keystroke's sync until the author fixes it.
const lastWarnedAt = new Map<string, number>();
const WARN_THROTTLE_MS = 10_000;

/**
 * Run the check after a serialize and warn the author on a mismatch. Advisory
 * only: never throws, never blocks the sync. Returns the mismatches (tests).
 */
export const warnOnStructureMismatch = (
  editorState: { read<T>(fn: () => T): T },
  xml: string,
  originMap: NodeOriginMapType,
): StructureMismatch[] => {
  let mismatches: StructureMismatch[] = [];
  try {
    mismatches = checkSerializedStructure(editorState, xml, originMap);
  } catch (err) {
    console.warn('[DITA Architect] structure check failed; sync unaffected', err);
    return [];
  }
  if (mismatches.length === 0) return mismatches;
  const message = describeMismatches(mismatches);
  const now = Date.now();
  if (now - (lastWarnedAt.get(message) ?? 0) >= WARN_THROTTLE_MS) {
    lastWarnedAt.set(message, now);
    toast.warning(message);
  }
  return mismatches;
};

/** Test seam: forget throttle state between tests. */
export const resetStructureWarningThrottle = (): void => lastWarnedAt.clear();
