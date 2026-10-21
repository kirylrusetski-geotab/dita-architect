// Wrap the selected text in a DITA inline element, or unwrap the element at
// the caret (ADR-010 slice B, v0.10.0).
//
// A wrap builds exactly the Lexical shape the parser builds for that element,
// so re-opening the topic yields the same tree and the serializer's inline
// reconciler (ADR-010 slice A) sees an ordinary new inline element:
//   uicontrol  token + bold   + originMap inlineTag
//   wintitle   token + italic + originMap inlineTag
//   term, filepath, ph   token + originMap inlineTag
//   codeph     code format only, no stamp (the parser keeps codeph as a format)
//   xref       LinkNode (+ originMap inlineAttrs {format, scope} when given)
//
// Undo safety: wrap and unwrap always CREATE nodes and never delete or edit an
// existing node key's originMap entry. History restores old keys on undo, and
// their stamps must still describe them.
//
// v1 scope, refused with a reason rather than half-done: the selection must be
// non-empty plain text (no bold/italic) inside one block, and must not touch an
// existing inline element, link, or chip.
import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  $isElementNode,
  $createTextNode,
  type LexicalNode,
  type TextNode,
  type ElementNode,
} from 'lexical';
import { $createLinkNode, $isLinkNode, type LinkNode } from '@lexical/link';
import type { NodeOriginMapType } from '../sync/nodeOriginMap';

export const WRAP_TAGS = ['uicontrol', 'codeph', 'ph', 'term', 'filepath', 'wintitle', 'xref'] as const;
export type WrapTag = typeof WRAP_TAGS[number];

export const WRAP_TAG_LABELS: Record<WrapTag, string> = {
  uicontrol: 'UI control',
  codeph: 'Code phrase',
  ph: 'Phrase',
  term: 'Term',
  filepath: 'File path',
  wintitle: 'Window title',
  xref: 'Cross-reference',
};

export interface XrefAttrs {
  href: string;
  format?: string;
  scope?: string;
}

export type WrapRefusal =
  | 'no-selection'
  | 'collapsed'
  | 'cross-block'
  | 'overlap'
  | 'formatted'
  | 'whitespace'
  | 'no-href'
  | 'bad-href';

export type UnwrapRefusal = 'nothing-to-unwrap';

export type WrapResult = { status: 'ok' } | { status: 'refused'; reason: WrapRefusal };
export type UnwrapResult = { status: 'ok' } | { status: 'refused'; reason: UnwrapRefusal };

/** Author-facing toast copy for each refusal. */
export const WRAP_REFUSAL_MESSAGES: Record<WrapRefusal | UnwrapRefusal, string> = {
  'no-selection': 'Select some text to wrap first',
  collapsed: 'Select some text to wrap first',
  'cross-block': 'Select text inside one paragraph to wrap it',
  overlap: "The selection touches an existing inline element. Select plain text only",
  formatted: 'Remove bold or italic from the selection before wrapping it',
  whitespace: 'Select some text to wrap, not only spaces',
  'no-href': 'Enter a link target first',
  'bad-href': 'Invalid URL scheme',
  'nothing-to-unwrap': 'Put the cursor inside an inline element to remove it',
};

const STAMPED: ReadonlySet<string> = new Set(['uicontrol', 'ph', 'term', 'filepath', 'wintitle']);
const UNWRAPPABLE: ReadonlySet<string> = new Set(WRAP_TAGS);

const refuse = <R extends string>(reason: R) => ({ status: 'refused' as const, reason });

/** Same inference the serializer applies to a LinkNode without inlineAttrs. */
export const inferXrefFormat = (href: string): string =>
  href.startsWith('http://') || href.startsWith('https://') ? 'html' : 'dita';

const isUnsafeHref = (href: string): boolean => {
  const h = href.trim().toLowerCase();
  return h.startsWith('javascript:') || h.startsWith('data:') || h.startsWith('vbscript:');
};

/** Nearest ancestor that is a block (non-inline) element. */
const blockOf = (node: LexicalNode): ElementNode | null => {
  let cur: LexicalNode | null = node.getParent();
  while (cur && $isElementNode(cur) && cur.isInline()) cur = cur.getParent();
  return cur && $isElementNode(cur) ? cur : null;
};

/** Why a node in the selected run disqualifies the wrap, or null if it is plain text. */
const disqualify = (node: LexicalNode, originMap: NodeOriginMapType): WrapRefusal | null => {
  if (!$isTextNode(node) || node.getType() !== 'text' || !node.isSimpleText()) return 'overlap';
  if (originMap.get(node.getKey())?.inlineTag) return 'overlap';
  if (node.hasFormat('code')) return 'overlap'; // an existing <codeph>
  if (node.getFormat() !== 0) return 'formatted';
  return null;
};

/**
 * Wrap the current range selection in `tag`. Must run inside editor.update().
 * For `xref`, `attrs.href` is required; `format`/`scope` are written exactly as
 * given, with `format` inferred from the href when only `scope` is given (so a
 * scoped xref always carries a format, as the serializer's default would).
 */
