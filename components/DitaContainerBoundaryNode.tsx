import React from 'react';
import { DecoratorNode } from 'lexical';
import type { LexicalEditor, EditorConfig, NodeKey, SerializedLexicalNode } from 'lexical';

/**
 * ADR-009 — a visual-only marker emitted at the start of each troubleshooting
 * section-class container (<condition>, <cause>, <remedy>) when the parser
 * flattens the container to body-level nodes.
 *
 * It does two jobs:
 *  1. Shows the author where a container begins (small uppercase label with
 *     the container's bar colour) — the only cue a flattened structure has.
 *  2. Keeps Lexical from merging adjacent same-type lists across a container
 *     boundary. `ListNode.transform()` merges a list with its next sibling
 *     when the list types match (verified in @lexical/list 0.16.0,
 *     `mergeNextSiblingListIfSameType`); a non-list node between them is the
 *     only reliable way to prevent it, and without it a remedy's <steps>
 *     following another remedy's <ol> would be swallowed on parse.
 *
 * It serializes to nothing: the serializer filters it out of every container
 * walk, and `getTextContent()` is '' so text comparisons never see it.
 */
// 'section' (ADR-011): untitled body-level sections, whose wrapper has no
// other visual cue. Titled sections show their h2 instead.
// 'list-break' (BUG-26): a bare, invisible marker between two source lists of
// the same type that are directly adjacent with nothing else between them —
// not a container at all, just the only reliable way to stop
// ListNode.transform()'s own merge (see the class doc above). Unlike the
// other kinds it carries no containerPath and renders no label.
export type TroubleContainerKind = 'condition' | 'cause' | 'remedy' | 'section' | 'list-break';

const LABELS: Record<TroubleContainerKind, string> = {
  condition: 'Condition',
  cause: 'Cause',
  remedy: 'Remedy',
  section: 'Section',
  'list-break': '',
};

interface SerializedDitaContainerBoundaryNode extends SerializedLexicalNode {
  kind: TroubleContainerKind;
}

function BoundaryComponent({ kind }: { kind: TroubleContainerKind }) {
  if (kind === 'list-break') return null;
  return (
    <div
      className={`dita-editor-container-boundary dita-editor-container-boundary--${kind}`}
      contentEditable={false}
      aria-label={`${LABELS[kind]} section`}
    >
      {LABELS[kind]}
    </div>
  );
}

export class DitaContainerBoundaryNode extends DecoratorNode<React.ReactElement> {
  __kind: TroubleContainerKind;

  constructor(kind: TroubleContainerKind, key?: NodeKey) {
    super(key);
    this.__kind = kind;
  }

  static getType(): string {
    return 'dita-container-boundary';
  }

  static clone(node: DitaContainerBoundaryNode): DitaContainerBoundaryNode {
    return new DitaContainerBoundaryNode(node.__kind, node.__key);
  }

  getKind(): TroubleContainerKind {
    return this.__kind;
  }

  createDOM(_config: EditorConfig): HTMLElement {
    return document.createElement('div');
  }

  updateDOM(): boolean {
    return false;
  }

  decorate(_editor: LexicalEditor, _config: EditorConfig): React.ReactElement {
    return <BoundaryComponent kind={this.__kind} />;
  }

  isInline(): boolean {
    return false;
  }

  /** Never contributes text — word counts, readability, and text comparisons ignore it. */
  getTextContent(): string {
    return '';
  }

  isKeyboardSelectable(): boolean {
    return false;
  }

  static importJSON(serializedNode: SerializedDitaContainerBoundaryNode): DitaContainerBoundaryNode {
    return new DitaContainerBoundaryNode(serializedNode.kind ?? 'cause');
  }

  exportJSON(): SerializedDitaContainerBoundaryNode {
    return {
      ...super.exportJSON(),
      type: 'dita-container-boundary',
      version: 1,
      kind: this.__kind,
    };
  }
}

export function $createDitaContainerBoundaryNode(kind: TroubleContainerKind): DitaContainerBoundaryNode {
  return new DitaContainerBoundaryNode(kind);
}

export function $isDitaContainerBoundaryNode(node: unknown): node is DitaContainerBoundaryNode {
  return node instanceof DitaContainerBoundaryNode;
}
