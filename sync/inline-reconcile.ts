// Inline reconciler (ADR-010 slice A).
//
// Given a DOM element's inline content (as the source document has it) and the
// Lexical node the author edited, decide what changed and change ONLY that.
// Unchanged inline elements are anchors and are never touched — that is what
// keeps <menucascade>, <ph … outputclass>, class attributes, and everything
// else the parser does not model byte-exact. Only the changed run between two
// anchors is rewritten, with text nodes split at raw offsets and inline
// elements treated as atomic.
//
// Both sides are read through the shared scanner in inline-units.ts, so the
// DOM "expected units" are exactly what the parser would build — there is no
// mirror to drift. When a case cannot be modelled (a PI or comment inside the
// changed run, an unsupported Lexical node) the reconciler bails loudly and the
// caller falls back to the legacy patch path.
import type { NodeOriginMapType } from './nodeOriginMap';
import {
  scanInlineChildren,
  WS_RUN,
  NOTE_BLOCK_TAGS,
  FMT_BOLD,
  FMT_ITALIC,
  FMT_CODE,
  type Atom,
  type TextAtom,
} from './inline-units';

export type ReconcileMode = 'trim' | 'segment' | 'note';
export type ReconcileStatus = 'untouched' | 'patched' | 'bail';
export type BailReason = 'unsupported' | 'fixed-inside' | 'drift';

export interface ReconcileReport {
  status: ReconcileStatus;
  reason?: BailReason;
  tag: string;
  detail?: string;
}

/** The serializer hands in its own per-node emitters so this module does not
 *  import serializeLexicalToXml (which imports this module). */
export interface ReconcileDeps {
  serializeChild: (lexicalChild: any) => Node[];
  serializeTextRun: (text: string, fmt: number) => Node;
}

// ─── Observability ───────────────────────────────────────────────────────────

let observer: ((r: ReconcileReport) => void) | null = null;
/** Test seam (ADR-010 R1): see every decision the reconciler makes. */
export const setReconcileObserver = (fn: ((r: ReconcileReport) => void) | null): void => {
  observer = fn;
};

let warnedBail = false;
const report = (r: ReconcileReport): ReconcileStatus => {
  observer?.(r);
  if (r.status === 'bail' && !warnedBail && r.reason !== 'unsupported') {
    warnedBail = true;
    console.warn(
      `[DITA Architect] inline reconciler bailed on <${r.tag}> (${r.reason}${r.detail ? `: ${r.detail}` : ''}); ` +
      'the legacy patch path ran instead. Further bails are not logged.'
    );
  }
  return r.status;
};

// ─── DOM-side units ──────────────────────────────────────────────────────────

interface TextPiece {
  kind: 'text';
  node: Text;
  owner: Element | null;
  /** map[k] = raw index where normalized char k starts; map[len] = raw index after the kept text. */
  map: number[];
  len: number;
}
interface ElemPiece { kind: 'elem'; node: Element; owner: Element | null; len: number }
interface FixedPiece { kind: 'fixed'; node: Node | null; owner: Element | null }
type Piece = TextPiece | ElemPiece | FixedPiece;

interface DTextUnit { kind: 'text'; sig: string; fmt: number; text: string; pieces: Piece[] }
/** `idSig` is the unit's identity for anchoring: equal to `sig` except for a
 *  link, where it leaves out the link's content (href + attributes only), so a
 *  link whose text changed is still matched to its source <xref> and
 *  reconciled inside it (BUG-36/C6) instead of being replaced wholesale. */
interface DAtomicUnit { kind: 'atomic'; sig: string; idSig: string; isLink: boolean; node: Element; owner: Element | null }
interface DFixedUnit { kind: 'fixed'; node: Node | null; owner: Element | null }
type DUnit = DTextUnit | DAtomicUnit | DFixedUnit;

const sortedAttrs = (attrs: Record<string, string> | null | undefined): string =>
  attrs ? JSON.stringify(Object.keys(attrs).sort().map(k => [k, attrs[k]])) : '';

const textSig = (fmt: number, text: string) => `t|${fmt}|${text}`;
const stampedSig = (tag: string, attrs: Record<string, string>, fmt: number, text: string) =>
  `s|${tag}|${sortedAttrs(attrs)}|${fmt}|${text}`;
const linkSig = (href: string, attrs: Record<string, string> | null, childSigs: string[]) =>
  `l|${href}|${sortedAttrs(attrs)}|${childSigs.join('\u0000')}`;
const linkIdSig = (href: string, attrs: Record<string, string> | null) => `l|${href}|${sortedAttrs(attrs)}`;
const chipSig = (refType: string, refValue: string, text: string) => `c|${refType}|${refValue}|${text}`;