export const $wrapSelectionInInlineTag = (
  tag: WrapTag,
  originMap: NodeOriginMapType,
  attrs?: XrefAttrs,
): WrapResult => {
  const sel = $getSelection();
  if (!$isRangeSelection(sel)) return refuse('no-selection');
  if (sel.isCollapsed()) return refuse('collapsed');

  if (tag === 'xref') {
    const href = attrs?.href?.trim() ?? '';
    if (!href) return refuse('no-href');
    if (isUnsafeHref(href)) return refuse('bad-href');
  }

  const [start, end] = sel.isBackward() ? [sel.focus, sel.anchor] : [sel.anchor, sel.focus];
  const startNode = start.getNode();
  const endNode = end.getNode();
  if (start.type !== 'text' || end.type !== 'text') {
    // An element-point selection (rare: a whole-block select) is not a text run.
    return blockOf(startNode) === blockOf(endNode) ? refuse('overlap') : refuse('cross-block');
  }
  if (blockOf(startNode) !== blockOf(endNode)) return refuse('cross-block');
  if (startNode.getParent() !== endNode.getParent() || $isLinkNode(startNode.getParent())) return refuse('overlap');

  // The run of sibling nodes from start to end must all be plain text.
  const run: TextNode[] = [];
  let cur: LexicalNode | null = startNode;
  for (;;) {
    if (!cur) return refuse('overlap');
    const why = disqualify(cur, originMap);
    if (why) return refuse(why);
    run.push(cur as TextNode);
    if (cur.is(endNode)) break;
    cur = cur.getNextSibling();
  }

  // Isolate the selected text into its own node(s). splitText's result starts
  // with the part before the first offset only when that offset is > 0.
  const s = start.offset;
  const e = end.offset;
  let mids: TextNode[];
  if (run.length === 1) {
    const parts = run[0].splitText(s, e);
    mids = [s > 0 ? parts[1] : parts[0]];
  } else {
    const first = run[0];
    const last = run[run.length - 1];
    const firstMid = s >= first.getTextContentSize() ? null : (s > 0 ? first.splitText(s)[1] : first);
    const lastMid = e <= 0 ? null : (e < last.getTextContentSize() ? last.splitText(e)[0] : last);
    mids = [...(firstMid ? [firstMid] : []), ...run.slice(1, -1), ...(lastMid ? [lastMid] : [])];
  }
  const text = mids.map(n => n.getTextContent()).join('');
  if (!text.trim()) return refuse('whitespace');

  let selectTarget: TextNode;
  if (tag === 'xref') {
    const href = (attrs?.href ?? '').trim();
    const link: LinkNode = $createLinkNode(href);
    const inner = $createTextNode(text);
    link.append(inner);
    const format = attrs?.format?.trim();
    const scope = attrs?.scope?.trim();
    if (format || scope) {
      const inlineAttrs: Record<string, string> = { format: format || inferXrefFormat(href) };
      if (scope) inlineAttrs.scope = scope;
      originMap.set(link.getKey(), { tag: 'xref', bodyIndex: -1, inlineAttrs });
    }
    mids[0].insertBefore(link);
    selectTarget = inner;
  } else {
    const node = $createTextNode(text);
    if (tag === 'codeph') {
      node.toggleFormat('code');
    } else {
      node.setMode('token');
      if (tag === 'uicontrol') node.toggleFormat('bold');
      else if (tag === 'wintitle') node.toggleFormat('italic');
      if (STAMPED.has(tag)) originMap.set(node.getKey(), { tag, bodyIndex: -1, inlineTag: tag });
    }
    mids[0].insertBefore(node);
    selectTarget = node;
  }
  mids.forEach(n => n.remove());
  selectTarget.select(0, text.length);
  return { status: 'ok' };
};

/**
 * Remove the inline element at the selection anchor, keeping its text. The
 * innermost element wins: a <uicontrol> inside an <xref> unwraps the uicontrol.
 * Must run inside editor.update().
 */
export const $unwrapInlineAtSelection = (originMap: NodeOriginMapType): UnwrapResult => {
  const sel = $getSelection();
  if (!$isRangeSelection(sel)) return refuse('nothing-to-unwrap');
  const node = sel.anchor.getNode();

  if ($isTextNode(node) && node.getType() === 'text') {
    const inlineTag = originMap.get(node.getKey())?.inlineTag;
    const isCodeph = !inlineTag && node.hasFormat('code');
    if ((inlineTag && UNWRAPPABLE.has(inlineTag)) || isCodeph) {
      const text = node.getTextContent();
      const plain = $createTextNode(text);
      // A stamped element's bold/italic was presentation for the tag; a
      // codeph only loses its code flag.
      if (isCodeph) plain.setFormat(node.getFormat() & ~16 /* IS_CODE */);
      node.replace(plain);
      plain.select(0, text.length);
      return { status: 'ok' };
    }
  }

  const link = $isLinkNode(node) ? node : $isLinkNode(node.getParent()) ? (node.getParent() as LinkNode) : null;
  if (link) {
    const children = link.getChildren();
    children.forEach(child => link.insertBefore(child));
    link.remove();
    const first = children[0];
    const last = children[children.length - 1];
    if ($isTextNode(first) && $isTextNode(last)) {
      const s = $getSelection();
      if ($isRangeSelection(s)) {
        s.anchor.set(first.getKey(), 0, 'text');
        s.focus.set(last.getKey(), last.getTextContentSize(), 'text');
      }
    }
    return { status: 'ok' };
  }

  return refuse('nothing-to-unwrap');
};
