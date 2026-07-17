import React from 'react';
import { DecoratorNode } from 'lexical';
import type { LexicalEditor, EditorConfig, NodeKey, SerializedLexicalNode } from 'lexical';

/**
 * A serializable, read-only model of an <info> block's content.
 * Built by the parser from each <info>'s children and rendered by the
 * decorator. The node serializes to nothing — the serializer leaves the
 * original <info> DOM byte-stable — so this model never round-trips to XML.
 */
export interface InfoModelNode {
  type: 'element' | 'text';
  tag?: string;
  attrs?: Record<string, string>;
  text?: string;
  children?: InfoModelNode[];
}

interface SerializedDitaInfoPreviewNode extends SerializedLexicalNode {
  content: InfoModelNode[];
}

/** Convert a DOM element's children into the serializable preview model. */
export function buildInfoModel(el: Element): InfoModelNode[] {
  const out: InfoModelNode[] = [];
  el.childNodes.forEach(child => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent ?? '';
      if (text.trim()) out.push({ type: 'text', text });
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const e = child as Element;
      const attrs: Record<string, string> = {};
      Array.from(e.attributes).forEach(a => { attrs[a.name] = a.value; });
      out.push({
        type: 'element',
        tag: e.tagName.toLowerCase(),
        attrs,
        children: buildInfoModel(e),
      });
    }
  });
  return out;
}

function renderModel(nodes: InfoModelNode[]): React.ReactNode[] {
  return nodes.map((n, i) => {
    if (n.type === 'text') return n.text;
    const kids = renderModel(n.children ?? []);
    switch (n.tag) {
      case 'codeblock':
        return (
          <pre key={i} className="dita-info-preview-codeblock">
            <code>{kids}</code>
          </pre>
        );
      case 'note': {
        const noteType = n.attrs?.type;
        return (
          <div key={i} className="dita-info-preview-note">
            {noteType ? <span className="dita-info-preview-note-label">{noteType}: </span> : null}
            {kids}
          </div>
        );
      }
      case 'p':
        return <p key={i}>{kids}</p>;
      case 'ul':
        return <ul key={i}>{kids}</ul>;
      case 'ol':
        return <ol key={i}>{kids}</ol>;
      case 'li':
        return <li key={i}>{kids}</li>;
      case 'b':
      case 'uicontrol':
      case 'wintitle':
        return <strong key={i}>{kids}</strong>;
      case 'i':
        return <em key={i}>{kids}</em>;
      case 'codeph':
        return <code key={i}>{kids}</code>;
      default:
        return <span key={i}>{kids}</span>;
    }
  });
}

function InfoPreviewComponent({ content }: { content: InfoModelNode[] }) {
  return (
    <div className="dita-editor-info-preview" contentEditable={false}>
      {renderModel(content)}
    </div>
  );
}

export class DitaInfoPreviewNode extends DecoratorNode<React.ReactElement> {
  __content: InfoModelNode[];

  constructor(content: InfoModelNode[], key?: NodeKey) {
    super(key);
    this.__content = content;
  }

  static getType(): string {
    return 'dita-info-preview';
  }

  static clone(node: DitaInfoPreviewNode): DitaInfoPreviewNode {
    return new DitaInfoPreviewNode(node.__content, node.__key);
  }

  createDOM(_config: EditorConfig): HTMLElement {
    return document.createElement('div');
  }

  updateDOM(): boolean {
    return false;
  }

  decorate(_editor: LexicalEditor, _config: EditorConfig): React.ReactElement {
    return <InfoPreviewComponent content={this.__content} />;
  }

  // Block-level: occupies its own line inside the list item, not inline with <cmd>.
  isInline(): boolean {
    return false;
  }

  // Serializes to nothing — never emit text into <cmd>.
  getTextContent(): string {
    return '';
  }

  // Read-only preview: don't trap the caret.
  isKeyboardSelectable(): boolean {
    return false;
  }

  static importJSON(serializedNode: SerializedDitaInfoPreviewNode): DitaInfoPreviewNode {
    return new DitaInfoPreviewNode(serializedNode.content ?? []);
  }

  exportJSON(): SerializedDitaInfoPreviewNode {
    return {
      ...super.exportJSON(),
      type: 'dita-info-preview',
      version: 1,
      content: this.__content,
    };
  }
}

export function $createDitaInfoPreviewNode(content: InfoModelNode[]): DitaInfoPreviewNode {
  return new DitaInfoPreviewNode(content);
}

export function $isDitaInfoPreviewNode(node: unknown): node is DitaInfoPreviewNode {
  return node instanceof DitaInfoPreviewNode;
}