/** Collapse a raw text node the way the parser does, keeping a normalized→raw offset map. */
const collapse = (raw: string): { norm: string; map: number[] } => {
  let norm = '';
  const map: number[] = [];
  let last = 0;
  raw.replace(WS_RUN, (m: string, offset: number) => {
    for (let k = last; k < offset; k++) { map.push(k); norm += raw[k]; }
    map.push(offset);
    norm += ' ';
    last = offset + m.length;
    return ' ';
  });
  for (let k = last; k < raw.length; k++) { map.push(k); norm += raw[k]; }
  map.push(raw.length);
  return { norm, map };
};

/** Signature list for the LCS, recursively for link children. Returns null on drift. */
const domUnitsFromAtoms = (atoms: Atom[]): { units: DUnit[]; drift?: string } => {
  const units: DUnit[] = [];
  let pendingFixed: FixedPiece[] = [];

  const flushPending = () => {
    for (const f of pendingFixed) units.push({ kind: 'fixed', node: f.node, owner: f.owner });
    pendingFixed = [];
  };
  const lastText = (): DTextUnit | null => {
    const u = units[units.length - 1];
    return u && u.kind === 'text' ? u : null;
  };

  for (const atom of atoms) {
    if (atom.kind === 'fixed') {
      pendingFixed.push({ kind: 'fixed', node: atom.node, owner: atom.owner });
      continue;
    }
    if (atom.kind === 'text') {
      if (atom.text === '') {
        // Lexical removes an empty simple TextNode; the DOM node stays put.
        pendingFixed.push({ kind: 'fixed', node: atom.node, owner: atom.owner });
        continue;
      }
      let piece: TextPiece | ElemPiece;
      if (atom.source === 'textnode') {
        const node = atom.node as Text;
        const { norm, map } = collapse(node.data);
        const text = norm.slice(atom.lead, norm.length - atom.trail);
        if (text !== atom.text) {
          return { units, drift: `text piece mismatch: scanner "${atom.text}" vs map "${text}"` };
        }
        piece = { kind: 'text', node, owner: atom.owner, map: map.slice(atom.lead, atom.lead + text.length + 1), len: text.length };
      } else {
        // BUG-37: a <b>/<i>/<codeph> that holds exactly one text child is
        // modelled as a TEXT piece whose node is that inner text node (an
        // identity map: these elements' textContent is taken raw, with no
        // whitespace collapse). Every existing mechanism built for ordinary
        // text (splitText-based splicing, the ancestor-walk "group" that
        // keeps an edit inside one element from forcing a full-element
        // replace) then applies unchanged, because the element itself is
        // just this piece's parent — exactly like any other inline wrapper
        // (<menucascade>, a container <ph>). An element with any other shape
        // (comment, multiple children) keeps the atomic ElemPiece fallback:
        // its own text cannot be addressed by a single raw offset, so an
        // edit touching any part of it must still replace the whole element.
        const el = atom.node as Element;
        const onlyChild = el.firstChild;
        if (onlyChild && onlyChild === el.lastChild && onlyChild.nodeType === Node.TEXT_NODE) {
          const raw = (onlyChild as Text).data;
          const map = Array.from({ length: raw.length + 1 }, (_, k) => k);
          piece = { kind: 'text', node: onlyChild as Text, owner: atom.owner, map, len: atom.text.length };
        } else {
          piece = { kind: 'elem', node: el, owner: atom.owner, len: atom.text.length };
        }
      }
      const prev = lastText();
      if (prev && prev.fmt === atom.fmt) {
        // Lexical merges adjacent simple TextNodes with equal format; fixed
        // atoms between them have no Lexical node, so they ride inside.
        prev.pieces.push(...pendingFixed, piece);
        pendingFixed = [];
        prev.text += atom.text;
        prev.sig = textSig(prev.fmt, prev.text);
      } else {
        flushPending();
        units.push({ kind: 'text', sig: textSig(atom.fmt, atom.text), fmt: atom.fmt, text: atom.text, pieces: [piece] });
      }
      continue;
    }
    flushPending();
    if (atom.kind === 'stamped') {
      const sig = stampedSig(atom.tag, atom.attrs, atom.fmt, atom.text);
      units.push({ kind: 'atomic', sig, idSig: sig, isLink: false, node: atom.node, owner: atom.owner });
    } else if (atom.kind === 'link') {
      const inner = domUnitsFromAtoms(atom.children);
      if (inner.drift) return { units, drift: inner.drift };
      const childSigs = inner.units.filter(u => u.kind !== 'fixed').map(u => (u as DTextUnit | DAtomicUnit).sig);
      units.push({ kind: 'atomic', sig: linkSig(atom.href, atom.attrs, childSigs), idSig: linkIdSig(atom.href, atom.attrs), isLink: true, node: atom.node, owner: atom.owner });
    } else {
      const sig = chipSig(atom.refType, atom.refValue, atom.text);
      units.push({ kind: 'atomic', sig, idSig: sig, isLink: false, node: atom.node, owner: atom.owner });
    }
  }
  flushPending();
  return { units };
};

