import { useEffect, useRef, useCallback } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $isElementNode } from 'lexical';
import type { LexicalNode } from 'lexical';
import { $isLinkNode } from '@lexical/link';
import { extractXmlIds } from '../lib/xml-utils';

interface InlineValidationPluginProps {
  xmlContent: string;
  validationTrigger: number;
  onValidationResults?: (errors: Map<string, { type: 'broken-xref' | 'unresolved-keyref', message: string }>) => void;
}

const BROKEN_XREF_CLASS = 'dita-validation-broken-xref';
const UNRESOLVED_KEYREF_CLASS = 'dita-validation-unresolved-keyref';
const VALIDATION_ATTR = 'data-validation-error';
const LINK_EDIT_TOOLTIP = 'Links open in published output — not in the editor';

export const InlineValidationPlugin = ({
  xmlContent,
  validationTrigger,
  onValidationResults,
}: InlineValidationPluginProps) => {
  const [editor] = useLexicalComposerContext();
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const xmlIdsRef = useRef<Set<string>>(new Set());
  const onValidationResultsRef = useRef(onValidationResults);
  onValidationResultsRef.current = onValidationResults;

  // Update XML IDs cache when XML content changes
  useEffect(() => {
    if (xmlContent) {
      try {
        xmlIdsRef.current = extractXmlIds(xmlContent);
      } catch (error) {
        console.warn('Failed to extract XML IDs for validation:', error);
        xmlIdsRef.current = new Set();
      }
    }
  }, [xmlContent]);

  /**
   * Apply or remove validation CSS classes and title attributes on DOM elements
   * corresponding to the given error map. Uses editor.getElementByKey() to find
   * the DOM node for each Lexical LinkNode — same pattern as TrackedChangesPlugin.
   */
  const applyValidationStyles = useCallback((
    errors: Map<string, { type: 'broken-xref' | 'unresolved-keyref', message: string }>,
    previousErrorKeys: Set<string>,
    allLinkKeys: Set<string>,
  ) => {
    // Clear validation classes from nodes that are no longer errors
    for (const key of previousErrorKeys) {
      if (!errors.has(key)) {
        const dom = editor.getElementByKey(key);
        if (dom) {
          dom.classList.remove(BROKEN_XREF_CLASS, UNRESOLVED_KEYREF_CLASS);
          dom.removeAttribute(VALIDATION_ATTR);
          // title will be restored by the edit-mode tooltip pass below
        }
      }
    }

    // Apply validation styles to current errors
    for (const [key, error] of errors) {
      const dom = editor.getElementByKey(key);
      if (!dom) continue;

      const className = error.type === 'broken-xref' ? BROKEN_XREF_CLASS : UNRESOLVED_KEYREF_CLASS;
      const oppositeClass = error.type === 'broken-xref' ? UNRESOLVED_KEYREF_CLASS : BROKEN_XREF_CLASS;

      dom.classList.remove(oppositeClass);
      dom.classList.add(className);
      dom.title = error.message;
      dom.setAttribute(VALIDATION_ATTR, error.type);
    }

    // Stamp edit-mode tooltip on all valid (non-broken) links
    for (const key of allLinkKeys) {
      if (!errors.has(key)) {
        const dom = editor.getElementByKey(key);
        if (dom) dom.title = LINK_EDIT_TOOLTIP;
      }
    }
  }, [editor]);

  // Track previous error keys so we can clean up stale styles
  const previousErrorKeysRef = useRef<Set<string>>(new Set());

  // Validation function — scans for errors, reports to parent, and applies DOM styles
  const validateAndStyle = useCallback(() => {
    editor.getEditorState().read(() => {
      const root = $getRoot();
      const errors = new Map<string, { type: 'broken-xref' | 'unresolved-keyref', message: string }>();
      const allLinkKeys = new Set<string>();

      const scanNode = (node: LexicalNode) => {
        if ($isLinkNode(node)) {
          allLinkKeys.add(node.getKey());
          const href = node.getURL();
          if (href.startsWith('#')) {
            const targetId = href.substring(1);
            if (!xmlIdsRef.current.has(targetId)) {
              errors.set(node.getKey(), {
                type: 'broken-xref',
                message: `Target '${targetId}' not found`,
              });
            }
          }
        }

        if ($isElementNode(node)) {
          node.getChildren().forEach(scanNode);
        }
      };

      scanNode(root);

      // Report to parent for tab state
      onValidationResultsRef.current?.(errors);

      // Apply DOM styles — must happen after read() so DOM is in sync
      // Use queueMicrotask to ensure Lexical has committed the latest render
      queueMicrotask(() => {
        applyValidationStyles(errors, previousErrorKeysRef.current, allLinkKeys);
        previousErrorKeysRef.current = new Set(errors.keys());
      });
    });
  }, [editor, applyValidationStyles]);

  // Debounced validation on content changes
  useEffect(() => {
    const removeListener = editor.registerUpdateListener(() => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      debounceTimeoutRef.current = setTimeout(() => {
        validateAndStyle();
      }, 300);
    });

    return () => {
      removeListener();
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [editor, validateAndStyle]);

  // Validation trigger from external sources (e.g., after sync)
  useEffect(() => {
    if (validationTrigger === 0) return;

    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    validateAndStyle();
  }, [validationTrigger, validateAndStyle]);

  // Cleanup: remove all validation styles when plugin unmounts
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
      // Strip validation classes from any DOM elements that still have them
      for (const key of previousErrorKeysRef.current) {
        const dom = editor.getElementByKey(key);
        if (dom) {
          dom.classList.remove(BROKEN_XREF_CLASS, UNRESOLVED_KEYREF_CLASS);
          dom.removeAttribute('title');
          dom.removeAttribute(VALIDATION_ATTR);
        }
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
};
