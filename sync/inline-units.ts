// Inline content scanner — the single source of truth for how DITA inline
// content maps to Lexical nodes (ADR-010 slice A).
//
// The parser (`parseTextNodes` / `parseInlineElement` in parseXmlToLexical.ts)
// builds its Lexical nodes from the atoms this module produces, and the inline
// reconciler (inline-reconcile.ts) reads the same atoms to decide which DOM
// nodes an edited Lexical paragraph still matches. Because both sides share one
// scanner there is no "mirror" that can drift from the parser: whatever the
// parser does to a DOM child, the reconciler expects exactly that.
//
// Every rule in here reproduces the pre-ADR-010 parser byte-for-byte, including
// its quirks (see the comments on edge trimming and container inlines). The
// byte-stability corpus is the guard: a change to this file that alters what
// any fixture parses to fails `tests/sync/byte-stability.test.ts`.
import { $createTextNode } from 'lexical';
import { $createLinkNode } from '@lexical/link';
import { $createDitaPhRefNode } from '../components/DitaPhRefNode';
import type { NodeOriginMapType } from './nodeOriginMap';

export const FMT_BOLD = 1;
export const FMT_ITALIC = 2;
export const FMT_CODE = 4;

/** The parser's whitespace normalization for text nodes: a run containing a
 *  newline collapses to one space. Applied to DOM text nodes only — the text
 *  of an inline element (`<b>`, `<uicontrol>`) is taken raw via textContent. */
export const WS_RUN = /[ \t]*\n[ \t\n]*/g;

/** Block children a <note> may hold. The parser flattens each into the quote
 *  with its own inline parse; the reconciler treats the boundary between two
 *  of them as a fixed point. One set, shared by both. */
export const NOTE_BLOCK_TAGS = new Set(['p', 'ul', 'ol', 'codeblock', 'table', 'simpletable', 'fig', 'image', 'section']);

/**
 * How a parent's child list is scanned.
 * - `trim`: `parseTextNodes` semantics — PI-adjacent whitespace-only text is
 *   dropped, and the first/last resulting Lexical node is edge-trimmed.
 * - `segment`: the block-split loops (`<p>` wrapping blocks, table cells,
 *   `<dd>`) — whitespace-only text is dropped, nothing is trimmed, PIs and
 *   comments are ignored.
 * - `keep`: the children of a mixed-content `<b>`/`<i>`/`<codeph>` (BUG-44) —
 *   every text node is kept and nothing is trimmed; the trim of the paragraph
 *   the element sits in still applies to its edges.
 */
export type ScanMode = 'trim' | 'segment' | 'keep';

interface AtomBase {
  /** The DOM node this atom came from. For a `fixed` block boundary it is null. */
  node: Node | null;
  /** When the atom was produced inside a container inline (`<menucascade>`,
   *  a refless `<ph>` holding other inline tags), the top-level container
   *  element. The parser flattens containers, so a change to any atom of a
   *  container rewrites the whole container (BUG-34, the known limit). */
  owner: Element | null;
}

/** Plain text, or the text of a `<b>`/`<i>`/`<codeph>`, as one Lexical TextNode. */
export interface TextAtom extends AtomBase {
  kind: 'text';
  fmt: number;
  /** The text the Lexical node carries (normalized and, at the edges, trimmed). */
  text: string;
  /** 'textnode': `text` is the collapsed (and possibly trimmed) data of a DOM
   *  Text node; `lead`/`trail` count the normalized characters the edge trim
   *  removed. 'element': `text` is the raw textContent of an inline element. */
  source: 'textnode' | 'element';
  lead: number;
  trail: number;
}

/** A leaf inline element preserved via `originMap.inlineTag` (token-mode TextNode). */
export interface StampedAtom extends AtomBase {
  kind: 'stamped';
  node: Element;
  tag: string;
  attrs: Record<string, string>;
  text: string;
  fmt: number;
}

