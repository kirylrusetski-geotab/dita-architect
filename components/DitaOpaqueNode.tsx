import React from 'react';
import { DecoratorNode } from 'lexical';
import type { LexicalEditor, EditorConfig, NodeKey, SerializedLexicalNode } from 'lexical';

interface SerializedDitaOpaqueNode extends SerializedLexicalNode {
  tagName: string;
  xmlContent: string;
}

function DitaOpaqueBlock({ tagName, xmlContent }: { tagName: string; xmlContent: string }) {
  const textPreview = xmlContent.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

  return (
    <div
      contentEditable={false}
      style={{
        margin: '6px 0',
        padding: '6px 10px',
        borderRadius: '4px',
        backgroundColor: 'var(--app-surface-raised, #1e1e1e)',
        border: '1px dashed var(--app-border-subtle, #333)',
        fontSize: '11px',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        color: 'var(--app-text-muted, #888)',
        userSelect: 'none',
        lineHeight: 1.4,
      }}
    >
      <span style={{ fontWeight: 600, color: 'var(--app-text-secondary, #aaa)' }}>
        &lt;{tagName}&gt;
      </span>
      {textPreview && (
        <span style={{ opacity: 0.6, marginLeft: '8px' }}>
          {textPreview.length > 120 ? textPreview.slice(0, 120) + '…' : textPreview}
        </span>
      )}
    </div>
  );
}

export class DitaOpaqueNode extends DecoratorNode<React.ReactElement> {
  __tagName: string;
  __xmlContent: string;

  constructor(tagName: string, xmlContent: string, key?: NodeKey) {
    super(key);
    this.__tagName = tagName;
    this.__xmlContent = xmlContent;
  }

  static getType(): string {
    return 'ditaopaque';
  }

  static clone(node: DitaOpaqueNode): DitaOpaqueNode {
    return new DitaOpaqueNode(node.__tagName, node.__xmlContent, node.__key);
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const div = document.createElement('div');
    return div;
  }

  updateDOM(): boolean {
    return false;
  }

  decorate(_editor: LexicalEditor, _config: EditorConfig): React.ReactElement {
    return <DitaOpaqueBlock tagName={this.__tagName} xmlContent={this.__xmlContent} />;
  }

  getTagName(): string {
    return this.__tagName;
  }

  getXmlContent(): string {
    return this.__xmlContent;
  }

  isInline(): boolean {
    return false;
  }

  isKeyboardSelectable(): boolean {
    return true;
  }

  static importJSON(serializedNode: SerializedDitaOpaqueNode): DitaOpaqueNode {
    return new DitaOpaqueNode(serializedNode.tagName, serializedNode.xmlContent);
  }

  exportJSON(): SerializedDitaOpaqueNode {
    // No `...super.exportJSON()` — see DitaCodeBlockNode's comment (BUG-47).
    return {
      type: 'ditaopaque',
      version: 1,
      tagName: this.__tagName,
      xmlContent: this.__xmlContent,
    };
  }
}

export function $createDitaOpaqueNode(tagName: string, xmlContent: string): DitaOpaqueNode {
  return new DitaOpaqueNode(tagName, xmlContent);
}

export function $isDitaOpaqueNode(node: unknown): node is DitaOpaqueNode {
  return node instanceof DitaOpaqueNode;
}