const scanForMode = (domNodes: Node[], mode: ReconcileMode): Atom[] => {
  if (mode !== 'note') return scanInlineChildren(domNodes, mode, null);
  // A <note> with block children: the parser flattens each block child with its
  // own inline parse, keeps non-whitespace direct text (untrimmed), and ignores
  // any other element child outright.
  const atoms: Atom[] = [];
  for (const child of domNodes) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as Element;
      if (NOTE_BLOCK_TAGS.has(el.tagName.toLowerCase())) {
        atoms.push({ kind: 'fixed', node: null, owner: null });
        atoms.push(...scanInlineChildren(Array.from(el.childNodes), 'trim', null));
      } else {
        atoms.push({ kind: 'fixed', node: el, owner: null });
      }
    } else if (child.nodeType === Node.TEXT_NODE) {
      const text = (child.textContent || '').replace(WS_RUN, ' ');
      if (text.trim()) {
        const atom: TextAtom = { kind: 'text', node: child, owner: null, fmt: 0, text, source: 'textnode', lead: 0, trail: 0 };
        atoms.push(atom);
      } else {
        atoms.push({ kind: 'fixed', node: child, owner: null });
      }
    } else {
      atoms.push({ kind: 'fixed', node: child, owner: null });
    }
  }
  return atoms;
};

// ─── Lexical-side units ──────────────────────────────────────────────────────

interface LTextUnit { kind: 'text'; sig: string; fmt: number; text: string }
interface LAtomicUnit { kind: 'atomic'; sig: string; idSig: string; isLink: boolean; node: any }
type LUnit = LTextUnit | LAtomicUnit;

const lexFmt = (n: any): number =>
  (n.hasFormat('bold') ? FMT_BOLD : 0) | (n.hasFormat('italic') ? FMT_ITALIC : 0) | (n.hasFormat('code') ? FMT_CODE : 0);

/** Returns null when a child cannot be modelled (tracked marks, unknown nodes). */
const lexUnits = (lexicalNode: any, originMap?: NodeOriginMapType): LUnit[] | null => {
  if (!lexicalNode?.getChildren) return null;
  const units: LUnit[] = [];
  for (const child of lexicalNode.getChildren()) {
    const type = child.getType();
    if (type === 'dita-info-preview' || type === 'dita-container-boundary') continue;
    if (type === 'text') {
      const text: string = child.getTextContent();
      const fmt = lexFmt(child);
      const origin = originMap?.get(child.getKey());
      if (origin?.inlineTag) {
        const sig = stampedSig(origin.inlineTag, origin.inlineAttrs ?? {}, fmt, text);
        units.push({ kind: 'atomic', sig, idSig: sig, isLink: false, node: child });
        continue;
      }
      if (text === '') continue;
      const prev = units[units.length - 1];
      if (prev && prev.kind === 'text' && prev.fmt === fmt) {
        prev.text += text;
        prev.sig = textSig(fmt, prev.text);
      } else {
        units.push({ kind: 'text', sig: textSig(fmt, text), fmt, text });
      }
    } else if (type === 'link') {
      const inner = lexUnits(child, originMap);
      if (!inner) return null;
      const origin = originMap?.get(child.getKey());
      const attrs = origin?.inlineAttrs ?? null;
      units.push({ kind: 'atomic', sig: linkSig(child.getURL(), attrs, inner.map(u => u.sig)), idSig: linkIdSig(child.getURL(), attrs), isLink: true, node: child });
    } else if (type === 'ditaphref') {
      if (child.getRefType() === 'info-chip') continue; // visual-only
      const sig = chipSig(child.getRefType(), child.getRefValue(), child.getTextContent());
      units.push({ kind: 'atomic', sig, idSig: sig, isLink: false, node: child });
    } else {
      return null;
    }
  }
  return units;
};

// ─── Items (character-level streams for a gap) ───────────────────────────────

type DItem =
  | { k: 'c'; ch: string; fmt: number; piece: TextPiece | ElemPiece; off: number }
  | { k: 'a'; sig: string; unit: DAtomicUnit }
  | { k: 'f'; node: Node | null; owner: Element | null };
type LItem =
  | { k: 'c'; ch: string; fmt: number }
  | { k: 'a'; sig: string; node: any };

const dItemsOf = (unit: DUnit): DItem[] => {
  if (unit.kind === 'fixed') return [{ k: 'f', node: unit.node, owner: unit.owner }];
  if (unit.kind === 'atomic') return [{ k: 'a', sig: unit.sig, unit }];
  const items: DItem[] = [];
  let pos = 0;
  for (const piece of unit.pieces) {
    if (piece.kind === 'fixed') { items.push({ k: 'f', node: piece.node, owner: piece.owner }); continue; }
    for (let off = 0; off < piece.len; off++) {
      items.push({ k: 'c', ch: unit.text[pos + off], fmt: unit.fmt, piece, off });
    }
    pos += piece.len;
  }
  return items;
};

