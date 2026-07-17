import { useEffect, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, $getNodeByKey, type EditorState, type LexicalNode } from 'lexical';
import {
  $createTrackedDeletionNode,
  $isTrackedDeletionNode,
} from './TrackedDeletionNode';

interface TrackedChangesPluginProps {
  editMode: boolean;
  snapshotRef: React.MutableRefObject<EditorState | null>;
  enterTrigger: number;
  tabId: string;
}

interface BaselineBlock {
  text: string;
  childTexts: string[];
  childKeys: string[];
}

// --- Word diff utility ---

interface DiffOp {
  type: 'equal' | 'insert' | 'delete';
  text: string;
}

/**
 * Split text into word tokens preserving whitespace.
 * Each token is either a word or a whitespace run.
 */
const tokenize = (text: string): string[] => {
  const tokens: string[] = [];
  const re = /(\w+|[^\w\s]|\s+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    tokens.push(match[0]);
  }
  return tokens;
};

/**
 * Simple word-level diff using LCS (Longest Common Subsequence).
 * Returns an array of operations describing equal, inserted, and deleted segments.
 */
const diffWords = (oldText: string, newText: string): DiffOp[] => {
  if (oldText === newText) return [{ type: 'equal', text: oldText }];
  if (oldText === '') return [{ type: 'insert', text: newText }];
  if (newText === '') return [{ type: 'delete', text: oldText }];

  const oldTokens = tokenize(oldText);
  const newTokens = tokenize(newText);

  const m = oldTokens.length;
  const n = newTokens.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldTokens[i - 1] === newTokens[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to get diff ops
  const ops: DiffOp[] = [];
  let i = m;
  let j = n;

  const rawOps: DiffOp[] = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldTokens[i - 1] === newTokens[j - 1]) {
      rawOps.push({ type: 'equal', text: oldTokens[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      rawOps.push({ type: 'insert', text: newTokens[j - 1] });
      j--;
    } else {
      rawOps.push({ type: 'delete', text: oldTokens[i - 1] });
      i--;
    }
  }

  rawOps.reverse();

  // Merge consecutive ops of the same type
  for (const op of rawOps) {
    if (ops.length > 0 && ops[ops.length - 1].type === op.type) {
      ops[ops.length - 1].text += op.text;
    } else {
      ops.push({ ...op });
    }
  }

  return ops;
};


/**
 * Collect leaf-level block nodes that directly contain inline/text content.
 * Recurses into ListNodes so each ListItemNode is tracked individually
 * rather than treating the entire list as one flat text block.
 */
const collectLeafBlocks = (nodes: LexicalNode[]): LexicalNode[] => {
  const leaves: LexicalNode[] = [];
  for (const node of nodes) {
    if (
      node.getType() === 'list' &&
      'getChildren' in node &&
      typeof (node as any).getChildren === 'function'
    ) {
      leaves.push(...collectLeafBlocks((node as any).getChildren() as LexicalNode[]));
    } else {
      leaves.push(node);
    }
  }
  return leaves;
};

export const TrackedChangesPlugin = ({
  editMode,
  snapshotRef,
  enterTrigger,
  tabId,
}: TrackedChangesPluginProps) => {
  const [editor] = useLexicalComposerContext();
  const baselineRef = useRef<Map<string, BaselineBlock>>(new Map());
  const baselineKeysOrderRef = useRef<string[]>([]);
  const overlayElementsRef = useRef<Map<string, HTMLElement>>(new Map());
  // Track which deletion nodes we've inserted, keyed by a descriptor string
  const insertedDeletionsRef = useRef<Map<string, string>>(new Map()); // descriptor -> nodeKey
  // Track whether we have active CSS highlights for insertions
  const hasHighlightsRef = useRef(false);
  const highlightKey = `tracked-insert-${tabId}`;

  // Build baseline when entering edit mode
  useEffect(() => {
    if (enterTrigger === 0) return;
    const snapshot = snapshotRef.current;
    if (!snapshot) return;

    const baseline = new Map<string, BaselineBlock>();
    const keysOrder: string[] = [];

    snapshot.read(() => {
      const root = $getRoot();
      const children = collectLeafBlocks(root.getChildren());
      for (const child of children) {
        const childTexts: string[] = [];
        const childKeys: string[] = [];
        if ('getChildren' in child && typeof (child as any).getChildren === 'function') {
          const inlineChildren = (child as any).getChildren() as LexicalNode[];
          for (const ic of inlineChildren) {
            childTexts.push(ic.getTextContent());
            childKeys.push(ic.getKey());
          }
        }
        baseline.set(child.getKey(), {
          text: child.getTextContent(),
          childTexts,
          childKeys,
        });
        keysOrder.push(child.getKey());
      }
    });

    baselineRef.current = baseline;
    baselineKeysOrderRef.current = keysOrder;
    insertedDeletionsRef.current.clear();
    if (hasHighlightsRef.current && 'highlights' in CSS) {
      (CSS as any).highlights.delete(highlightKey);
      hasHighlightsRef.current = false;
    }
  }, [enterTrigger]);

  // Register update listener while in edit mode
  useEffect(() => {
    if (!editMode) return;

    const removeListener = editor.registerUpdateListener(({ editorState }) => {
      const baseline = baselineRef.current;
      if (baseline.size === 0) return;

      const currentKeys = new Set<string>();

      // --- Phase 1: Read state to figure out what changed ---
      interface BlockChange {
        key: string;
        isNew: boolean;
        isModified: boolean;
        currentText: string;
        baselineText: string;
        diff: DiffOp[];
        childKeys: string[];
      }

      const blockChanges: BlockChange[] = [];

      editorState.read(() => {
        const root = $getRoot();
        const children = collectLeafBlocks(root.getChildren());

        for (const child of children) {
          const key = child.getKey();
          currentKeys.add(key);
          const baselineEntry = baseline.get(key);
          const currentText = child.getTextContent();

          // Collect child keys for insert CSS marking
          const childKeys: string[] = [];
          if ('getChildren' in child && typeof (child as any).getChildren === 'function') {
            const inlineChildren = (child as any).getChildren() as LexicalNode[];
            for (const ic of inlineChildren) {
              // Skip TrackedDeletionNodes from child key collection
              if ($isTrackedDeletionNode(ic)) continue;
              childKeys.push(ic.getKey());
            }
          }

          if (!baselineEntry) {
            // New block
            blockChanges.push({
              key,
              isNew: true,
              isModified: false,
              currentText,
              baselineText: '',
              diff: [],
              childKeys,
            });
          } else if (baselineEntry.text !== currentText) {
            // Modified block — compute word diff
            const diff = diffWords(baselineEntry.text, currentText);
            blockChanges.push({
              key,
              isNew: false,
              isModified: true,
              currentText,
              baselineText: baselineEntry.text,
              diff,
              childKeys,
            });
          } else {
            // Unchanged
            blockChanges.push({
              key,
              isNew: false,
              isModified: false,
              currentText,
              baselineText: baselineEntry.text,
              diff: [],
              childKeys,
            });
          }
        }
      });

      // --- Phase 2: Apply DOM classes for new blocks + CSS Highlight API for insertions ---
      const insertRanges: Range[] = [];

      for (const change of blockChanges) {
        const dom = editor.getElementByKey(change.key);
        if (!dom) continue;

        if (change.isNew) {
          dom.classList.add('tracked-addition');
        } else if (change.isModified) {
          dom.classList.remove('tracked-addition');

          // Compute character offsets of inserted text within the current content
          const insertSegments: { start: number; end: number }[] = [];
          let currentOffset = 0;
          for (const op of change.diff) {
            if (op.type === 'insert') {
              insertSegments.push({ start: currentOffset, end: currentOffset + op.text.length });
              currentOffset += op.text.length;
            } else if (op.type === 'equal') {
              currentOffset += op.text.length;
            }
            // 'delete' doesn't advance offset (deleted text isn't in current content)
          }

          // Walk DOM text nodes to create Range objects for each inserted segment
          if (insertSegments.length > 0) {
            const walker = document.createTreeWalker(dom, NodeFilter.SHOW_TEXT, {
              acceptNode: (node) => {
                // Skip text inside tracked deletion decorators
                const parent = node.parentElement;
                if (parent && parent.closest('.tracked-deletion-inline')) {
                  return NodeFilter.FILTER_REJECT;
                }
                return NodeFilter.FILTER_ACCEPT;
              },
            });

            let charPos = 0;
            let segIdx = 0;
            let textNode: Text | null;

            while ((textNode = walker.nextNode() as Text | null) && segIdx < insertSegments.length) {
              const nodeLen = textNode.length;
              const nodeEnd = charPos + nodeLen;

              while (segIdx < insertSegments.length) {
                const seg = insertSegments[segIdx];
                if (seg.start >= nodeEnd) break;

                const rangeStart = Math.max(seg.start - charPos, 0);
                const rangeEnd = Math.min(seg.end - charPos, nodeLen);

                if (rangeStart < rangeEnd) {
                  const range = new Range();
                  range.setStart(textNode, rangeStart);
                  range.setEnd(textNode, rangeEnd);
                  insertRanges.push(range);
                }

                if (seg.end <= nodeEnd) {
                  segIdx++;
                } else {
                  break;
                }
              }

              charPos = nodeEnd;
            }
          }
        } else {
          dom.classList.remove('tracked-addition');
        }
      }

      // Apply CSS Custom Highlight for all insertion ranges
      if ('highlights' in CSS) {
        if (insertRanges.length > 0) {
          (CSS as any).highlights.set(highlightKey, new (window as any).Highlight(...insertRanges));
          hasHighlightsRef.current = true;
        } else if (hasHighlightsRef.current) {
          (CSS as any).highlights.delete(highlightKey);
          hasHighlightsRef.current = false;
        }
      }

      // --- Phase 3: Insert/remove TrackedDeletionNodes for deleted text ---
      // Determine which deletion descriptors should exist
      const desiredDeletions = new Map<string, { blockKey: string; deletedText: string; position: number }>();

      for (const change of blockChanges) {
        if (!change.isModified) continue;

        let position = 0;
        for (const op of change.diff) {
          if (op.type === 'delete') {
            const descriptor = `${change.key}\0${position}\0${op.text}`;
            desiredDeletions.set(descriptor, {
              blockKey: change.key,
              deletedText: op.text,
              position,
            });
          }
          if (op.type === 'equal' || op.type === 'insert') {
            position += op.text.length;
          }
        }
      }

      // Find deletions to add and remove
      const currentDeletions = insertedDeletionsRef.current;
      const toAdd = new Map<string, { blockKey: string; deletedText: string; position: number }>();
      const toRemove = new Map<string, string>(); // descriptor -> nodeKey

      for (const [desc, info] of desiredDeletions) {
        if (!currentDeletions.has(desc)) {
          toAdd.set(desc, info);
        }
      }

      for (const [desc, nodeKey] of currentDeletions) {
        if (!desiredDeletions.has(desc)) {
          toRemove.set(desc, nodeKey);
        }
      }

      if (toAdd.size > 0 || toRemove.size > 0) {
        editor.update(
          () => {
            // Remove stale deletion nodes
            for (const [desc, nodeKey] of toRemove) {
              const node = $getNodeByKey(nodeKey);
              if (node && $isTrackedDeletionNode(node)) {
                node.remove();
              }
              currentDeletions.delete(desc);
            }

            // Add new deletion nodes
            for (const [desc, info] of toAdd) {
              const blockNode = $getNodeByKey(info.blockKey);

              if (
                !blockNode ||
                !('getChildren' in blockNode) ||
                typeof (blockNode as any).getChildren !== 'function'
              ) {
                continue;
              }

              const inlineChildren = (blockNode as any).getChildren() as LexicalNode[];
              const deletionNode = $createTrackedDeletionNode(info.deletedText);

              // Find the position to insert the deletion node.
              // position = character offset in current text where the deletion should appear.
              let charCount = 0;
              let inserted = false;

              for (const ic of inlineChildren) {
                if ($isTrackedDeletionNode(ic)) continue;
                const icText = ic.getTextContent();
                if (charCount + icText.length >= info.position) {
                  // Insert before this node if position matches start,
                  // or after if position is at end of this node's text
                  if (info.position === charCount) {
                    (ic as any).insertBefore(deletionNode);
                  } else if (info.position >= charCount + icText.length) {
                    (ic as any).insertAfter(deletionNode);
                  } else {
                    // Position is mid-node — split the text node and insert between halves
                    const splitOffset = info.position - charCount;
                    if ('splitText' in ic && typeof (ic as any).splitText === 'function') {
                      const [before] = (ic as any).splitText(splitOffset);
                      before.insertAfter(deletionNode);
                    } else {
                      (ic as any).insertAfter(deletionNode);
                    }
                  }
                  inserted = true;
                  break;
                }
                charCount += icText.length;
              }

              if (!inserted) {
                // Append at the end of the block
                (blockNode as any).append(deletionNode);
              }

              currentDeletions.set(desc, deletionNode.getKey());
            }
          },
          { discrete: true, tag: 'tracked-changes' },
        );
      }

      // --- Phase 4: Handle block-level deletions (entire block removed) ---
      const rootElement = editor.getRootElement();
      if (!rootElement) return;

      for (const [baseKey, entry] of baseline) {
        if (currentKeys.has(baseKey)) {
          // Node still exists — remove any deletion overlay
          const existing = overlayElementsRef.current.get(baseKey);
          if (existing && existing.parentNode) {
            existing.parentNode.removeChild(existing);
            overlayElementsRef.current.delete(baseKey);
          }
          continue;
        }

        // Node was deleted — show overlay if not already present
        if (overlayElementsRef.current.has(baseKey)) continue;

        const overlay = document.createElement('div');
        overlay.className = 'tracked-deletion';
        overlay.textContent = entry.text;
        overlay.dataset.trackedDeletion = baseKey;

        // Find the right position: insert before the next surviving sibling
        const baselineKeys = baselineKeysOrderRef.current;
        const baseIdx = baselineKeys.indexOf(baseKey);
        let insertedOverlay = false;

        for (let i = baseIdx + 1; i < baselineKeys.length; i++) {
          const nextKey = baselineKeys[i];
          if (currentKeys.has(nextKey)) {
            const nextDom = editor.getElementByKey(nextKey);
            if (nextDom && nextDom.parentNode === rootElement) {
              rootElement.insertBefore(overlay, nextDom);
              insertedOverlay = true;
              break;
            }
          }
        }

        if (!insertedOverlay) {
          rootElement.appendChild(overlay);
        }

        overlayElementsRef.current.set(baseKey, overlay);
      }
    });

    return removeListener;
  }, [editMode, editor]);

  // Cleanup when edit mode ends
  useEffect(() => {
    if (editMode) return;

    // Remove CSS classes and highlights
    const rootElement = editor.getRootElement();
    if (rootElement) {
      const elements = rootElement.querySelectorAll('.tracked-addition');
      elements.forEach((el) => el.classList.remove('tracked-addition'));
    }
    if (hasHighlightsRef.current && 'highlights' in CSS) {
      (CSS as any).highlights.delete(highlightKey);
      hasHighlightsRef.current = false;
    }

    // Remove all deletion overlays
    for (const [, overlay] of overlayElementsRef.current) {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
    }
    overlayElementsRef.current.clear();

    // Remove all TrackedDeletionNode instances from the tree
    editor.update(
      () => {
        const removeTrackedDeletions = (node: LexicalNode) => {
          if ('getChildren' in node && typeof (node as any).getChildren === 'function') {
            const children = (node as any).getChildren() as LexicalNode[];
            for (const child of children) {
              if ($isTrackedDeletionNode(child)) {
                child.remove();
              } else {
                removeTrackedDeletions(child);
              }
            }
          }
        };
        const root = $getRoot();
        for (const child of root.getChildren()) {
          removeTrackedDeletions(child);
        }
      },
      { discrete: true, tag: 'tracked-changes-cleanup' },
    );

    // Clear tracking state
    baselineRef.current.clear();
    baselineKeysOrderRef.current = [];
    insertedDeletionsRef.current.clear();
  }, [editMode, editor]);

  // Inject per-tab ::highlight() CSS rule and clean up on unmount
  useEffect(() => {
    if (!('highlights' in CSS)) return;
    const style = document.createElement('style');
    style.textContent = `::highlight(${highlightKey}) { text-decoration: underline; text-decoration-color: #22c55e; text-decoration-thickness: 2px; text-underline-offset: 2px; background-color: rgba(34, 197, 94, 0.10); }`;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
      (CSS as any).highlights.delete(highlightKey);
    };
  }, [highlightKey]);

  return null;
};
