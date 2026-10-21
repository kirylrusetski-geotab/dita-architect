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
interface DAtomicUnit { kind: 'atomic'; sig: string; node: Element; owner: Element | null }
interface DFixedUnit { kind: 'fixed'; node: Node | null; owner: Element | null }
type DUnit = DTextUnit | DAtomicUnit | DFixedUnit;

const sortedAttrs = (attrs: Record<string, string> | null | undefined): string =>
  attrs ? JSON.stringify(Object.keys(attrs).sort().map(k => [k, attrs[k]])) : '';

const textSig = (fmt: number, text: string) => `t|${fmt}|${text}`;
const stampedSig = (tag: string, attrs: Record<string, string>, fmt: number, text: string) =>
  `s|${tag}|${sortedAttrs(attrs)}|${fmt}|${text}`;
const linkSig = (href: string, attrs: Record<string, string> | null, childSigs: string[]) =>
  `l|${href}|${sortedAttrs(attrs)}|${childSigs.join('\u0000')}`;
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
        piece = { kind: 'elem', node: atom.node as Element, owner: atom.owner, len: atom.text.length };
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
      units.push({ kind: 'atomic', sig: stampedSig(atom.tag, atom.attrs, atom.fmt, atom.text), node: atom.node, owner: atom.owner });
    } else if (atom.kind === 'link') {
      const inner = domUnitsFromAtoms(atom.children);
      if (inner.drift) return { units, drift: inner.drift };
      const childSigs = inner.units.filter(u => u.kind !== 'fixed').map(u => (u as DTextUnit | DAtomicUnit).sig);
      units.push({ kind: 'atomic', sig: linkSig(atom.href, atom.attrs, childSigs), node: atom.node, owner: atom.owner });
    } else {
      units.push({ kind: 'atomic', sig: chipSig(atom.refType, atom.refValue, atom.text), node: atom.node, owner: atom.owner });
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
interface LAtomicUnit { kind: 'atomic'; sig: string; node: any }
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
        units.push({ kind: 'atomic', sig: stampedSig(origin.inlineTag, origin.inlineAttrs ?? {}, fmt, text), node: child });
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
      units.push({ kind: 'atomic', sig: linkSig(child.getURL(), origin?.inlineAttrs ?? null, inner.map(u => u.sig)), node: child });
    } else if (type === 'ditaphref') {
      if (child.getRefType() === 'info-chip') continue; // visual-only
      units.push({ kind: 'atomic', sig: chipSig(child.getRefType(), child.getRefValue(), child.getTextContent()), node: child });
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

/** The DOM node that must be removed whole if this item is in the changed run. */
const topNodeOf = (item: DItem): Node | null => {
  if (item.k === 'c') return item.piece.owner ?? item.piece.node;
  if (item.k === 'a') return item.unit.owner ?? item.unit.node;
  return item.owner ?? item.node;
};

/** Atomicity groups an item belongs to: its container owner, and (for text
 *  inside a <b>/<i>/<codeph>) the element piece. Each group must be wholly
 *  inside or wholly outside the changed run. */
const groupsOf = (item: DItem): object[] => {
  const groups: object[] = [];
  if (item.k === 'c') {
    if (item.piece.kind === 'elem') groups.push(item.piece);
    if (item.piece.owner) groups.push(item.piece.owner);
  } else if (item.k === 'a') {
    if (item.unit.owner) groups.push(item.unit.owner);
  } else if (item.owner) {
    groups.push(item.owner);
  }
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

const planGap = (D: DItem[], L: LItem[]): GapPlan | { bail: BailReason; detail: string } => {
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

  // Owner / element-piece clamp: expand the middle until no group straddles it.
  const groupIndex = new Map<object, number[]>();
  D.forEach((item, idx) => {
    for (const g of groupsOf(item)) {
      const arr = groupIndex.get(g);
      if (arr) arr.push(idx); else groupIndex.set(g, [idx]);
    }
  });
  for (let guard = 0; guard < D.length + 2; guard++) {
    let changed = false;
    for (const idxs of groupIndex.values()) {
      const inside = idxs.filter(x => x >= i && x < ei).length;
      if (inside === 0 || inside === idxs.length) continue;
      const first = idxs[0], last = idxs[idxs.length - 1];
      while (prefix.length && prefix[prefix.length - 1][0] >= first) prefix.pop();
      while (suffix.length && suffix[suffix.length - 1][0] < last + 1) suffix.pop();
      i = prefix.length ? prefix[prefix.length - 1][0] + 1 : 0;
      j = prefix.length ? prefix[prefix.length - 1][1] + 1 : 0;
      ei = suffix.length ? suffix[suffix.length - 1][0] : D.length;
      ej = suffix.length ? suffix[suffix.length - 1][1] : L.length;
      i = skipFixed(i, ei);
      changed = true;
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

const serializeLexMiddle = (L: LItem[], j: number, ej: number, deps: ReconcileDeps): Node[] => {
  const out: Node[] = [];
  let run = '';
  let runFmt = 0;
  const flush = () => { if (run) { out.push(deps.serializeTextRun(run, runFmt)); run = ''; } };
  for (let k = j; k < ej; k++) {
    const item = L[k];
    if (item.k === 'c') {
      if (run && item.fmt !== runFmt) flush();
      runFmt = item.fmt;
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
 */
const applyGap = (rootEl: Element, D: DItem[], L: LItem[], plan: GapPlan, deps: ReconcileDeps): boolean => {
  const { i, ei, j, ej } = plan;
  if (i === ei && j === ej) return true;
  const newNodes = serializeLexMiddle(L, j, ej, deps);

  if (i === ei) {
    // Pure insertion, after the prefix.
    let parent: Node | null = null;
    let ref: Node | null = null;
    if (i > 0) {
      const prev = D[i - 1];
      if (prev.k === 'c' && prev.piece.kind === 'text' && !prev.piece.owner) {
        const node = prev.piece.node;
        const rawEnd = prev.piece.map[prev.off + 1];
        parent = node.parentNode;
        ref = rawEnd < node.data.length ? node.splitText(rawEnd) : node.nextSibling;
      } else {
        const top = topNodeOf(prev);
        if (top) { parent = top.parentNode; ref = top.nextSibling; }
      }
    }
    if (!parent && i < D.length) {
      const next = D[i];
      if (next.k === 'c' && next.piece.kind === 'text' && !next.piece.owner) {
        const node = next.piece.node;
        const rawStart = next.piece.map[next.off];
        parent = node.parentNode;
        ref = rawStart > 0 ? node.splitText(rawStart) : node;
      } else {
        const top = topNodeOf(next);
        if (top) { parent = top.parentNode; ref = top; }
      }
    }
    if (!parent) {
      if (D.length > 0) return false; // a block boundary with nothing around it
      parent = rootEl;
      ref = null;
    }
    for (const n of newNodes) parent.insertBefore(n, ref);
    return true;
  }

  const first = D[i];
  const last = D[ei - 1];
  // Before mutating: every middle item must resolve to a sibling run under one parent.
  const tops: Node[] = [];
  for (let k = i; k < ei; k++) {
    const t = topNodeOf(D[k]);
    if (!t) return false;
    if (tops[tops.length - 1] !== t) tops.push(t);
  }
  const parent = tops[0].parentNode;
  if (!parent || tops.some(t => t.parentNode !== parent)) return false;
  for (let k = 1; k < tops.length; k++) {
    if (tops[k - 1].nextSibling !== tops[k]) return false;
  }

  // Split the end first, then the start, so start offsets stay valid when both
  // fall in one text node.
  let endNode: Node = tops[tops.length - 1];
  if (last.k === 'c' && last.piece.kind === 'text' && !last.piece.owner) {
    const node = last.piece.node;
    const rawEnd = last.piece.map[last.off + 1];
    if (rawEnd < node.data.length) node.splitText(rawEnd);
    endNode = node;
  }
  let startNode: Node = tops[0];
  if (first.k === 'c' && first.piece.kind === 'text' && !first.piece.owner) {
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
  for (const n of toRemove) parent.removeChild(n);
  for (const n of newNodes) parent.insertBefore(n, ref);
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

  const dSig = D.filter(u => u.kind !== 'fixed').map(u => (u as DTextUnit | DAtomicUnit).sig);
  const lSig = L.map(u => u.sig);
  if (dSig.length === lSig.length && dSig.every((s, k) => s === lSig[k])) {
    return report({ status: 'untouched', tag });
  }

  // Anchors: LCS over the non-fixed D units and the L units.
  const dNonFixedIdx: number[] = [];
  D.forEach((u, k) => { if (u.kind !== 'fixed') dNonFixedIdx.push(k); });
  const pairs = lcsPairs(dSig, lSig).map(([a, b]) => [dNonFixedIdx[a], b] as [number, number]);

  // Gaps between consecutive anchors (D units [dFrom, dTo) ↔ L units [lFrom, lTo)).
  const gaps: Array<{ D: DItem[]; L: LItem[] }> = [];
  let dFrom = 0, lFrom = 0;
  const pushGap = (dTo: number, lTo: number) => {
    const dItems: DItem[] = [];
    for (let k = dFrom; k < dTo; k++) dItems.push(...dItemsOf(D[k]));
    const lItems: LItem[] = [];
    for (let k = lFrom; k < lTo; k++) lItems.push(...lItemsOf(L[k]));
    if (dItems.length || lItems.length) gaps.push({ D: dItems, L: lItems });
  };
  for (const [dk, lk] of pairs) {
    pushGap(dk, lk);
    dFrom = dk + 1;
    lFrom = lk + 1;
  }
  pushGap(D.length, L.length);

  // Plan every gap before touching the DOM, so a bail leaves the clone pristine.
  const plans: Array<{ gap: { D: DItem[]; L: LItem[] }; plan: GapPlan }> = [];
  for (const gap of gaps) {
    const plan = planGap(gap.D, gap.L);
    if ('bail' in plan) return report({ status: 'bail', reason: plan.bail, tag, detail: plan.detail });
    plans.push({ gap, plan });
  }
  for (const { gap, plan } of plans) {
    if (!applyGap(rootEl, gap.D, gap.L, plan, deps)) {
      return report({ status: 'bail', reason: 'unsupported', tag, detail: 'changed run is not one sibling run' });
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
