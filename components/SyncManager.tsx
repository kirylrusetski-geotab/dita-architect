import React, { useRef, useEffect, useCallback, useMemo, useState } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { parseXmlToLexical, serializeLexicalToXml, createNodeOriginMap, createXmlMetaCache, SyncContext } from '../sync';

interface SyncManagerProps {
  xmlContent: string;
  onLexicalChange: (serializedXml: string) => void;
  lastUpdatedBy: 'editor' | 'code' | 'api';
  syncTrigger?: number;
  suspendSync?: boolean;
  children?: React.ReactNode;
  onValidationTrigger?: () => void;
}

export const SyncManager = ({ xmlContent, onLexicalChange, lastUpdatedBy, syncTrigger = 0, suspendSync = false, children, onValidationTrigger }: SyncManagerProps) => {
  const isSyncingFromXmlRef = useRef(false);
  const syncGenRef = useRef(0); // generation counter to avoid clearing stale syncs
  const [editor] = useLexicalComposerContext();
  const lastXmlRef = useRef(xmlContent);
  const pendingXmlRef = useRef<string | null>(null);
  const [outOfSync, setOutOfSync] = useState(false);
  // masterXmlRef always points to the original code-side XML (from Heretto/file/template).
  // The serializer patches against this ref so every visual edit patches a fresh clone
  // of the true source document, avoiding "patch of a patch" drift.
  const masterXmlRef = useRef(xmlContent);

  // Per-instance sync state — no longer module-level singletons.
  const nodeOriginMap = useMemo(() => createNodeOriginMap(), []);
  const xmlMetaCache = useMemo(() => createXmlMetaCache(), []);
  const syncContextValue = useMemo(() => ({ nodeOriginMap, xmlMetaCache }), [nodeOriginMap, xmlMetaCache]);

  // Clear the syncing flag after Lexical commits the update.
  // Uses registerUpdateListener instead of setTimeout to avoid race conditions.
  const clearSyncFlagAfterUpdate = useCallback(() => {
    const gen = ++syncGenRef.current;
    const remove = editor.registerUpdateListener(() => {
      remove();
      // Only clear if no newer sync has started
      if (syncGenRef.current === gen) {
        isSyncingFromXmlRef.current = false;
      }
    });
    // Safety: if no update fires within 200ms (e.g. parse failed silently), clear anyway
    setTimeout(() => {
      remove();
      if (syncGenRef.current === gen) {
        isSyncingFromXmlRef.current = false;
      }
    }, 200);
  }, [editor]);

  // Parse initial XML into Lexical on mount
  useEffect(() => {
    isSyncingFromXmlRef.current = true;
    parseXmlToLexical(xmlContent, editor, nodeOriginMap);
    clearSyncFlagAfterUpdate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run only on mount

  // Helper: apply pending XML to Lexical
  const applyPendingSync = useCallback(() => {
    const pending = pendingXmlRef.current;
    if (pending === null) return;

    isSyncingFromXmlRef.current = true;
    const success = parseXmlToLexical(pending, editor, nodeOriginMap);
    if (success) {
      lastXmlRef.current = pending;
      masterXmlRef.current = pending;
      onValidationTrigger?.();
    }
    pendingXmlRef.current = null;
    setOutOfSync(false);
    clearSyncFlagAfterUpdate();
  }, [editor, clearSyncFlagAfterUpdate, nodeOriginMap]);

  // When the Lexical editor gains focus, flush any buffered XML→Lexical sync
  useEffect(() => {
    const rootElement = editor.getRootElement();
    if (!rootElement) return;

    const handleFocus = () => {
      applyPendingSync();
    };

    rootElement.addEventListener('focus', handleFocus);
    return () => rootElement.removeEventListener('focus', handleFocus);
  }, [editor, applyPendingSync]);

  // Ctrl+Enter: force immediate sync in both directions
  useEffect(() => {
    if (syncTrigger === 0) return;
    if (suspendSync) return;

    const lexicalRoot = editor.getRootElement();
    const activeEl = document.activeElement;
    const lexicalHasFocus = lexicalRoot && activeEl && lexicalRoot.contains(activeEl);

    if (lexicalHasFocus) {
      // Lexical is focused → serialize Lexical to XML (patch against master)
      editor.getEditorState().read(() => {
        const generatedXml = serializeLexicalToXml(editor.getEditorState(), masterXmlRef.current, nodeOriginMap, xmlMetaCache);
        if (generatedXml !== lastXmlRef.current) {
          lastXmlRef.current = generatedXml;
          pendingXmlRef.current = null;
          onLexicalChange(generatedXml);
        }
      });
    } else {
      // Monaco (or other) is focused → apply XML to Lexical
      pendingXmlRef.current = xmlContent;
      applyPendingSync();
    }
  }, [syncTrigger]);

  // Sync XML → Lexical: buffer while suspended (suggesting mode); flush when suspension lifts
  useEffect(() => {
    if ((lastUpdatedBy === 'code' || lastUpdatedBy === 'api') && xmlContent !== lastXmlRef.current) {
      if (suspendSync) {
        if (lastUpdatedBy === 'api') {
          // FR-056: an API whole-doc replacement becomes the new base document.
          // Applied immediately regardless of focus — existing tracked-change marks
          // are discarded by the re-parse (marks are session-only; carrier = FR-051).
          // Overwrite any stale buffered Monaco edit before flushing so it cannot
          // clobber the fresh API load.
          pendingXmlRef.current = xmlContent;
          applyPendingSync();
          return;
        }
        // Buffer non-API changes while tracked-change marks are live in the tree.
        // The effect re-runs when suspendSync flips to false (dep array), which flushes it.
        pendingXmlRef.current = xmlContent;
        return;
      }

      const lexicalRoot = editor.getRootElement();
      const activeEl = document.activeElement;
      const lexicalHasFocus = lexicalRoot && activeEl && lexicalRoot.contains(activeEl);

      if (lexicalHasFocus) {
        // Lexical is focused — sync after a short debounce to avoid interrupting typing
        const timeoutId = setTimeout(() => {
          isSyncingFromXmlRef.current = true;
          const success = parseXmlToLexical(xmlContent, editor, nodeOriginMap);
          if (success) {
            lastXmlRef.current = xmlContent;
            masterXmlRef.current = xmlContent;
            pendingXmlRef.current = null; // discard any stale buffered content (Change 2)
            onValidationTrigger?.();
          }
          clearSyncFlagAfterUpdate();
          setOutOfSync(false);
        }, 800);
        return () => clearTimeout(timeoutId);
      } else {
        // Monaco or nothing has focus — buffer so user can review before applying
        pendingXmlRef.current = xmlContent;
        setOutOfSync(true);
      }
    } else if (!suspendSync && pendingXmlRef.current !== null) {
      // suspension just lifted and there's a buffered update — flush it now
      applyPendingSync();
      setOutOfSync(false);
    }
  }, [xmlContent, suspendSync, editor, lastUpdatedBy, clearSyncFlagAfterUpdate, nodeOriginMap, applyPendingSync]);

  const showOutOfSyncBanner = outOfSync && !suspendSync && lastUpdatedBy !== 'editor';

  // Sync Lexical → XML
  return (
    <SyncContext.Provider value={syncContextValue}>
      <OnChangePlugin
        ignoreSelectionChange={true}
        onChange={(editorState) => {
          if (suspendSync) return;
          if (isSyncingFromXmlRef.current) return;

          const generatedXml = serializeLexicalToXml(editorState, masterXmlRef.current, nodeOriginMap, xmlMetaCache);
          if (generatedXml !== lastXmlRef.current) {
            lastXmlRef.current = generatedXml;
            pendingXmlRef.current = null; // discard any buffered code-side XML
            onLexicalChange(generatedXml);
          }
        }}
      />
      {showOutOfSyncBanner && (
        <div className="dita-sync-banner">
          Visual editor is out of sync — press Ctrl+Enter to refresh
        </div>
      )}
      {children}
    </SyncContext.Provider>
  );
};
