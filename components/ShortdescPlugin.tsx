import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getRoot,
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  $isElementNode,
  KEY_ENTER_COMMAND,
  COMMAND_PRIORITY_HIGH,
  $createParagraphNode,
  ParagraphNode,
} from 'lexical';
import { $isHeadingNode, HeadingNode, QuoteNode } from '@lexical/rich-text';
import { useSyncContext } from '../sync';
import { DITA_PLACEHOLDER_TITLES, DITA_PLACEHOLDER_SHORTDESCS } from '../constants/dita';

const ALL_PLACEHOLDER_TITLES = new Set([
  ...Object.values(DITA_PLACEHOLDER_TITLES),
  'Task title',
  'Concept title',
  'Reference title',
]);
const ALL_PLACEHOLDER_SHORTDESCS = new Set([
  ...Object.values(DITA_PLACEHOLDER_SHORTDESCS),
  'Short description of the task.',
  'Short description of the concept.',
  'Short description of the reference.',
]);

const BODY_TAG_CLASSES: Record<string, string> = {
  shortdesc: 'dita-editor-shortdesc',
  prereq: 'dita-editor-prereq',
  context: 'dita-editor-context',
  result: 'dita-editor-result',
  postreq: 'dita-editor-postreq',
  dt: 'dita-editor-dt',
  dd: 'dita-editor-dd',
};
// ADR-009: troubleshooting containers mark every paragraph they contain. The
// innermost section-class container wins (a <p> inside <troubleSolution>/<cause>
// is a cause paragraph).
const TROUBLE_SECTION_CLASSES: Record<string, string> = {
  condition: 'dita-editor-condition',
  cause: 'dita-editor-cause',
  remedy: 'dita-editor-remedy',
};
const troubleSectionClass = (containerPath: string | undefined): string | null => {
  if (!containerPath) return null;
  const matches = containerPath.match(/(condition|cause|remedy)#\d+/g);
  if (!matches) return null;
  return TROUBLE_SECTION_CLASSES[matches[matches.length - 1].split('#')[0]] ?? null;
};
const ALL_BODY_CLASSES = [...Object.values(BODY_TAG_CLASSES), ...Object.values(TROUBLE_SECTION_CLASSES)];

const NOTE_TYPE_CLASSES: Record<string, string> = {
  WARNING: 'dita-editor-note-warning',
  CAUTION: 'dita-editor-note-caution',
  TIP: 'dita-editor-note-tip',
  DANGER: 'dita-editor-note-danger',
  NOTE: 'dita-editor-note-note',
};
const ALL_NOTE_TYPE_CLASSES = Object.values(NOTE_TYPE_CLASSES);

/**
 * Handles the DITA authoring flow: H1 (title) → shortdesc → paragraph.
 *
 * When Enter is pressed at the end of the H1 at index 0 and no shortdesc
 * exists yet, the new paragraph is tagged as 'shortdesc' and gets a
 * visual indicator via a CSS class applied through a mutation listener.
 */
export const ShortdescPlugin = () => {
  const [editor] = useLexicalComposerContext();
  const { nodeOriginMap } = useSyncContext();

  useEffect(() => {
    // ── Enter key handler ─────────────────────────────────────────────
    const removeEnterListener = editor.registerCommand(
      KEY_ENTER_COMMAND,
      (event) => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection) || !selection.isCollapsed()) return false;

        const anchorNode = selection.anchor.getNode();
        const topLevelNode = anchorNode.getTopLevelElement();
        if (!topLevelNode) return false;

        const root = $getRoot();
        const children = root.getChildren();
        const nodeIndex = children.indexOf(topLevelNode);

        // Case 1: Enter at end of H1 at index 0 → create shortdesc
        if (
          nodeIndex === 0 &&
          $isHeadingNode(topLevelNode) &&
          topLevelNode.getTag() === 'h1'
        ) {
          // Check if a live (non-deleted) shortdesc node still exists
          const hasShortdesc = Array.from(nodeOriginMap.entries()).some(
            ([key, o]) => o.tag === 'shortdesc' && $getNodeByKey(key) !== null
          );
          if (!hasShortdesc) {
            event?.preventDefault();

            const shortdescNode = $createParagraphNode();
            topLevelNode.insertAfter(shortdescNode);
            shortdescNode.select();

            nodeOriginMap.set(shortdescNode.getKey(), { tag: 'shortdesc', bodyIndex: -2 });

            return true;
          }
        }

        // Case 2: Enter in shortdesc paragraph → create regular paragraph
        if ($isElementNode(topLevelNode) && topLevelNode.getType() === 'paragraph') {
          const origin = nodeOriginMap.get(topLevelNode.getKey());
          if (origin?.tag === 'shortdesc') {
            event?.preventDefault();

            const pNode = $createParagraphNode();
            topLevelNode.insertAfter(pNode);
            pNode.select();

            return true;
          }
        }

        return false;
      },
      COMMAND_PRIORITY_HIGH,
    );

    // ── Mutation listener: apply/remove CSS class on shortdesc DOM node ──
    const removeMutationListener = editor.registerMutationListener(
      ParagraphNode,
      () => {
        editor.getEditorState().read(() => {
          const root = $getRoot();
          const children = root.getChildren();

          children.forEach((node) => {
            if (!$isElementNode(node) || node.getType() !== 'paragraph') return;

            const key = node.getKey();
            const origin = nodeOriginMap.get(key);
            const domElement = editor.getElementByKey(key);
            if (!domElement) return;

            // Remove all managed classes first
            ALL_BODY_CLASSES.forEach(className => {
              domElement.classList.remove(className);
            });
            domElement.classList.remove('dita-editor-placeholder-shortdesc');

            // Troubleshooting container membership (ADR-009)
            const troubleClass = troubleSectionClass(origin?.containerPath);
            if (troubleClass) domElement.classList.add(troubleClass);

            // Add the appropriate class if origin tag matches
            if (origin?.tag && BODY_TAG_CLASSES[origin.tag]) {
              domElement.classList.add(BODY_TAG_CLASSES[origin.tag]);
              // Mark shortdesc as placeholder when it still contains template text
              if (origin.tag === 'shortdesc') {
                const text = node.getTextContent();
                if (ALL_PLACEHOLDER_SHORTDESCS.has(text)) {
                  domElement.classList.add('dita-editor-placeholder-shortdesc');
                }
              }
            }
          });
        });
      },
    );

    // ── Mutation listener: apply note-type CSS class on QuoteNode DOM nodes ──
    const removeQuoteMutationListener = editor.registerMutationListener(
      QuoteNode,
      () => {
        editor.getEditorState().read(() => {
          const root = $getRoot();
          root.getChildren().forEach((node) => {
            if (!$isElementNode(node) || node.getType() !== 'quote') return;

            const key = node.getKey();
            const origin = nodeOriginMap.get(key);
            const domElement = editor.getElementByKey(key);
            if (!domElement) return;

            // Remove all managed note-type classes first
            ALL_NOTE_TYPE_CLASSES.forEach(className => {
              domElement.classList.remove(className);
            });
            // Remove the data-note-type label attribute
            domElement.removeAttribute('data-note-type');

            // Apply type-specific class and label
            if (origin?.tag === 'note' && origin.noteType) {
              const cls = NOTE_TYPE_CLASSES[origin.noteType] ?? NOTE_TYPE_CLASSES['NOTE'];
              domElement.classList.add(cls);
              domElement.setAttribute('data-note-type', origin.noteType);
            }
          });
        });
      },
    );

    // ── Mutation listener: apply section-title and placeholder CSS classes on HeadingNode DOM nodes ──
    const removeHeadingMutationListener = editor.registerMutationListener(
      HeadingNode,
      () => {
        editor.getEditorState().read(() => {
          const root = $getRoot();
          root.getChildren().forEach((node) => {
            if (!$isHeadingNode(node)) return;

            const key = node.getKey();
            const origin = nodeOriginMap.get(key);
            const domElement = editor.getElementByKey(key);
            if (!domElement) return;

            if (node.getTag() === 'h2') {
              if (origin?.tag === 'section-title') {
                domElement.classList.add('dita-editor-section-title');
              } else {
                domElement.classList.remove('dita-editor-section-title');
              }
            }

            if (node.getTag() === 'h1') {
              const text = node.getTextContent();
              if (ALL_PLACEHOLDER_TITLES.has(text)) {
                domElement.classList.add('dita-editor-placeholder-title');
              } else {
                domElement.classList.remove('dita-editor-placeholder-title');
              }
            }
          });
        });
      },
    );

    return () => {
      removeEnterListener();
      removeMutationListener();
      removeQuoteMutationListener();
      removeHeadingMutationListener();
    };
  }, [editor, nodeOriginMap]);

  return null;
};