const lItemsOf = (unit: LUnit): LItem[] => {
  if (unit.kind === 'atomic') return [{ k: 'a', sig: unit.sig, node: unit.node }];
  const items: LItem[] = [];
  for (const ch of unit.text) items.push({ k: 'c', ch, fmt: unit.fmt });
  return items;
};

const itemsEqual = (d: DItem, l: LItem): boolean => {
  if (d.k === 'c' && l.k === 'c') return d.ch === l.ch && d.fmt === l.fmt;
  if (d.k === 'a' && l.k === 'a') return d.sig === l.sig;
  return false;
};

/** The DOM node an item lives in: a text node, an inline element (atomic unit
 *  or the <b>/<i>/<codeph> of an element piece), or a fixed node (null for a
 *  <note> block boundary). */
const nodeOf = (item: DItem): Node | null => {
  if (item.k === 'c') return item.piece.node;
  if (item.k === 'a') return item.unit.node;
  return item.node;
};

/** Deepest node containing every node in `nodes` (Node.contains is inclusive). */
const commonAncestor = (nodes: Node[], rootEl: Element): Node => {
  if (nodes.length === 0) return rootEl;
  let anc: Node | null = nodes[0];
  while (anc && anc !== rootEl && !nodes.every(n => anc!.contains(n))) anc = anc.parentNode;
  return anc ?? rootEl;
};

/** The ancestor of `node` (or `node` itself) that is a direct child of `level`. */
const childOfLevel = (node: Node, level: Node): Node | null => {
  let cur: Node | null = node;
  while (cur && cur.parentNode !== level) cur = cur.parentNode;
  return cur;
};

/**
 * BUG-34/BUG-36: the splice level for a changed run is the deepest node that
 * contains the PARENT of every middle item — for an edit inside one
 * <uicontrol> of a <menucascade> that is the <menucascade>, for an edit inside
 * <li><p>…</p></li> it is the <p>. Splicing there keeps the container and its
 * unchanged children; splicing at the outermost container (the old rule)
 * deleted them.
 */
const spliceLevel = (D: DItem[], i: number, ei: number, rootEl: Element): Node => {
  const parents: Node[] = [];
  for (let k = i; k < ei; k++) {
    const n = nodeOf(D[k]);
    if (n?.parentNode) parents.push(n.parentNode);
  }
  return commonAncestor(parents, rootEl);
};

/** Elements an item must not be split across: its <b>/<i>/<codeph> element
 *  piece, and every inline element between its node and the root. */
const groupsOf = (item: DItem, rootEl: Element): object[] => {
  const groups: object[] = [];
  if (item.k === 'c' && item.piece.kind === 'elem') groups.push(item.piece);
  const n = nodeOf(item);
  let cur: Node | null = n?.parentNode ?? null;
  while (cur && cur !== rootEl) { groups.push(cur); cur = cur.parentNode; }
  return groups;
};

// ─── LCS over unit signatures ────────────────────────────────────────────────

const lcsPairs = (a: string[], b: string[]): Array<[number, number]> => {
  const n = a.length, m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const pairs: Array<[number, number]> = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { pairs.push([i, j]); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
    else j++;
  }
  return pairs;
};

// ─── Gap resolution ──────────────────────────────────────────────────────────

interface GapPlan {
  /** D middle item range [i, ei) and L middle range [j, ej). */
  i: number; ei: number; j: number; ej: number;
}

/** The anchors either side of a gap: the last item of the anchor before it and
 *  the first item of the anchor after it (null at the element's edges). */
interface GapContext { before: DItem | null; after: DItem | null }

