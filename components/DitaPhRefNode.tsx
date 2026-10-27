import React, { useContext } from 'react';
import { DecoratorNode } from 'lexical';
import type { LexicalEditor, EditorConfig, NodeKey, SerializedLexicalNode } from 'lexical';
import { KeyRegistryContext } from './KeyRegistryContext';
import { chipKeyState, CHIP_STATE_CLASS } from '../lib/key-chip-state';

interface SerializedDitaPhRefNode extends SerializedLexicalNode {
  refType: string;
  refValue: string;
  originalText: string;
  /** The element the chip stands for (BUG-46). Absent in state written before it existed: `ph`. */
  refTag?: string;
}

// ADR-013 decision 7: the key state is read from context while rendering —
// connecting or reloading a map re-renders chips and never touches the editor.
function PhRefComponent({ refType, refValue }: { refType: string; refValue: string }) {
  const registry = useContext(KeyRegistryContext);
  const keyState = chipKeyState(refType, refValue, registry);
  return (
    <code
      contentEditable={false}
      className={keyState ? `dita-chip ${CHIP_STATE_CLASS[keyState.state]}` : 'dita-chip'}
      title={keyState?.tooltip}
    >
      {refValue}
    </code>
  );
}

export class DitaPhRefNode extends DecoratorNode<React.ReactElement> {
  __refType: string;
  __refValue: string;
  __originalText: string;
  // BUG-46 (ADR-013): the element this chip stands for — `ph`, `keyword`,
  // `uicontrol`, … — so a chip the author creates serializes as that element,
  // and the reconciler never matches a <keyword> chip to a <ph> one.
  __refTag: string;

  constructor(refType: string, refValue: string, originalText: string, refTag = 'ph', key?: NodeKey) {
    super(key);
    this.__refType = refType;
    this.__refValue = refValue;
    this.__originalText = originalText;
    this.__refTag = refTag;
  }

  static getType(): string {
    return 'ditaphref';
  }

  static clone(node: DitaPhRefNode): DitaPhRefNode {
    return new DitaPhRefNode(node.__refType, node.__refValue, node.__originalText, node.__refTag, node.__key);
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const span = document.createElement('span');
    return span;
  }

  updateDOM(): boolean {
    return false;
  }

  decorate(_editor: LexicalEditor, _config: EditorConfig): React.ReactElement {
    return <PhRefComponent refType={this.__refType} refValue={this.__refValue} />;
  }

  getTextContent(): string {
    return this.__originalText;
  }

  getRefType(): string {
    return this.__refType;
  }

  getRefValue(): string {
    return this.__refValue;
  }

  getRefTag(): string {
    return this.__refTag;
  }

  isInline(): boolean {
    return true;
  }

  isKeyboardSelectable(): boolean {
    return true;
  }

  static importJSON(serializedNode: SerializedDitaPhRefNode): DitaPhRefNode {
    return new DitaPhRefNode(
      serializedNode.refType,
      serializedNode.refValue,
      serializedNode.originalText,
      serializedNode.refTag ?? 'ph',
    );
  }

  exportJSON(): SerializedDitaPhRefNode {
    // No `...super.exportJSON()`: Lexical's base implementation throws
    // ("base method not extended"), so a chip could never be exported (found
    // by BUG-46's JSON test). `type` and `version` are the whole base shape.
    return {
      type: 'ditaphref',
      version: 1,
      refType: this.__refType,
      refValue: this.__refValue,
      originalText: this.__originalText,
      refTag: this.__refTag,
    };
  }
}

export function $createDitaPhRefNode(
  refType: string,
  refValue: string,
  originalText: string,
  refTag = 'ph',
): DitaPhRefNode {
  return new DitaPhRefNode(refType, refValue, originalText, refTag);
}

export function $isDitaPhRefNode(node: unknown): node is DitaPhRefNode {
  return node instanceof DitaPhRefNode;
}
