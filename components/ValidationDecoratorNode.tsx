import React from 'react';
import { DecoratorNode } from 'lexical';
import type { LexicalEditor, EditorConfig, NodeKey, SerializedLexicalNode } from 'lexical';

/**
 * ValidationDecoratorNode — standalone inline decorator for marking broken xrefs.
 *
 * This node is NOT inserted during XML parse. LinkNodes are placed directly in
 * the Lexical tree (see parseXmlToLexical.ts) and the serializer round-trips them
 * correctly. Validation state is tracked in a separate side-channel ref map inside
 * InlineValidationPlugin, keyed by LinkNode key, with no tree mutations.
 *
 * This node is retained in the editor node registry for backward compatibility
 * with any persisted editor JSON that may already reference it.
 */

interface SerializedValidationDecoratorNode extends SerializedLexicalNode {
  href: string;
  errorType: 'broken-xref' | 'unresolved-keyref' | null;
  errorMessage: string;
}

function ValidationBadge({
  errorType,
  errorMessage,
  href,
}: {
  errorType: 'broken-xref' | 'unresolved-keyref' | null;
  errorMessage: string;
  href: string;
}) {
  if (!errorType) {
    return <span>{href}</span>;
  }

  const className = errorType === 'broken-xref'
    ? 'dita-validation-broken-xref'
    : 'dita-validation-unresolved-keyref';

  return (
    <span
      className={className}
      title={errorMessage}
      style={{ cursor: 'help' }}
    >
      {href}
    </span>
  );
}

export class ValidationDecoratorNode extends DecoratorNode<React.ReactElement> {
  __href: string;
  __errorType: 'broken-xref' | 'unresolved-keyref' | null;
  __errorMessage: string;

  constructor(
    href: string = '',
    errorType: 'broken-xref' | 'unresolved-keyref' | null = null,
    errorMessage: string = '',
    key?: NodeKey
  ) {
    super(key);
    this.__href = href;
    this.__errorType = errorType;
    this.__errorMessage = errorMessage;
  }

  static getType(): string {
    return 'validation-decorator';
  }

  static clone(node: ValidationDecoratorNode): ValidationDecoratorNode {
    return new ValidationDecoratorNode(
      node.__href,
      node.__errorType,
      node.__errorMessage,
      node.__key
    );
  }

  createDOM(_config: EditorConfig): HTMLElement {
    return document.createElement('span');
  }

  updateDOM(): boolean {
    return false;
  }

  decorate(_editor: LexicalEditor, _config: EditorConfig): React.ReactElement {
    return (
      <ValidationBadge
        errorType={this.__errorType}
        errorMessage={this.__errorMessage}
        href={this.__href}
      />
    );
  }

  getTextContent(): string {
    return this.__href;
  }

  getHref(): string {
    return this.__href;
  }

  getErrorType(): 'broken-xref' | 'unresolved-keyref' | null {
    return this.__errorType;
  }

  getErrorMessage(): string {
    return this.__errorMessage;
  }

  isInline(): boolean {
    return true;
  }

  isKeyboardSelectable(): boolean {
    return true;
  }

  static importJSON(serializedNode: SerializedValidationDecoratorNode): ValidationDecoratorNode {
    return new ValidationDecoratorNode(
      serializedNode.href,
      serializedNode.errorType,
      serializedNode.errorMessage,
    );
  }

  exportJSON(): SerializedValidationDecoratorNode {
    // No `...super.exportJSON()` — see DitaCodeBlockNode's comment (BUG-47).
    return {
      type: 'validation-decorator',
      version: 1,
      href: this.__href,
      errorType: this.__errorType,
      errorMessage: this.__errorMessage,
    };
  }
}

export function $createValidationDecoratorNode(
  href: string,
  errorType: 'broken-xref' | 'unresolved-keyref' | null = null,
  errorMessage: string = ''
): ValidationDecoratorNode {
  return new ValidationDecoratorNode(href, errorType, errorMessage);
}

export function $isValidationDecoratorNode(node: unknown): node is ValidationDecoratorNode {
  return node instanceof ValidationDecoratorNode;
}
