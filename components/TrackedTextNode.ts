// FR-046 — TrackedTextNode: real text carrying a tracked-change mark as data.
//
// Insertions are ordinary editable text with kind:'insert'. Deletions are text
// KEPT in the tree with kind:'delete', token mode (atomic, self-defending
// against stray DOM mutation), struck through by CSS. Split markers are
// zero-length token nodes recording a paragraph split.
//
// Verified against lexical@0.16.0 source:
// - TextNode.splitText creates parts 2..n via $createTextNode (plain TextNodes),
//   so splitText is overridden here to re-wrap plain parts with the mark.
// - Normalization ($canSimpleTextNodesBeMerged) requires isSimpleText(), which
//   is false for any subclass — marks never merge into plain text, and empty
//   split markers are not garbage-collected.
// - The beforeinput typing fast path rejects token anchors and
//   $updateTextNodeFromDOMContent reverts DOM edits to token nodes.
import {
  TextNode,
  type EditorConfig,
  type LexicalNode,
  type NodeKey,
  type SerializedTextNode,
  type Spread,
} from 'lexical';
import type { TrackedMark } from '../lib/tracked-changes/model';

export type SerializedTrackedTextNode = Spread<{ mark: TrackedMark }, SerializedTextNode>;

export class TrackedTextNode extends TextNode {
  __mark: TrackedMark;

  static getType(): string {
    return 'tracked-text';
  }

  static clone(node: TrackedTextNode): TrackedTextNode {
    return new TrackedTextNode(node.__text, node.__mark, node.__key);
  }

  constructor(text: string, mark: TrackedMark, key?: NodeKey) {
    super(text, key);
    this.__mark = mark;
  }

  getMark(): TrackedMark {
    return this.getLatest().__mark;
  }

  setMark(mark: TrackedMark): this {
    const writable = this.getWritable();
    writable.__mark = mark;
    return writable;
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config);
    dom.classList.add(markCssClass(this.__mark));
    dom.setAttribute('data-change-id', this.__mark.changeId);
    return dom;
  }

  updateDOM(prevNode: TextNode, dom: HTMLElement, config: EditorConfig): boolean {
    const prev = prevNode as TrackedTextNode;
    // Force DOM recreation when the mark identity or kind changed so the CSS
    // class and data attribute stay correct; otherwise defer to TextNode.
    if (prev.__mark.kind !== this.__mark.kind || prev.__mark.changeId !== this.__mark.changeId) {
      return true;
    }
    return super.updateDOM(prevNode, dom, config);
  }

  // VERIFIED HAZARD (lexical@0.16.0, Lexical.dev.mjs ~5015): TextNode.splitText
  // builds parts 2..n with $createTextNode — plain TextNodes that would drop
  // the mark. Post-process: replace any plain part with a TrackedTextNode
  // carrying this node's mark. replace() transfers selection points.
  splitText(...splitOffsets: number[]): TextNode[] {
    const mark = this.getMark();
    // Mode must come from the ORIGINAL node: splitText copies only
    // format/style/detail onto parts 2..n, so a token delete-mark would
    // otherwise yield 'normal'-mode parts that lose their atomicity.
    const mode = this.getMode();
    const parts = super.splitText(...splitOffsets);
    return parts.map(part => {
      if ($isTrackedTextNode(part)) return part;
      const replacement = new TrackedTextNode(part.getTextContent(), mark);
      replacement.setFormat(part.getFormat());
      replacement.setStyle(part.getStyle());
      replacement.setDetail(part.getDetail());
      replacement.setMode(mode);
      return part.replace(replacement);
    });
  }

  static importJSON(serializedNode: SerializedTrackedTextNode): TrackedTextNode {
    const node = new TrackedTextNode(serializedNode.text, serializedNode.mark);
    node.setFormat(serializedNode.format);
    node.setDetail(serializedNode.detail);
    node.setMode(serializedNode.mode);
    node.setStyle(serializedNode.style);
    return node;
  }

  exportJSON(): SerializedTrackedTextNode {
    return {
      ...super.exportJSON(),
      mark: this.getMark(),
      type: 'tracked-text',
      version: 1,
    };
  }
}

function markCssClass(mark: TrackedMark): string {
  switch (mark.kind) {
    case 'delete':
      return 'tracked-delete-mark';
    case 'split':
      return 'tracked-split-mark';
    default:
      return 'tracked-insert-mark';
  }
}

export function $createTrackedTextNode(text: string, mark: TrackedMark): TrackedTextNode {
  const node = new TrackedTextNode(text, mark);
  // Delete and split marks are atomic: token mode makes the typing fast path
  // reject them and makes Lexical revert any stray DOM mutation inside them.
  if (mark.kind !== 'insert') {
    node.setMode('token');
  }
  return node;
}

export function $isTrackedTextNode(
  node: LexicalNode | null | undefined,
): node is TrackedTextNode {
  return node instanceof TrackedTextNode;
}