const planGap = (D: DItem[], L: LItem[], rootEl: Element): GapPlan | { bail: BailReason; detail: string } => {
  // Prefix: skip ownerless fixed items (they ride with the prefix), match pairs.
  const prefix: Array<[number, number]> = [];
  let i = 0, j = 0;
  const skipFixed = (from: number, limit: number): number => {
    let k = from;
    while (k < limit && D[k].k === 'f' && !(D[k] as { owner: Element | null }).owner) k++;
    return k;
  };
  for (;;) {
    i = skipFixed(i, D.length);
    if (i >= D.length || j >= L.length || !itemsEqual(D[i], L[j])) break;
    prefix.push([i, j]); i++; j++;
  }
  // Suffix.
  const suffix: Array<[number, number]> = [];
  let ei = D.length, ej = L.length;
  for (;;) {
    while (ei - 1 >= i && D[ei - 1].k === 'f' && !(D[ei - 1] as { owner: Element | null }).owner) ei--;
    if (ei <= i || ej <= j || !itemsEqual(D[ei - 1], L[ej - 1])) break;
    suffix.push([ei - 1, ej - 1]); ei--; ej--;
  }

  // A pure insertion is ambiguous wherever the inserted text ends with the
  // character just before it ("button| twice" + "again " vs "button |twice" +
  // " again"). Slide it left across such characters: the text is identical,
  // but the insertion then lands in the earlier text node, so typing that
  // continues a word stays inside that word's container (BUG-36/C4). Only
  // plain text is crossed — never an element, a <b>/<i> piece, or a fixed point.
  if (i === ei && j < ej) {
    while (
      i > 0 && j > 0 &&
      D[i - 1].k === 'c' && (D[i - 1] as { piece: TextPiece | ElemPiece }).piece.kind === 'text' &&
      L[ej - 1].k === 'c' &&
      (D[i - 1] as { ch: string }).ch === (L[ej - 1] as { ch: string }).ch &&
      (D[i - 1] as { fmt: number }).fmt === (L[ej - 1] as { fmt: number }).fmt
    ) {
      i--; ei--; j--; ej--;
      prefix.pop();
    }
  }

  // Clamp: a group (element piece or inline container element) that the
  // middle covers only partly must be taken whole — unless it contains the
  // entire change, in which case the splice happens inside it (BUG-34/36).
  const groupIndex = new Map<object, number[]>();
  D.forEach((item, idx) => {
    for (const g of groupsOf(item, rootEl)) {
      const arr = groupIndex.get(g);
      if (arr) arr.push(idx); else groupIndex.set(g, [idx]);
    }
  });
  for (let guard = 0; guard < D.length + 2; guard++) {
    let changed = false;
    if (i < ei) {
      const level = spliceLevel(D, i, ei, rootEl);
      for (const [g, idxs] of groupIndex) {
        const inside = idxs.filter(x => x >= i && x < ei).length;
        if (inside === 0 || inside === idxs.length) continue;
        if (g instanceof Node && g.contains(level)) continue; // the change is inside g
        const first = idxs[0], last = idxs[idxs.length - 1];
        while (prefix.length && prefix[prefix.length - 1][0] >= first) prefix.pop();
        while (suffix.length && suffix[suffix.length - 1][0] < last + 1) suffix.pop();
        i = prefix.length ? prefix[prefix.length - 1][0] + 1 : 0;
        j = prefix.length ? prefix[prefix.length - 1][1] + 1 : 0;
        ei = suffix.length ? suffix[suffix.length - 1][0] : D.length;
        ej = suffix.length ? suffix[suffix.length - 1][1] : L.length;
        i = skipFixed(i, ei);
        changed = true;
        break; // recompute the level after every expansion
      }
    }
    if (!changed) break;
    if (guard === D.length + 1) return { bail: 'unsupported', detail: 'clamp did not converge' };
  }

  // Nothing with no Lexical presence may sit inside the rewritten run.
  for (let k = i; k < ei; k++) {
    if (D[k].k === 'f') {
      const f = D[k] as { node: Node | null };
      return { bail: 'fixed-inside', detail: f.node ? `${f.node.nodeType === Node.COMMENT_NODE ? 'comment' : f.node.nodeType === Node.PROCESSING_INSTRUCTION_NODE ? 'PI' : 'node'} inside the changed run` : 'block boundary inside the changed run' };
    }
  }
  return { i, ei, j, ej };
};

// BUG-37: the one format flag a leaf formatting element's own tag already
// provides to everything spliced directly inside it — new content landing
// there must not ALSO carry it, or it would be double-wrapped
// (<codeph> text<codeph> more</codeph></codeph>). Any other element (p, li,
// menucascade, a table cell, …) contributes none.
const levelOwnFormat = (level: Node): number => {
  if (level.nodeType !== Node.ELEMENT_NODE) return 0;
  const tag = (level as Element).tagName.toLowerCase();
  if (tag === 'b' || tag === 'strong') return FMT_BOLD;
  if (tag === 'i' || tag === 'em') return FMT_ITALIC;
  if (tag === 'codeph') return FMT_CODE;
  return 0;
};

/**
 * True when `level` is a formatting element (<b>/<i>/<codeph>) but the new
 * content about to be spliced into [j, ej) does not uniformly carry that
 * same format — the author is removing or changing the formatting itself
 * (e.g. an unbold), not editing text that stays wrapped by it, so the whole
 * element must be replaced instead of just its text content ("expand to the
 * whole element when the format changes", BUG-37).
 */
const formatChangesInside = (level: Node, L: LItem[], j: number, ej: number): boolean => {
  const want = levelOwnFormat(level);
  if (want === 0) return false;
  for (let k = j; k < ej; k++) {
    const item = L[k];
    if (item.k !== 'c' || (item.fmt & want) !== want) return true;
  }
  return false;
};

/** `stripFmt` removes a format bit new content must not re-apply because the
 *  element it is being spliced into (`level`) already provides it (BUG-37). */
const serializeLexMiddle = (L: LItem[], j: number, ej: number, deps: ReconcileDeps, stripFmt: number = 0): Node[] => {
  const out: Node[] = [];
  let run = '';
  let runFmt = 0;
  const flush = () => { if (run) { out.push(deps.serializeTextRun(run, runFmt)); run = ''; } };
  for (let k = j; k < ej; k++) {
    const item = L[k];
    if (item.k === 'c') {
      const fmt = item.fmt & ~stripFmt;
      if (run && fmt !== runFmt) flush();
      runFmt = fmt;
      run += item.ch;
    } else {
      flush();
      out.push(...deps.serializeChild(item.node));
    }
  }
  flush();
  return out;
};