/** `<xref>` → LinkNode. `attrs` is every attribute except href, or null if none. */
export interface LinkAtom extends AtomBase {
  kind: 'link';
  node: Element;
  href: string;
  attrs: Record<string, string> | null;
  children: Atom[];
}

/** A ref-carrying `<ph>`/`<term>`, any other ref-carrying inline element with
 *  no text of its own (BUG-46), or an inline `<image>` → DitaPhRefNode. */
export interface ChipAtom extends AtomBase {
  kind: 'chip';
  node: Element;
  /** The element's tag, lower-cased: the chip serializes as this element. */
  refTag: string;
  refType: string;
  refValue: string;
  text: string;
}

/** A DOM node (or block boundary) with no Lexical presence: PIs, comments,
 *  CDATA, whitespace the parser drops, text that trims to nothing. */
export interface FixedAtom extends AtomBase {
  kind: 'fixed';
}

export type Atom = TextAtom | StampedAtom | LinkAtom | ChipAtom | FixedAtom;

const fixed = (node: Node | null, owner: Element | null): FixedAtom => ({ kind: 'fixed', node, owner });

const attrsOf = (el: Element, skip?: string): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const attr of Array.from(el.attributes)) {
    if (attr.name !== skip) out[attr.name] = attr.value;
  }
  return out;
};

/** Add a wrapping `<b>`/`<i>`/`<codeph>`'s format to atoms scanned inside it
 *  (BUG-44): text and stamped atoms carry it, a link's children carry it, a
 *  chip has no format to carry. */
const withFormat = (atoms: Atom[], fmt: number): Atom[] =>
  atoms.map(a => {
    if (a.kind === 'text' || a.kind === 'stamped') return { ...a, fmt: a.fmt | fmt };
    if (a.kind === 'link') return { ...a, children: withFormat(a.children, fmt) };
    return a;
  });

/**
 * Scan one inline element the way `parseInlineElement` did. Branch order is
 * load-bearing: a `<b>`/`<i>`/`<codeph>` is formatted text, never a container,
 * while `<ph><b>x</b></ph>` is a container. A `<b>`/`<i>`/`<codeph>` with
 * element children (BUG-44) is scanned child by child, each child carrying the
 * element's format — taking its textContent (the old rule) dropped the nested
 * element, and with it any variable chip, from the editor.
 */
export const scanInlineElement = (el: Element, owner: Element | null): Atom[] => {
  const tag = el.tagName.toLowerCase();

  if (tag === 'xref') {
    const href = el.getAttribute('href') || '';
    const children = scanInlineChildren(Array.from(el.childNodes), 'trim', null);
    const attrs = attrsOf(el, 'href');
    return [{ kind: 'link', node: el, owner, href, attrs: Object.keys(attrs).length > 0 ? attrs : null, children }];
  }

  const hasRef = !!(el.getAttribute('conkeyref') || el.getAttribute('keyref') || el.getAttribute('conref'));
  // A <ph>/<term> with a ref is a chip whatever it holds. Any other element
  // with a ref and no text of its own is one too (BUG-46): its content comes
  // from the reference, so as text it would be an empty, invisible node —
  // <keyword conkeyref="varsProductnames/…"/> is the common real case.
  // An element with fallback text keeps the stamped-text display below, and an
  // <image> stays an image chip whatever it carries.
  if (hasRef && tag !== 'image' && (tag === 'ph' || tag === 'term' || !(el.textContent || '').trim())) {
    const refType = el.hasAttribute('conkeyref') ? 'conkeyref' : el.hasAttribute('keyref') ? 'keyref' : 'conref';
    const refValue = el.getAttribute('conkeyref') || el.getAttribute('keyref') || el.getAttribute('conref') || '';
    return [{ kind: 'chip', node: el, owner, refTag: tag, refType, refValue, text: el.textContent || '' }];
  }

  if (tag === 'image') {
    const href = el.getAttribute('href') || '';
    const alt = el.querySelector('alt')?.textContent || el.getAttribute('alt') || '';
    return [{ kind: 'chip', node: el, owner, refTag: 'image', refType: 'image', refValue: href, text: alt }];
  }

  const elementText = (fmt: number): TextAtom => ({
    kind: 'text', node: el, owner, fmt, text: el.textContent || '', source: 'element', lead: 0, trail: 0,
  });
  const ownFmt =
    tag === 'codeph' ? FMT_CODE
    : tag === 'b' || tag === 'strong' ? FMT_BOLD
    : tag === 'i' || tag === 'em' ? FMT_ITALIC
    : 0;
  const hasElementChild = Array.from(el.childNodes).some(c => c.nodeType === Node.ELEMENT_NODE);
  if (ownFmt) {
    if (!hasElementChild) return [elementText(ownFmt)];
    return withFormat(scanInlineChildren(Array.from(el.childNodes), 'keep', owner ?? el), ownFmt);
  }

  if (hasElementChild) {
    // Container inline: flattened to its children's atoms (with the
    // container's own edge trim, as parseTextNodes(el) applied it). The
    // outermost container is the owner.
    return scanInlineChildren(Array.from(el.childNodes), 'trim', owner ?? el);
  }

  // M1: generic leaf inline element — token-mode TextNode stamped with its tag.
  const fmt = tag === 'uicontrol' ? FMT_BOLD : tag === 'wintitle' ? FMT_ITALIC : 0;
  return [{ kind: 'stamped', node: el, owner, tag, attrs: attrsOf(el), text: el.textContent || '', fmt }];
};

