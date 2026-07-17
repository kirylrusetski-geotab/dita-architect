// FR-046 — SuggestionPlugin: suggesting-mode edit interception + mode lifecycle.
//
// Replaces EditModePlugin (snapshot lifecycle) and TrackedChangesPlugin
// (diff-and-paint). There is no snapshot and no diffing: while
// documentMode === 'suggesting', every edit gesture is intercepted and
// recorded as marks (lib/tracked-changes/edits.ts). Accept All / Reject All
// are atomic mutations followed by the same serialize-and-commit path the
// old accept used.
//
// Two interception layers (verified against lexical@0.16.0 source):
// 1. Commands at COMMAND_PRIORITY_CRITICAL — shadow RichTextPlugin (prio 0).
// 2. A capture-phase `beforeinput` listener — ordinary mid-node typing takes
//    a fast path that NEVER dispatches CONTROLLED_TEXT_INSERTION_COMMAND
//    ($shouldPreventDefaultAndInsertText returns false), mutating the DOM
//    directly. The capture listener converts those into command dispatches,
//    except when the caret is inside an own insert mark — there the fast
//    path correctly extends the suggestion and is left alone.
import { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { mergeRegister } from '@lexical/utils';
import {
  $getSelection,
  $isRangeSelection,
  CLEAR_HISTORY_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
  CONTROLLED_TEXT_INSERTION_COMMAND,
  CUT_COMMAND,
  DELETE_CHARACTER_COMMAND,
  DELETE_LINE_COMMAND,
  DELETE_WORD_COMMAND,
  DRAGSTART_COMMAND,
  DROP_COMMAND,
  FORMAT_TEXT_COMMAND,
  INSERT_LINE_BREAK_COMMAND,
  INSERT_PARAGRAPH_COMMAND,
  PASTE_COMMAND,
  type RangeSelection,
} from 'lexical';
import { toast } from 'sonner';
import { serializeLexicalToXml, useSyncContext } from '../sync';
import { $isTrackedTextNode, TrackedTextNode } from './TrackedTextNode';
import {
  $insertTrackedText,
  $markCollapsedDeletion,
  $markRangeAsDeleted,
  $trackedParagraphSplit,
  type EditResult,
} from '../lib/tracked-changes/edits';
import { $scanTrackedChanges } from '../lib/tracked-changes/scan';
import {
  $acceptAllChanges,
  $rejectAllChanges,
  $rejectChange,
} from '../lib/tracked-changes/mutations';
import { newMark, SESSION_AUTHOR } from '../lib/tracked-changes/model';
import type { DocumentMode } from '../types/tab';

interface SuggestionPluginProps {
  tabId: string;
  documentMode: DocumentMode;
  masterXml: string;
  acceptAllTrigger: number;
  rejectAllTrigger: number;
  onAcceptAll: (tabId: string, xml: string) => void;
  onRejectAll: (tabId: string) => void;
  onChangeCountChanged: (tabId: string, count: number) => void;
}

// One toast per category per few seconds — holding a blocked key must not
// spam the toaster.
const lastToastAt = new Map<string, number>();
const toastThrottled = (category: string, message: string): void => {
  const now = Date.now();
  if (now - (lastToastAt.get(category) ?? 0) < 4000) return;
  lastToastAt.set(category, now);
  toast(message);
};

const handleEditResult = (result: EditResult): void => {
  switch (result.status) {
    case 'blocked-boundary':
      toastThrottled('boundary', "Merging paragraphs isn't tracked yet — switch to Editing mode");
      break;
    case 'blocked-decorator':
      toastThrottled('decorator', "Embedded elements can't be tracked — switch to Editing mode");
      break;
    case 'reject-split':
      $rejectChange(result.changeId);
      break;
    default:
      break;
  }
};

export const SuggestionPlugin = ({
  tabId,
  documentMode,
  masterXml,
  acceptAllTrigger,
  rejectAllTrigger,
  onAcceptAll,
  onRejectAll,
  onChangeCountChanged,
}: SuggestionPluginProps) => {
  const [editor] = useLexicalComposerContext();
  const { nodeOriginMap, xmlMetaCache } = useSyncContext();
  const lastCountRef = useRef(0);

  // Viewing mode locks the visual editor only (the XML pane stays live).
  useEffect(() => {
    editor.setEditable(documentMode !== 'viewing');
  }, [editor, documentMode]);

  // Integrity net: delete/split marks must stay token-mode whatever path
  // created or restored them (undo reconstruction, JSON import).
  useEffect(() => {
    return editor.registerNodeTransform(TrackedTextNode, node => {
      if (node.getMark().kind !== 'insert' && node.getMode() !== 'token') {
        node.setMode('token');
      }
    });
  }, [editor]);

  // Change-count reporting: read-only scan on each committed update while
  // suggesting — NO editor.update inside the listener (the old plugin's
  // re-entrancy hazard is gone by construction).
  useEffect(() => {
    if (documentMode !== 'suggesting') {
      if (lastCountRef.current !== 0) {
        lastCountRef.current = 0;
        onChangeCountChanged(tabId, 0);
      }
      return;
    }
    const report = () => {
      const count = editor.getEditorState().read(() => $scanTrackedChanges().length);
      if (count !== lastCountRef.current) {
        lastCountRef.current = count;
        onChangeCountChanged(tabId, count);
      }
    };
    report();
    return editor.registerUpdateListener(report);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, documentMode, tabId]);

  // Command interception — active only while suggesting.
  useEffect(() => {
    if (documentMode !== 'suggesting') return;

    const getRangeSelection = (): RangeSelection | null => {
      const sel = $getSelection();
      return $isRangeSelection(sel) ? sel : null;
    };

    const unregister = mergeRegister(
      editor.registerCommand<InputEvent | string>(
        CONTROLLED_TEXT_INSERTION_COMMAND,
        payload => {
          const text = typeof payload === 'string' ? payload : payload.data;
          if (text == null || text.length === 0) return true;
          const sel = getRangeSelection();
          if (!sel) return true;
          if (sel.isCollapsed()) {
            handleEditResult($insertTrackedText(sel, text));
          } else {
            // Replace-typing: strike the range, then insert after the marks.
            const { lastMarkNode } = $markRangeAsDeleted(sel);
            const after = getRangeSelection();
            if (after) handleEditResult($insertTrackedText(after, text));
            void lastMarkNode;
          }
          return true;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand<boolean>(
        DELETE_CHARACTER_COMMAND,
        isBackward => {
          const sel = getRangeSelection();
          if (!sel) return true;
          if (sel.isCollapsed()) {
            handleEditResult($markCollapsedDeletion(sel, isBackward));
          } else {
            const { sawDecorator } = $markRangeAsDeleted(sel);
            if (sawDecorator) {
              toastThrottled('decorator', 'Embedded elements were left in place — they can\'t be tracked');
            }
          }
          return true;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand<boolean>(
        DELETE_WORD_COMMAND,
        isBackward => {
          const sel = getRangeSelection();
          if (!sel) return true;
          if (sel.isCollapsed()) sel.modify('extend', isBackward, 'word');
          const extended = getRangeSelection();
          if (extended && !extended.isCollapsed()) $markRangeAsDeleted(extended);
          return true;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand<boolean>(
        DELETE_LINE_COMMAND,
        isBackward => {
          const sel = getRangeSelection();
          if (!sel) return true;
          if (sel.isCollapsed()) sel.modify('extend', isBackward, 'lineboundary');
          const extended = getRangeSelection();
          if (extended && !extended.isCollapsed()) $markRangeAsDeleted(extended);
          return true;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand<ClipboardEvent>(
        PASTE_COMMAND,
        event => {
          event.preventDefault();
          const raw = event.clipboardData?.getData('text/plain') ?? '';
          // v1 keeps paste inline: newlines collapse to spaces.
          const text = raw.replace(/\r?\n+/g, ' ').trim();
          if (!text) return true;
          const sel = getRangeSelection();
          if (!sel) return true;
          const mark = newMark('insert'); // one changeId for the whole paste
          if (!sel.isCollapsed()) {
            $markRangeAsDeleted(sel);
            const after = getRangeSelection();
            if (after) handleEditResult($insertTrackedText(after, text, mark));
          } else {
            handleEditResult($insertTrackedText(sel, text, mark));
          }
          return true;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand<ClipboardEvent>(
        CUT_COMMAND,
        event => {
          event.preventDefault();
          const sel = getRangeSelection();
          if (!sel || sel.isCollapsed()) return true;
          const text = sel.getTextContent();
          void navigator.clipboard?.writeText(text).catch(() => {});
          const { sawDecorator } = $markRangeAsDeleted(sel);
          if (sawDecorator) {
            toastThrottled('decorator', 'Embedded elements were left in place — they can\'t be tracked');
          }
          return true;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand<void>(
        INSERT_PARAGRAPH_COMMAND,
        () => {
          const sel = getRangeSelection();
          if (!sel) return true;
          if (!sel.isCollapsed()) {
            $markRangeAsDeleted(sel);
            const after = getRangeSelection();
            if (after) handleEditResult($trackedParagraphSplit(after));
            return true;
          }
          handleEditResult($trackedParagraphSplit(sel));
          return true;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        INSERT_LINE_BREAK_COMMAND,
        () => {
          toastThrottled('linebreak', "Line breaks aren't tracked — switch to Editing mode");
          return true;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        FORMAT_TEXT_COMMAND,
        () => {
          toastThrottled('format', "Formatting changes aren't tracked yet — switch to Editing mode");
          return true;
        },
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        DROP_COMMAND,
        () => true,
        COMMAND_PRIORITY_CRITICAL,
      ),
      editor.registerCommand(
        DRAGSTART_COMMAND,
        () => true,
        COMMAND_PRIORITY_CRITICAL,
      ),
    );
    return unregister;
  }, [editor, documentMode]);

  // Capture-phase beforeinput: close the typing fast path (see file header).
  useEffect(() => {
    if (documentMode !== 'suggesting') return;
    const root = editor.getRootElement();
    if (!root) return;
    const container = root.parentElement ?? root;

    const onBeforeInput = (e: InputEvent) => {
      if (e.inputType !== 'insertText' && e.inputType !== 'insertReplacementText') return;
      const data = e.data;
      if (data == null) return;

      let allowFastPath = false;
      editor.getEditorState().read(() => {
        const sel = $getSelection();
        if ($isRangeSelection(sel) && sel.isCollapsed() && sel.anchor.type === 'text') {
          const node = sel.anchor.getNode();
          if (
            $isTrackedTextNode(node) &&
            node.getMark().kind === 'insert' &&
            node.getMark().author === SESSION_AUTHOR
          ) {
            // Typing inside your own insert run — the fast path extends the
            // suggestion correctly and cheaply. Leave it alone.
            allowFastPath = true;
          }
        }
      });
      if (allowFastPath) return;

      e.preventDefault();
      e.stopPropagation();
      editor.dispatchCommand(CONTROLLED_TEXT_INSERTION_COMMAND, data);
    };

    const onCompositionStart = () => {
      toastThrottled('ime', "IME composition isn't tracked yet — switch to Editing mode");
    };

    container.addEventListener('beforeinput', onBeforeInput, true);
    root.addEventListener('compositionstart', onCompositionStart);
    return () => {
      container.removeEventListener('beforeinput', onBeforeInput, true);
      root.removeEventListener('compositionstart', onCompositionStart);
    };
  }, [editor, documentMode]);

  // Accept All: resolve every mark, then serialize-and-commit — the same
  // path the old EditModePlugin accept used, valid because after accept-all
  // the tree contains only plain TextNodes.
  useEffect(() => {
    if (acceptAllTrigger === 0) return;
    editor.update(
      () => {
        $acceptAllChanges();
      },
      { discrete: true },
    );
    const xml = serializeLexicalToXml(editor.getEditorState(), masterXml, nodeOriginMap, xmlMetaCache);
    editor.dispatchCommand(CLEAR_HISTORY_COMMAND, undefined);
    onAcceptAll(tabId, xml);
    toast.success('All tracked changes accepted');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [acceptAllTrigger]);

  // Reject All: resolve every mark back to the original text.
  useEffect(() => {
    if (rejectAllTrigger === 0) return;
    editor.update(
      () => {
        $rejectAllChanges();
      },
      { discrete: true },
    );
    editor.dispatchCommand(CLEAR_HISTORY_COMMAND, undefined);
    onRejectAll(tabId);
    toast('All tracked changes rejected');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rejectAllTrigger]);

  return null;
};
