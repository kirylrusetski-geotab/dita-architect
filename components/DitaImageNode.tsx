import React from 'react';
import { DecoratorNode } from 'lexical';
import type { LexicalEditor, EditorConfig, NodeKey, SerializedLexicalNode } from 'lexical';

interface SerializedDitaImageNode extends SerializedLexicalNode {
  href: string;
  alt: string;
  title: string;
  isFig: boolean;
}

function ImageComponent({
  href,
  alt,
  title,
  isFig,
  resolvedUrl,
}: {
  href: string;
  alt: string;
  title: string;
  isFig: boolean;
  resolvedUrl: string | null;
}) {
  const isUrl = /^https?:\/\//.test(href);
  const displayUrl = resolvedUrl ?? (isUrl ? href : null);

  // Log warning when resolution failed (empty string indicates failed resolution)
  if (resolvedUrl === '') {
    console.warn('[DitaImageNode] Image resolution failed:', {
      href,
      alt,
      resolvedUrl,
      isUrl,
    });
  }

  // Determine resolution state for debugging
  const getResolutionState = (): string => {
    if (isUrl) return 'absolute-url';
    if (resolvedUrl === null) return 'unresolved';
    if (resolvedUrl === '') return 'failed';
    return 'resolved';
  };

  return (
    <div
      contentEditable={false}
      data-href={href}
      data-resolved-url={resolvedUrl || 'null'}
      data-resolution-state={getResolutionState()}
      style={{
        margin: '8px 0',
        borderRadius: '6px',
        border: '1px solid var(--app-border-subtle, #333)',
        overflow: 'hidden',
        backgroundColor: 'var(--app-surface-raised, #1e1e1e)',
      }}
    >
      {title && (
        <div
          style={{
            padding: '6px 10px',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--app-text-secondary, #aaa)',
            borderBottom: '1px solid var(--app-border-subtle, #333)',
          }}
        >
          {title}
        </div>
      )}
      {displayUrl ? (
        <img
          src={displayUrl}
          alt={alt}
          style={{
            display: 'block',
            maxWidth: '100%',
            height: 'auto',
          }}
        />
      ) : !isUrl && resolvedUrl === null ? (
        <div className="image-shimmer" />
      ) : (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '16px',
            color: 'var(--app-text-muted, #888)',
          }}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            style={{ width: 28, height: 28, opacity: 0.5, flexShrink: 0 }}
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <path d="m21 15-5-5L5 21" />
          </svg>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: '11px',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                wordBreak: 'break-all',
              }}
            >
              {href || 'No image source'}
            </div>
            {alt && (
              <div style={{ fontSize: '11px', opacity: 0.6, marginTop: '2px' }}>
                {alt}
              </div>
            )}
            <div
              style={{
                fontSize: '10px',
                opacity: 0.4,
                marginTop: '4px',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}
            >
              {isFig ? 'fig · image' : 'image'}
            </div>
          </div>
        </div>
      )}
      {displayUrl && alt && (
        <div
          style={{
            padding: '4px 10px',
            fontSize: '11px',
            color: 'var(--app-text-muted, #888)',
            borderTop: '1px solid var(--app-border-subtle, #333)',
          }}
        >
          {alt}
        </div>
      )}
    </div>
  );
}

export class DitaImageNode extends DecoratorNode<React.ReactElement> {
  __href: string;
  __alt: string;
  __title: string;
  __isFig: boolean;
  __resolvedUrl: string | null = null;

  constructor(href: string, alt: string, title: string, isFig: boolean, key?: NodeKey) {
    super(key);
    this.__href = href;
    this.__alt = alt;
    this.__title = title;
    this.__isFig = isFig;
    this.__resolvedUrl = null;
  }

  static getType(): string {
    return 'ditaimage';
  }

  setResolvedUrl(url: string | null): void {
    const writableSelf = this.getWritable();
    writableSelf.__resolvedUrl = url;
  }

  getResolvedUrl(): string | null {
    return this.__resolvedUrl;
  }

  static clone(node: DitaImageNode): DitaImageNode {
    const cloned = new DitaImageNode(node.__href, node.__alt, node.__title, node.__isFig, node.__key);
    cloned.__resolvedUrl = node.__resolvedUrl;
    return cloned;
  }

  createDOM(_config: EditorConfig): HTMLElement {
    const div = document.createElement('div');
    return div;
  }

  updateDOM(): boolean {
    return false;
  }

  decorate(_editor: LexicalEditor, _config: EditorConfig): React.ReactElement {
    return (
      <ImageComponent
        href={this.__href}
        alt={this.__alt}
        title={this.__title}
        isFig={this.__isFig}
        resolvedUrl={this.__resolvedUrl}
      />
    );
  }

  isInline(): boolean {
    return false;
  }

  isKeyboardSelectable(): boolean {
    return true;
  }

  static importJSON(serializedNode: SerializedDitaImageNode): DitaImageNode {
    return new DitaImageNode(
      serializedNode.href,
      serializedNode.alt,
      serializedNode.title,
      serializedNode.isFig,
    );
  }

  exportJSON(): SerializedDitaImageNode {
    return {
      ...super.exportJSON(),
      type: 'ditaimage',
      version: 1,
      href: this.__href,
      alt: this.__alt,
      title: this.__title,
      isFig: this.__isFig,
    };
  }
}

export function $createDitaImageNode(
  href: string,
  alt: string,
  title: string,
  isFig: boolean,
): DitaImageNode {
  return new DitaImageNode(href, alt, title, isFig);
}

export function $isDitaImageNode(node: unknown): node is DitaImageNode {
  return node instanceof DitaImageNode;
}
