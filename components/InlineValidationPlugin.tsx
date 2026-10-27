import { useEffect, useRef, useCallback, useContext, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $isElementNode } from 'lexical';
import type { LexicalNode } from 'lexical';
import { $isLinkNode } from '@lexical/link';
import { extractXmlIds } from '../lib/xml-utils';
import { SyncContext } from '../sync/SyncContext';
import { isCrossFileHref, checkCrossFileHref, type CrossFileResult } from '../lib/cross-file-xref';
import { fetchResourceFolder } from '../lib/heretto-path';

interface InlineValidationPluginProps {
  xmlContent: string;
  validationTrigger: number;
  onValidationResults?: (errors: Map<string, { type: 'broken-xref' | 'unresolved-keyref', message: string }>) => void;
  /** The open topic's Heretto folder (ADR-013 decision 8): cross-file xrefs are
   *  checked only when it is known — a local-file tab has none. */
  herettoFolderUuid?: string | null;
  /** The open topic's Heretto UUID, used to find its folder when a tab knows
   *  only the file (an API load, a Replace). */
  herettoFileUuid?: string | null;
}

// A failed check (Heretto unreachable) is retried after this long, not on every
// validation pass.
const UNKNOWN_RETRY_MS = 30_000;

const BROKEN_XREF_CLASS = 'dita-validation-broken-xref';
const UNRESOLVED_KEYREF_CLASS = 'dita-validation-unresolved-keyref';
const VALIDATION_ATTR = 'data-validation-error';
const LINK_EDIT_TOOLTIP = 'Links open in published output — not in the editor';

export const InlineValidationPlugin = ({
  xmlContent,
  validationTrigger,
  onValidationResults,
  herettoFolderUuid = null,
  herettoFileUuid = null,
}: InlineValidationPluginProps) => {
  const [editor] = useLexicalComposerContext();
  // The folder relative hrefs resolve from: the tab's, or else the file's own.
  const [lookedUpFolder, setLookedUpFolder] = useState<string | null>(null);
  useEffect(() => {
    setLookedUpFolder(null);
    if (herettoFolderUuid || !herettoFileUuid) return;
    let live = true;
    void fetchResourceFolder(herettoFileUuid).then(folder => { if (live) setLookedUpFolder(folder); });
    return () => { live = false; };
  }, [herettoFolderUuid, herettoFileUuid]);
  const folderUuid = herettoFolderUuid ?? lookedUpFolder;
  // Optional: mounted inside SyncManager the plugin can read an xref's
  // scope/format/keyref (originMap.inlineAttrs); outside it, it cannot.
  const sync = useContext(SyncContext);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const xmlIdsRef = useRef<Set<string>>(new Set());
  const onValidationResultsRef = useRef(onValidationResults);
  onValidationResultsRef.current = onValidationResults;
  // Cross-file results by `folder|href`; checks in flight; and a handle on the
  // latest validate function for results that arrive later.
  const crossFileRef = useRef(new Map<string, { result: CrossFileResult; at: number }>());
  const crossFilePendingRef = useRef(new Set<string>());
  const validateRef = useRef<() => void>(() => {});
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

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
          } else if (folderUuid && isCrossFileHref(href, sync?.nodeOriginMap.get(node.getKey())?.inlineAttrs)) {
            // ADR-013 decision 8: an xref to another Heretto file. The check is
            // async; a result re-runs this validation when it lands.
            const key = `${folderUuid}|${href}`;
            const known = crossFileRef.current.get(key);
            const stale = known?.result.status === 'unknown' && Date.now() - known.at > UNKNOWN_RETRY_MS;
            if (known?.result.status === 'broken') {
              errors.set(node.getKey(), { type: 'broken-xref', message: known.result.message });
            } else if ((!known || stale) && !crossFilePendingRef.current.has(key)) {
              crossFilePendingRef.current.add(key);
              void checkCrossFileHref(href, folderUuid).then(result => {
                crossFilePendingRef.current.delete(key);
                crossFileRef.current.set(key, { result, at: Date.now() });
                if (mountedRef.current && result.status !== 'unknown') validateRef.current();
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
  }, [editor, applyValidationStyles, folderUuid, sync]);
  validateRef.current = validateAndStyle;

  // A folder that becomes known later (looked up from the file) is checked at once.
  useEffect(() => {
    if (folderUuid) validateAndStyle();
  }, [folderUuid, validateAndStyle]);

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