/**
 * Scan a parent's child nodes into atoms. `childNodes` is passed explicitly so
 * the reconciler can scan a sub-range (a `<p>`-wrapper inline segment) with the
 * same rules; the PI-adjacency check looks only within the given list, exactly
 * as the parser's index-based check did over `node.childNodes`.
 */
export const scanInlineChildren = (childNodes: Node[], mode: ScanMode, owner: Element | null): Atom[] => {
  const atoms: Atom[] = [];

  childNodes.forEach((child, index) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const raw = child.textContent;
      if (!raw) { atoms.push(fixed(child, owner)); return; }
      if (mode === 'trim' && /^\s+$/.test(raw)) {
        const prev = index > 0 ? childNodes[index - 1] : null;
        const next = index < childNodes.length - 1 ? childNodes[index + 1] : null;
        if (
          (prev && prev.nodeType === Node.PROCESSING_INSTRUCTION_NODE) ||
          (next && next.nodeType === Node.PROCESSING_INSTRUCTION_NODE)
        ) {
          atoms.push(fixed(child, owner));
          return;
        }
      }
      const text = raw.replace(WS_RUN, ' ');
      if (mode === 'segment' && !text.trim()) { atoms.push(fixed(child, owner)); return; }
      atoms.push({ kind: 'text', node: child, owner, fmt: 0, text, source: 'textnode', lead: 0, trail: 0 });
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      scanInlineElement(child as Element, owner).forEach(a => atoms.push(a));
    } else {
      // Processing instruction, comment, CDATA — no Lexical node.
      atoms.push(fixed(child, owner));
    }
  });

  if (mode === 'trim') edgeTrim(atoms);
  return atoms;
};

/**
 * parseTextNodes' edge trim, reproduced on atoms. It acted on the first and
 * last *Lexical node* (so fixed atoms are skipped), only when that node was a
 * TextNode (text or stamped — not a link or chip), and it replaced a changed
 * node with a plain `$createTextNode(trimmed)`: the inlineTag stamp is lost. A
 * node that trimmed to nothing was dropped (here: becomes fixed, so the
 * reconciler still preserves its DOM node). BUG-44: a text atom keeps its
 * format — the old rule also dropped it, so `<b>bold <i>end </i></b>` at the
 * end of a paragraph showed its last run as plain text and an edit there
 * could not stay inside the elements it came from.
 */