/**
 * Apply one gap's plan to the DOM. Returns false (before any mutation) when the
 * middle does not resolve to one run of siblings — the caller then bails.
 * Splices happen at the deepest element containing the whole change
 * (spliceLevel), never at an outer container (BUG-34/BUG-36).
 */
const applyGap = (rootEl: Element, D: DItem[], L: LItem[], plan: GapPlan, deps: ReconcileDeps, allNodes: Node[], around: GapContext): boolean => {
  const { i, ei, j, ej } = plan;
  if (i === ei && j === ej) return true;

  if (i === ei) {
    // Pure insertion. The level is decided by the nearest real (non-fixed)
    // neighbours: between two at different depths it is the shallower one, so
    // text typed after a <menucascade> stays outside it; with a neighbour on
    // one side only it is that neighbour's parent, so text typed at the end of
    // an <li><p> stays inside the <p>. BUG-42: when the gap holds no real item
    // at all, its neighbours are the anchors either side of it — a run Lexical
    // cannot merge (bold text typed after a <uicontrol>) has nothing else
    // beside it, and without the anchors it went to the element's end. Not
    // across a <note>'s block boundary (a fixed item with no node): there the
    // place is ambiguous (the end of one <p> or the start of the next), so the
    // gap bails below, as before.
    let pk = i - 1; while (pk >= 0 && D[pk].k === 'f') pk--;
    let nk = i; while (nk < D.length && D[nk].k === 'f') nk++;
    const useAnchors = pk < 0 && nk >= D.length && !D.some(d => d.k === 'f' && !d.node);
    const prevItem = pk >= 0 ? D[pk] : useAnchors ? around.before : null;
    const nextItem = nk < D.length ? D[nk] : useAnchors ? around.after : null;
    const pReal = prevItem ? nodeOf(prevItem) : null;
    const nReal = nextItem ? nodeOf(nextItem) : null;
    if (!pReal && !nReal) {
      if (D.length > 0) return false; // only fixed points (a block boundary) around it
      for (const n of serializeLexMiddle(L, j, ej, deps, levelOwnFormat(rootEl))) rootEl.insertBefore(n, null);
      return true;
    }
    // Left-affine after text: typing that continues a word stays in that
    // word's element (Lexical merges a container's trailing text with the
    // text after it, so this is the only signal there is). After an atomic
    // element (a <uicontrol>), go to the shallower level instead.
    let level: Node =
      pReal && nReal
        ? (prevItem!.k === 'c' ? pReal.parentNode! : commonAncestor([pReal.parentNode!, nReal.parentNode!], rootEl))
        : (pReal ?? nReal)!.parentNode!;
    // BUG-37: splicing directly into a <b>/<i>/<codeph> (level IS that
    // element) must not re-wrap content that element's own tag already
    // provides, or an append would nest a second one inside the first — but
    // only when the new content actually keeps that format; typing a
    // differently-formatted run right at its boundary goes beside it instead
    // (formatChangesInside promotes level to its parent, as if it had always
    // been a plain atomic neighbour).
    if (formatChangesInside(level, L, j, ej)) level = level.parentNode!;
    const newNodes = serializeLexMiddle(L, j, ej, deps, levelOwnFormat(level));
    // Position after the immediately preceding item when it sits inside the
    // level (keeps the old placement relative to comments/PIs), else after the
    // nearest real one; with no predecessor, before the next.
    const before = i > 0 ? D[i - 1] : null;
    const prevSel = before && nodeOf(before) && level.contains(nodeOf(before)!) && nodeOf(before) !== level ? before : (pReal ? prevItem : null);
    let ref: Node | null;
    if (prevSel) {
      const prev = prevSel;
      const pn = nodeOf(prev)!;
      const top = childOfLevel(pn, level);
      if (!top) return false;
      if (prev.k === 'c' && prev.piece.kind === 'text' && top === pn) {
        const node = prev.piece.node;
        const rawEnd = prev.piece.map[prev.off + 1];
        ref = rawEnd < node.data.length ? node.splitText(rawEnd) : node.nextSibling;
      } else {
        ref = top.nextSibling;
      }
    } else {
      const next = nextItem!;
      const nn = nodeOf(next)!;
      const top = childOfLevel(nn, level);
      if (!top) return false;
      if (next.k === 'c' && next.piece.kind === 'text' && top === nn) {
        const node = next.piece.node;
        const rawStart = next.piece.map[next.off];
        ref = rawStart > 0 ? node.splitText(rawStart) : node;
      } else {
        ref = top;
      }
    }
    for (const n of newNodes) level.insertBefore(n, ref);
    return true;
  }

  const first = D[i];
  const last = D[ei - 1];
  let level = spliceLevel(D, i, ei, rootEl);
  // BUG-37: as above — splicing a replacement run back into the same
  // <b>/<i>/<codeph> the changed characters came from must emit plain text,
  // not re-wrap it (which is also what used to force a full-element rewrite
  // and drop that element's own attributes). But when the replacement drops
  // or changes that very format (e.g. removing bold), the whole element must
  // still be replaced — promote level to its parent, which makes the element
  // itself one ordinary "top" node below, exactly as before this fix.
  if (formatChangesInside(level, L, j, ej)) level = level.parentNode!;
  const newNodes = serializeLexMiddle(L, j, ej, deps, levelOwnFormat(level));
  // Before mutating: every middle item must resolve to a sibling run under the level.
  const tops: Node[] = [];
  for (let k = i; k < ei; k++) {
    const n = nodeOf(D[k]);
    if (!n) return false;
    const t = childOfLevel(n, level);
    if (!t) return false;
    if (tops[tops.length - 1] !== t) tops.push(t);
  }
  for (let k = 1; k < tops.length; k++) {
    if (tops[k - 1].nextSibling !== tops[k]) return false;
  }
  // Never remove an element that holds content outside the changed run (an
  // anchor, or another gap's text): that is how a straddling edit used to
  // delete a <menucascade>'s unchanged <uicontrol> (BUG-34). Bail instead.
  const middleNodes = new Set<Node>();
  for (let k = i; k < ei; k++) { const n = nodeOf(D[k]); if (n) middleNodes.add(n); }
  for (const top of tops) {
    if (top.nodeType !== Node.ELEMENT_NODE) continue;
    for (const n of allNodes) {
      if (n !== top && !middleNodes.has(n) && top.contains(n)) return false;
    }
  }

  // Split the end first, then the start, so start offsets stay valid when both
  // fall in one text node. Only a text node directly under the level is split.
  let endNode: Node = tops[tops.length - 1];
  if (last.k === 'c' && last.piece.kind === 'text' && last.piece.node.parentNode === level) {
    const node = last.piece.node;
    const rawEnd = last.piece.map[last.off + 1];
    if (rawEnd < node.data.length) node.splitText(rawEnd);
    endNode = node;
  }
  let startNode: Node = tops[0];
  if (first.k === 'c' && first.piece.kind === 'text' && first.piece.node.parentNode === level) {
    const node = first.piece.node;
    const rawStart = first.piece.map[first.off];
    if (rawStart > 0) {
      const mid = node.splitText(rawStart);
      startNode = mid;
      if (endNode === node) endNode = mid;
    } else {
      startNode = node;
    }
  }

  const ref = endNode.nextSibling;
  let cur: Node | null = startNode;
  const toRemove: Node[] = [];
  while (cur) { toRemove.push(cur); if (cur === endNode) break; cur = cur.nextSibling; }
  if (cur !== endNode) return false;
  for (const n of toRemove) level.removeChild(n);
  for (const n of newNodes) level.insertBefore(n, ref);
  return true;
};

