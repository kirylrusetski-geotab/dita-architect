import React, { useState, useCallback, useRef, useEffect } from 'react';
import { DecoratorNode, $getNodeByKey } from 'lexical';
import type { LexicalEditor, EditorConfig, NodeKey, SerializedLexicalNode } from 'lexical';

interface SerializedDitaCodeBlockNode extends SerializedLexicalNode {
  code: string;
  language: string;
}

function CodeBlockComponent({
  nodeKey,
  code,
  language,
  editor,
}: {
  nodeKey: string;
  code: string;
  language: string;
  editor: LexicalEditor;
}) {
  const [value, setValue] = useState(code);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setValue(code);
  }, [code]);

  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    }
  }, [value]);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value;
      setValue(newValue);
      editor.update(() => {
        const node = $getNodeByKey(nodeKey);
        if ($isDitaCodeBlockNode(node)) {
          node.setCode(newValue);
        }
      });
    },
    [editor, nodeKey],
  );

  return (
    <div
      contentEditable={false}
      style={{
        margin: '8px 0',
        borderRadius: '6px',
        backgroundColor: 'var(--app-bg, #1a1a2e)',
        border: '1px solid var(--app-border-subtle, #333)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '4px 10px',
          fontSize: '10px',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          color: 'var(--app-text-muted, #666)',
          borderBottom: '1px solid var(--app-border-subtle, #333)',
          backgroundColor: 'var(--app-surface-raised, #1e1e1e)',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}
      >
        codeblock{language ? ` · ${language}` : ''}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={(e) => e.stopPropagation()}
        spellCheck={false}
        style={{
          display: 'block',
          width: '100%',
          padding: '10px 12px',
          fontSize: '12px',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          color: 'var(--app-text-primary, #e0e0e0)',
          backgroundColor: 'transparent',
          border: 'none',
          outline: 'none',
          resize: 'none',
          overflow: 'hidden',
          lineHeight: 1.5,
          tabSize: 2,
          whiteSpace: 'pre',
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

export class DitaCodeBlockNode extends DecoratorNode<React.ReactElement> {
  __code: string;
  __language: string;

  constructor(code: string, language: string, key?: NodeKey) {
    super(key);
    this.__code = code;
    this.__language = language;
  }

  static getType(): string {
    return 'ditacodeblock';
  }

  static clone(node: DitaCodeBlockNode): DitaCodeBlockNode {
    return new DitaCodeBlockNode(node.__code, node.__language, node.__key);
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const div = document.createElement('div');
    return div;
  }

  updateDOM(): boolean {
    return false;
  }

  decorate(editor: LexicalEditor, _config: EditorConfig): React.ReactElement {
    return (
      <CodeBlockComponent
        nodeKey={this.__key}
        code={this.__code}
        language={this.__language}
        editor={editor}
      />
    );
  }

  getCode(): string {
    return this.__code;
  }

  setCode(code: string): void {
    const writable = this.getWritable();
    writable.__code = code;
  }

  getLanguage(): string {
    return this.__language;
  }

  isInline(): boolean {
    return false;
  }

  isKeyboardSelectable(): boolean {
    return true;
  }

  static importJSON(serializedNode: SerializedDitaCodeBlockNode): DitaCodeBlockNode {
    return new DitaCodeBlockNode(serializedNode.code, serializedNode.language);
  }

  exportJSON(): SerializedDitaCodeBlockNode {
    // No `...super.exportJSON()`: Lexical 0.16's DecoratorNode defines no
    // exportJSON, so the spread reaches LexicalNode's base, which throws
    // "base method not extended" (BUG-47). `type`/`version` are the whole
    // base shape, as DitaPhRefNode's BUG-46 fix established.
    return {
      type: 'ditacodeblock',
      version: 1,
      code: this.__code,
      language: this.__language,
    };
  }
}

export function $createDitaCodeBlockNode(code: string, language: string): DitaCodeBlockNode {
  return new DitaCodeBlockNode(code, language);
}

export function $isDitaCodeBlockNode(node: unknown): node is DitaCodeBlockNode {
  return node instanceof DitaCodeBlockNode;
}