const edgeTrim = (atoms: Atom[]): void => {
  const trimAt = (idx: number, re: RegExp, side: 'lead' | 'trail'): void => {
    const atom = atoms[idx];
    if (atom.kind !== 'text' && atom.kind !== 'stamped') return;
    const t = atom.text;
    const trimmed = t.replace(re, '');
    if (!trimmed) {
      atoms[idx] = fixed(atom.node, atom.owner);
    } else if (trimmed !== t) {
      const removed = t.length - trimmed.length;
      const prevLead = atom.kind === 'text' ? atom.lead : 0;
      const prevTrail = atom.kind === 'text' ? atom.trail : 0;
      atoms[idx] = {
        kind: 'text',
        node: atom.node,
        owner: atom.owner,
        fmt: atom.kind === 'text' ? atom.fmt : 0,
        text: trimmed,
        source: atom.kind === 'text' ? atom.source : 'element',
        lead: side === 'lead' ? prevLead + removed : prevLead,
        trail: side === 'trail' ? prevTrail + removed : prevTrail,
      };
    }
  };

  const first = atoms.findIndex(a => a.kind !== 'fixed');
  if (first !== -1) trimAt(first, /^\s+/, 'lead');
  let last = -1;
  for (let i = atoms.length - 1; i >= 0; i--) {
    if (atoms[i].kind !== 'fixed') { last = i; break; }
  }
  if (last !== -1) trimAt(last, /\s+$/, 'trail');
};

/**
 * Build Lexical nodes from atoms. Must run inside editor.update(). This is the
 * parser's node construction, unchanged: plain/format text → TextNode with the
 * format flags; stamped → token-mode TextNode + originMap inlineTag (+ attrs
 * when non-empty); link → LinkNode + children (+ originMap inlineAttrs when
 * non-empty); chip → DitaPhRefNode; fixed → nothing.
 */
export const atomsToLexical = (atoms: Atom[], originMap?: NodeOriginMapType): any[] => {
  const nodes: any[] = [];
  for (const atom of atoms) {
    switch (atom.kind) {
      case 'text': {
        const n = $createTextNode(atom.text);
        if (atom.fmt & FMT_CODE) n.toggleFormat('code');
        if (atom.fmt & FMT_BOLD) n.toggleFormat('bold');
        if (atom.fmt & FMT_ITALIC) n.toggleFormat('italic');
        nodes.push(n);
        break;
      }
      case 'stamped': {
        const n = $createTextNode(atom.text);
        n.setMode('token');
        // Its own presentation (bold for uicontrol, italic for wintitle) plus
        // any format from a <b>/<i>/<codeph> it sits in (BUG-44).
        if (atom.fmt & FMT_CODE) n.toggleFormat('code');
        if (atom.fmt & FMT_BOLD) n.toggleFormat('bold');
        if (atom.fmt & FMT_ITALIC) n.toggleFormat('italic');
        // BUG-43: mark a step of a <menucascade> so the editor can draw a
        // visual-only separator between consecutive steps.
        const cascadeStep = atom.owner?.tagName.toLowerCase() === 'menucascade';
        originMap?.set(
          n.getKey(),
          {
            tag: atom.tag,
            bodyIndex: -1,
            inlineTag: atom.tag,
            ...(Object.keys(atom.attrs).length > 0 ? { inlineAttrs: atom.attrs } : null),
            ...(cascadeStep ? { cascadeStep: true } : null),
          },
        );
        nodes.push(n);
        break;
      }
      case 'link': {
        const link = $createLinkNode(atom.href);
        atomsToLexical(atom.children, originMap).forEach(n => link.append(n));
        if (atom.attrs) {
          originMap?.set(link.getKey(), { tag: 'xref', bodyIndex: -1, inlineAttrs: atom.attrs });
        }
        nodes.push(link);
        break;
      }
      case 'chip':
        nodes.push($createDitaPhRefNode(atom.refType, atom.refValue, atom.text, atom.refTag));
        break;
      case 'fixed':
        break;
    }
  }
  return nodes;
};