// ─── Entry point ─────────────────────────────────────────────────────────────

/**
 * Reconcile `lexicalNode`'s inline children onto `domNodes` (children of
 * `rootEl`, or the inline segment of a block-wrapping <p>).
 *
 * - 'untouched': nothing differs; the caller must leave the element alone.
 * - 'patched':   the changed run(s) were rewritten in place; the caller is done.
 * - 'bail':      not modelled; the caller runs its legacy path. Reported once
 *                to the console (unless 'unsupported', which is routine).
 */
export const reconcileInline = (
  rootEl: Element,
  domNodes: Node[],
  lexicalNode: any,
  originMap: NodeOriginMapType | undefined,
  mode: ReconcileMode,
  deps: ReconcileDeps,
): ReconcileStatus => {
  const tag = rootEl.tagName.toLowerCase();
  const L = lexUnits(lexicalNode, originMap);
  if (!L) return report({ status: 'bail', reason: 'unsupported', tag, detail: 'Lexical child type not modelled' });

  const scanned = domUnitsFromAtoms(scanForMode(domNodes, mode));
  if (scanned.drift) return report({ status: 'bail', reason: 'drift', tag, detail: scanned.drift });
  const D = scanned.units;

  const dNonFixed = D.filter(u => u.kind !== 'fixed') as Array<DTextUnit | DAtomicUnit>;
  const dSig = dNonFixed.map(u => u.sig);
  const lSig = L.map(u => u.sig);
  if (dSig.length === lSig.length && dSig.every((s, k) => s === lSig[k])) {
    return report({ status: 'untouched', tag });
  }

  // Anchors: LCS over the non-fixed D units and the L units.
  const dNonFixedIdx: number[] = [];
  D.forEach((u, k) => { if (u.kind !== 'fixed') dNonFixedIdx.push(k); });
  // Anchor on identity (idSig): a link matches its source <xref> even when its
  // text changed; such pairs are reconciled inside the <xref> below.
  const idOf = (u: DTextUnit | DAtomicUnit | LUnit) => (u.kind === 'atomic' ? u.idSig : u.sig);
  const pairs = lcsPairs(dNonFixed.map(idOf), L.map(idOf)).map(([a, b]) => [dNonFixedIdx[a], b] as [number, number]);
  const linkEdits: Array<{ el: Element; lex: any }> = [];
  for (const [dk, lk] of pairs) {
    const du = D[dk] as DTextUnit | DAtomicUnit;
    const lu = L[lk];
    if (du.sig !== lu.sig && du.kind === 'atomic' && du.isLink && lu.kind === 'atomic' && lu.isLink) {
      linkEdits.push({ el: du.node, lex: lu.node });
    }
  }

  // Gaps between consecutive anchors (D units [dFrom, dTo) ↔ L units [lFrom, lTo)).
  const gaps: Array<{ D: DItem[]; L: LItem[]; around: GapContext }> = [];
  let dFrom = 0, lFrom = 0;
  const anchorItem = (k: number, last: boolean): DItem | null => {
    if (k < 0 || k >= D.length) return null;
    const items = dItemsOf(D[k]);
    return items.length ? items[last ? items.length - 1 : 0] : null;
  };
  let around: GapContext = { before: null, after: null };
  const pushOne = (dUnits: DUnit[], lUnits: LUnit[]) => {
    const dItems = dUnits.flatMap(dItemsOf);
    const lItems = lUnits.flatMap(lItemsOf);
    if (dItems.length || lItems.length) gaps.push({ D: dItems, L: lItems, around });
  };
  // Edits accumulate against the load-time master, so one gap often holds
  // two independent changes (a text edit next to an edited <uicontrol>).
  // When both sides have the same number of units, pairwise of the same kind,
  // split into one gap per pair so each change gets its own splice level.
  const pushGap = (dTo: number, lTo: number) => {
    around = { before: anchorItem(dFrom - 1, true), after: anchorItem(dTo, false) };
    const dSlice = D.slice(dFrom, dTo);
    const lSlice = L.slice(lFrom, lTo);
    const dReal = dSlice.filter(u => u.kind !== 'fixed');
    const pairable = dReal.length > 1 && dReal.length === lSlice.length && dReal.every((u, k) => u.kind === lSlice[k].kind);
    if (!pairable) { pushOne(dSlice, lSlice); return; }
    let start = 0;
    let realSeen = 0;
    for (let k = 0; k < dSlice.length; k++) {
      if (dSlice[k].kind === 'fixed') continue;
      const end = realSeen === dReal.length - 1 ? dSlice.length : k + 1; // trailing fixed units ride with the last pair
      pushOne(dSlice.slice(start, end), [lSlice[realSeen]]);
      realSeen++;
      start = end;
      if (end === dSlice.length) break;
    }
  };
  for (const [dk, lk] of pairs) {
    pushGap(dk, lk);
    dFrom = dk + 1;
    lFrom = lk + 1;
  }
  pushGap(D.length, L.length);

  // Plan every gap before touching the DOM, so a bail leaves the clone pristine.
  const plans: Array<{ gap: { D: DItem[]; L: LItem[]; around: GapContext }; plan: GapPlan }> = [];
  for (const gap of gaps) {
    const plan = planGap(gap.D, gap.L, rootEl);
    if ('bail' in plan) return report({ status: 'bail', reason: plan.bail, tag, detail: plan.detail });
    plans.push({ gap, plan });
  }
  // Links whose text changed but whose href/attributes did not: reconcile
  // inside the <xref>, so its own attributes stay byte-identical (C6).
  for (const { el, lex } of linkEdits) {
    const r = reconcileInline(el, Array.from(el.childNodes), lex, originMap, 'trim', deps);
    if (r === 'bail') return report({ status: 'bail', reason: 'unsupported', tag, detail: 'link content not reconcilable' });
  }
  const allNodes: Node[] = [];
  for (const u of D) for (const item of dItemsOf(u)) { const n = nodeOf(item); if (n) allNodes.push(n); }
  for (const { gap, plan } of plans) {
    if (!applyGap(rootEl, gap.D, gap.L, plan, deps, allNodes, gap.around)) {
      return report({ status: 'bail', reason: 'unsupported', tag, detail: 'changed run is not one sibling run, or would remove unchanged content' });
    }
  }
  const firstDiff = dSig.findIndex((sig, k) => sig !== lSig[k]);
  const at = firstDiff === -1 ? Math.min(dSig.length, lSig.length) : firstDiff;
  return report({
    status: 'patched',
    tag,
    detail: `${dSig.length} source units vs ${lSig.length} editor units; first difference at unit ${at}: ${JSON.stringify(dSig[at] ?? null)} vs ${JSON.stringify(lSig[at] ?? null)}`,
  });
};
