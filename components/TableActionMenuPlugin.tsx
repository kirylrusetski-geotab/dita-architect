import React, { useEffect, useState, useRef } from 'react';
import { toast } from 'sonner';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getNodeByKey,
  $getSelection,
  $isRangeSelection,
  $createTextNode
} from 'lexical';
import {
  $isTableCellNode,
  $isTableRowNode,
  $isTableNode,
  TableCellNode,
  TableRowNode,
  $createTableRowNode,
  $createTableCellNode,
  $getTableRowIndexFromTableCellNode,
  $getTableColumnIndexFromTableCellNode,
  TableCellHeaderStates,
  $isTableSelection
} from '@lexical/table';
import {
  $createParagraphNode
} from 'lexical';

type MenuPosition = {
  x: number;
  y: number;
};

type MenuAction = {
  label: string;
  action: () => void;
  separator?: boolean;
  disabled?: boolean;
};

export const TableActionMenuPlugin = () => {
  const [editor] = useLexicalComposerContext();
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuPosition, setMenuPosition] = useState<MenuPosition>({ x: 0, y: 0 });
  const [targetCellKey, setTargetCellKey] = useState<string | null>(null);
  const [selectedCells, setSelectedCells] = useState<string[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const [focusedItemIndex, setFocusedItemIndex] = useState(0);
  const [triggerElement, setTriggerElement] = useState<HTMLElement | null>(null);

  // Get table cell from right-click target and detect multi-cell selections
  const getTableCellFromTarget = (target: Element): { cell: TableCellNode | null; selectedCells: string[] } => {
    let element = target;
    while (element && element !== document.body) {
      const nodeKey = element.getAttribute('data-lexical-editor-key');
      if (nodeKey) {
        return editor.getEditorState().read(() => {
          const node = $getNodeByKey(nodeKey);
          if ($isTableCellNode(node)) {
            // Check if we have a table selection with multiple cells
            const selection = $getSelection();
            if ($isTableSelection(selection)) {
              const selectedNodeKeys = selection.getNodes().map(n => n.getKey()).filter(key => {
                const node = $getNodeByKey(key);
                return $isTableCellNode(node);
              });
              return { cell: node, selectedCells: selectedNodeKeys };
            }
            // Single cell selection
            return { cell: node, selectedCells: [node.getKey()] };
          }
          return { cell: null, selectedCells: [] };
        });
      }
      element = element.parentElement as Element;
    }
    return { cell: null, selectedCells: [] };
  };

  // Calculate menu position within viewport
  const calculateMenuPosition = (x: number, y: number): MenuPosition => {
    const menuWidth = 200;
    const menuHeight = 320; // Increased from 280 to accommodate new menu items
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight
    };

    let adjustedX = x;
    let adjustedY = y;

    // Adjust horizontal position
    if (x + menuWidth > viewport.width) {
      adjustedX = x - menuWidth;
    }

    // Adjust vertical position
    if (y + menuHeight > viewport.height) {
      adjustedY = y - menuHeight;
    }

    // Ensure menu doesn't go off-screen
    adjustedX = Math.max(10, adjustedX);
    adjustedY = Math.max(10, adjustedY);

    return { x: adjustedX, y: adjustedY };
  };

  // Handle right-click events
  useEffect(() => {
    const handleContextMenu = (event: MouseEvent) => {
      const target = event.target as Element;
      const { cell: cellNode, selectedCells: cellKeys } = getTableCellFromTarget(target);

      if (cellNode && cellKeys.length > 0) {
        event.preventDefault();
        const position = calculateMenuPosition(event.clientX, event.clientY);
        setMenuPosition(position);
        setTargetCellKey(cellNode.getKey());
        setSelectedCells(cellKeys);
        setTriggerElement(target as HTMLElement);
        setMenuVisible(true);
        setFocusedItemIndex(0);
      }
    };

    const handleClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuVisible(false);
        if (triggerElement) {
          triggerElement.focus();
        }
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!menuVisible) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        setMenuVisible(false);
        if (triggerElement) {
          triggerElement.focus();
        }
        return;
      }

      // Only handle menu navigation if the menu is visible and event is within menu
      if (menuRef.current && menuRef.current.contains(event.target as Node)) {
        const menuItems = Array.from(menuRef.current.querySelectorAll('.table-action-menu-item:not(.disabled)')) as HTMLElement[];

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          const nextIndex = (focusedItemIndex + 1) % menuItems.length;
          setFocusedItemIndex(nextIndex);
          menuItems[nextIndex]?.focus();
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          const prevIndex = (focusedItemIndex - 1 + menuItems.length) % menuItems.length;
          setFocusedItemIndex(prevIndex);
          menuItems[prevIndex]?.focus();
        } else if (event.key === 'Home') {
          event.preventDefault();
          setFocusedItemIndex(0);
          menuItems[0]?.focus();
        } else if (event.key === 'End') {
          event.preventDefault();
          const lastIndex = menuItems.length - 1;
          setFocusedItemIndex(lastIndex);
          menuItems[lastIndex]?.focus();
        } else if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          const focusedItem = menuItems[focusedItemIndex];
          if (focusedItem) {
            focusedItem.click();
          }
        } else if (event.key === 'Tab') {
          event.preventDefault();
          setMenuVisible(false);
          if (triggerElement) {
            triggerElement.focus();
          }
        }
      }
    };

    const editorElement = editor.getRootElement();
    if (editorElement) {
      editorElement.addEventListener('contextmenu', handleContextMenu);
      document.addEventListener('click', handleClick);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      if (editorElement) {
        editorElement.removeEventListener('contextmenu', handleContextMenu);
      }
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [editor, menuVisible, focusedItemIndex, triggerElement]);

  // Focus first enabled item when menu opens
  useEffect(() => {
    if (menuVisible && menuRef.current) {
      setTimeout(() => {
        const firstEnabledItem = menuRef.current?.querySelector('.table-action-menu-item:not(.disabled)') as HTMLElement;
        if (firstEnabledItem) {
          firstEnabledItem.focus();
        }
      }, 0);
    }
  }, [menuVisible]);

  // Check if we're in a simpletable (which doesn't support cell spanning)
  // This uses a heuristic: if no cells in the table have spanning, we assume simpletable
  const isSimpleTable = (cellNode: TableCellNode): boolean => {
    const rowNode = cellNode.getParent();
    if (!$isTableRowNode(rowNode)) return false;

    const tableNode = rowNode.getParent();
    if (!$isTableNode(tableNode)) return false;

    // Check all cells in the table for any spanning
    const allRows = tableNode.getChildren();
    for (const row of allRows) {
      if ($isTableRowNode(row)) {
        const cells = row.getChildren();
        for (const cell of cells) {
          if ($isTableCellNode(cell)) {
            // If any cell has spanning, this is likely a CALS table
            if (cell.getRowSpan() > 1 || cell.getColSpan() > 1) {
              return false;
            }
          }
        }
      }
    }
    // If no spanning found, assume simpletable (conservative approach to prevent invalid DITA)
    return true;
  };

  // Menu actions
  const createMenuActions = (cellKey: string): MenuAction[] => {
    let canMerge = false;
    let canUnmerge = false;
    let isHeaderRow = false;
    let isSimpleTableType = false;
    let hasMultipleCellsSelected = false;

    editor.getEditorState().read(() => {
      const cellNode = $getNodeByKey(cellKey);
      if ($isTableCellNode(cellNode)) {
        // Check table type
        isSimpleTableType = isSimpleTable(cellNode);

        // Check if multiple cells are selected
        hasMultipleCellsSelected = selectedCells.length > 1;

        // Check if cell can be unmerged (has colspan or rowspan > 1)
        canUnmerge = cellNode.getColSpan() > 1 || cellNode.getRowSpan() > 1;

        // Check if the first row is a header row
        const rowNode = cellNode.getParent();
        if ($isTableRowNode(rowNode)) {
          const tableNode = rowNode.getParent();
          if ($isTableNode(tableNode)) {
            const firstRow = tableNode.getChildren()[0];
            if ($isTableRowNode(firstRow)) {
              const firstRowCells = firstRow.getChildren();
              if (firstRowCells.length > 0 && $isTableCellNode(firstRowCells[0])) {
                const firstCell = firstRowCells[0] as TableCellNode;
                const headerStyles = firstCell.getHeaderStyles();
                isHeaderRow = (headerStyles & TableCellHeaderStates.ROW) !== 0;
              }
            }
          }
        }

        // Check if we can merge - only for CALS tables, not simpletables
        if (!isSimpleTableType) {
          if (hasMultipleCellsSelected) {
            // Can merge if multiple cells are selected
            canMerge = true;
          } else {
            // Single cell - can merge if there's a next cell in the same row
            const parentRowNode = cellNode.getParent();
            if ($isTableRowNode(parentRowNode)) {
              const cells = parentRowNode.getChildren();
              const cellIndex = cells.findIndex(cell => cell.getKey() === cellKey);
              canMerge = cellIndex < cells.length - 1;
            }
          }
        }
      }
    });

    return [
      {
        label: 'Insert row above',
        action: () => {
          editor.update(() => {
            const cellNode = $getNodeByKey(cellKey);
            if ($isTableCellNode(cellNode)) {
              const rowNode = cellNode.getParent();
              if ($isTableRowNode(rowNode)) {
                const tableNode = rowNode.getParent();
                if ($isTableNode(tableNode)) {
                  // Create new row with same number of cells
                  const newRow = $createTableRowNode();
                  const cellCount = rowNode.getChildren().length;

                  for (let i = 0; i < cellCount; i++) {
                    const newCell = $createTableCellNode(0);
                    newCell.append($createParagraphNode());
                    newRow.append(newCell);
                  }

                  rowNode.insertBefore(newRow);
                }
              }
            }
          });
          setMenuVisible(false);
        }
      },
      {
        label: 'Insert row below',
        action: () => {
          editor.update(() => {
            const cellNode = $getNodeByKey(cellKey);
            if ($isTableCellNode(cellNode)) {
              const rowNode = cellNode.getParent();
              if ($isTableRowNode(rowNode)) {
                const tableNode = rowNode.getParent();
                if ($isTableNode(tableNode)) {
                  // Create new row with same number of cells
                  const newRow = $createTableRowNode();
                  const cellCount = rowNode.getChildren().length;

                  for (let i = 0; i < cellCount; i++) {
                    const newCell = $createTableCellNode(0);
                    newCell.append($createParagraphNode());
                    newRow.append(newCell);
                  }

                  rowNode.insertAfter(newRow);
                }
              }
            }
          });
          setMenuVisible(false);
        }
      },
      {
        label: 'Delete row',
        action: () => {
          let prevented = false;
          editor.update(() => {
            const cellNode = $getNodeByKey(cellKey);
            if ($isTableCellNode(cellNode)) {
              const rowNode = cellNode.getParent();
              if ($isTableRowNode(rowNode)) {
                const tableNode = rowNode.getParent();
                if ($isTableNode(tableNode)) {
                  const rowCount = tableNode.getChildren().length;
                  if (rowCount <= 1) {
                    prevented = true;
                    return;
                  }

                  rowNode.remove();
                }
              }
            }
          });
          if (prevented) {
            toast.error('Cannot delete the last row — tables must have at least one row');
          }
          setMenuVisible(false);
        },
        separator: true
      },
      {
        label: 'Insert column left',
        action: () => {
          editor.update(() => {
            const cellNode = $getNodeByKey(cellKey);
            if ($isTableCellNode(cellNode)) {
              const rowNode = cellNode.getParent();
              if ($isTableRowNode(rowNode)) {
                const tableNode = rowNode.getParent();
                if ($isTableNode(tableNode)) {
                  const columnIndex = $getTableColumnIndexFromTableCellNode(cellNode);

                  // Insert new cell in each row at the specified column index
                  const rows = tableNode.getChildren();
                  rows.forEach((row) => {
                    if ($isTableRowNode(row)) {
                      const cells = row.getChildren();
                      const targetCell = cells[columnIndex];
                      if (targetCell && $isTableCellNode(targetCell)) {
                        const newCell = $createTableCellNode(0);
                        newCell.append($createParagraphNode());
                        targetCell.insertBefore(newCell);
                      }
                    }
                  });
                }
              }
            }
          });
          setMenuVisible(false);
        }
      },
      {
        label: 'Insert column right',
        action: () => {
          editor.update(() => {
            const cellNode = $getNodeByKey(cellKey);
            if ($isTableCellNode(cellNode)) {
              const rowNode = cellNode.getParent();
              if ($isTableRowNode(rowNode)) {
                const tableNode = rowNode.getParent();
                if ($isTableNode(tableNode)) {
                  const columnIndex = $getTableColumnIndexFromTableCellNode(cellNode);

                  // Insert new cell in each row after the specified column index
                  const rows = tableNode.getChildren();
                  rows.forEach((row) => {
                    if ($isTableRowNode(row)) {
                      const cells = row.getChildren();
                      const targetCell = cells[columnIndex];
                      if (targetCell && $isTableCellNode(targetCell)) {
                        const newCell = $createTableCellNode(0);
                        newCell.append($createParagraphNode());
                        targetCell.insertAfter(newCell);
                      }
                    }
                  });
                }
              }
            }
          });
          setMenuVisible(false);
        }
      },
      {
        label: 'Delete column',
        action: () => {
          let prevented = false;
          editor.update(() => {
            const cellNode = $getNodeByKey(cellKey);
            if ($isTableCellNode(cellNode)) {
              const rowNode = cellNode.getParent();
              if ($isTableRowNode(rowNode)) {
                const tableNode = rowNode.getParent();
                if ($isTableNode(tableNode)) {
                  const firstRow = tableNode.getChildren()[0];
                  if ($isTableRowNode(firstRow)) {
                    const colCount = firstRow.getChildren().length;
                    if (colCount <= 1) {
                      prevented = true;
                      return;
                    }

                    const columnIndex = $getTableColumnIndexFromTableCellNode(cellNode);

                    // Delete cell at the specified column index from each row
                    const rows = tableNode.getChildren();
                    rows.forEach((row) => {
                      if ($isTableRowNode(row)) {
                        const cells = row.getChildren();
                        const targetCell = cells[columnIndex];
                        if (targetCell && $isTableCellNode(targetCell)) {
                          targetCell.remove();
                        }
                      }
                    });
                  }
                }
              }
            }
          });
          if (prevented) {
            toast.error('Cannot delete the last column — tables must have at least one column');
          }
          setMenuVisible(false);
        },
        separator: true
      },
      {
        label: 'Toggle header row',
        action: () => {
          editor.update(() => {
            const cellNode = $getNodeByKey(cellKey);
            if ($isTableCellNode(cellNode)) {
              const rowNode = cellNode.getParent();
              if ($isTableRowNode(rowNode)) {
                const tableNode = rowNode.getParent();
                if ($isTableNode(tableNode)) {
                  // Always toggle header status for the FIRST row
                  const firstRow = tableNode.getChildren()[0];
                  if ($isTableRowNode(firstRow)) {
                    const cells = firstRow.getChildren();
                    const newHeaderState = isHeaderRow
                      ? TableCellHeaderStates.NO_STATUS
                      : TableCellHeaderStates.ROW;

                    // Replace each cell in the first row with new cells having the toggled header state
                    for (let i = 0; i < cells.length; i++) {
                      const cell = cells[i];
                      if ($isTableCellNode(cell)) {
                        const newCell = $createTableCellNode(newHeaderState);
                        // Preserve cell content and span
                        const children = cell.getChildren();
                        children.forEach(child => newCell.append(child));
                        if (cell.getRowSpan() > 1) {
                          newCell.setRowSpan(cell.getRowSpan());
                        }
                        if (cell.getColSpan() > 1) {
                          newCell.setColSpan(cell.getColSpan());
                        }
                        cell.replace(newCell);
                      }
                    }
                  }
                }
              }
            }
          });
          setMenuVisible(false);
        }
      },
      {
        label: isSimpleTableType
          ? 'Merge cells (not available for simple tables)'
          : hasMultipleCellsSelected
            ? 'Merge cells'
            : canMerge
              ? 'Merge with next cell'
              : 'Merge cells (requires selection)',
        disabled: isSimpleTableType || !canMerge,
        action: () => {
          if (canMerge && !isSimpleTableType) {
            editor.update(() => {
              if (hasMultipleCellsSelected) {
                // Merge multiple selected cells
                const cellNodes = selectedCells.map(key => $getNodeByKey(key)).filter($isTableCellNode);
                if (cellNodes.length >= 2) {
                  // Use the first cell as the target
                  const targetCell = cellNodes[0];

                  // Get the table and determine the merge area
                  const targetRow = targetCell.getParent();
                  if (!$isTableRowNode(targetRow)) return;
                  const tableNode = targetRow.getParent();
                  if (!$isTableNode(tableNode)) return;

                  // Calculate cell positions to determine merge area
                  const cellPositions = cellNodes.map(cell => {
                    const row = cell.getParent();
                    if (!$isTableRowNode(row)) return null;
                    const rowIndex = $getTableRowIndexFromTableCellNode(cell);
                    const colIndex = $getTableColumnIndexFromTableCellNode(cell);
                    return { cell, rowIndex, colIndex };
                  }).filter(pos => pos !== null) as { cell: TableCellNode; rowIndex: number; colIndex: number; }[];

                  // Find the bounds of the selection
                  const minRow = Math.min(...cellPositions.map(pos => pos.rowIndex));
                  const maxRow = Math.max(...cellPositions.map(pos => pos.rowIndex));
                  const minCol = Math.min(...cellPositions.map(pos => pos.colIndex));
                  const maxCol = Math.max(...cellPositions.map(pos => pos.colIndex));

                  // Only merge if cells form a contiguous rectangle
                  const expectedCellCount = (maxRow - minRow + 1) * (maxCol - minCol + 1);
                  if (cellPositions.length !== expectedCellCount) {
                    // Not a contiguous selection - fall back to simple horizontal merge
                    let totalColspan = 0;
                    cellNodes.forEach(cell => {
                      totalColspan += cell.getColSpan() || 1;
                    });
                    targetCell.setColSpan(totalColspan);
                  } else {
                    // Proper rectangular selection - set both colspan and rowspan
                    const colspan = maxCol - minCol + 1;
                    const rowspan = maxRow - minRow + 1;
                    targetCell.setColSpan(colspan);
                    targetCell.setRowSpan(rowspan);
                  }

                  // Combine content from all other cells into the target cell
                  for (let i = 1; i < cellNodes.length; i++) {
                    const sourceCell = cellNodes[i];
                    const sourceCellChildren = sourceCell.getChildren();
                    sourceCellChildren.forEach(child => {
                      targetCell.append(child);
                    });
                  }

                  // Remove the source cells
                  for (let i = 1; i < cellNodes.length; i++) {
                    cellNodes[i].remove();
                  }
                }
              } else {
                // Single cell merge with next cell (existing logic)
                const cellNode = $getNodeByKey(cellKey);
                if ($isTableCellNode(cellNode)) {
                  const rowNode = cellNode.getParent();
                  if ($isTableRowNode(rowNode)) {
                    const cells = rowNode.getChildren();
                    const cellIndex = cells.findIndex(cell => cell.getKey() === cellKey);

                    // Merge with the next cell if it exists
                    if (cellIndex < cells.length - 1) {
                      const nextCell = cells[cellIndex + 1];
                      if ($isTableCellNode(nextCell)) {
                        // Combine content from next cell into current cell
                        const nextCellChildren = nextCell.getChildren();
                        nextCellChildren.forEach(child => {
                          cellNode.append(child);
                        });

                        // Increase column span
                        const currentColSpan = cellNode.getColSpan() || 1;
                        const nextColSpan = nextCell.getColSpan() || 1;
                        cellNode.setColSpan(currentColSpan + nextColSpan);

                        // Remove the merged cell
                        nextCell.remove();
                      }
                    }
                  }
                }
              }
            });
          }
          setMenuVisible(false);
        }
      },
      ...(canUnmerge && !isSimpleTableType ? [{
        label: 'Unmerge cell',
        action: () => {
          editor.update(() => {
            const cellNode = $getNodeByKey(cellKey);
            if ($isTableCellNode(cellNode)) {
              const rowNode = cellNode.getParent();
              if ($isTableRowNode(rowNode)) {
                const tableNode = rowNode.getParent();
                if ($isTableNode(tableNode)) {
                  const currentRowSpan = cellNode.getRowSpan();
                  const currentColSpan = cellNode.getColSpan();
                  const headerState = cellNode.getHeaderStyles();

                  if (currentRowSpan > 1) {
                    // Split rowspan: create new cells in subsequent rows
                    cellNode.setRowSpan(1);
                    const rowIndex = $getTableRowIndexFromTableCellNode(cellNode);
                    const colIndex = $getTableColumnIndexFromTableCellNode(cellNode);
                    const rows = tableNode.getChildren();

                    for (let r = rowIndex + 1; r < Math.min(rowIndex + currentRowSpan, rows.length); r++) {
                      const targetRow = rows[r];
                      if ($isTableRowNode(targetRow)) {
                        const newCell = $createTableCellNode(headerState);
                        newCell.append($createParagraphNode());
                        const targetCells = targetRow.getChildren();
                        if (colIndex < targetCells.length) {
                          targetCells[colIndex].insertBefore(newCell);
                        } else {
                          targetRow.append(newCell);
                        }
                      }
                    }
                  }

                  if (currentColSpan > 1) {
                    // Split colspan: create new cells in the same row
                    cellNode.setColSpan(1);
                    for (let c = 1; c < currentColSpan; c++) {
                      const newCell = $createTableCellNode(headerState);
                      newCell.append($createParagraphNode());
                      cellNode.insertAfter(newCell);
                    }
                  }
                }
              }
            }
          });
          setMenuVisible(false);
        }
      }] : [])
    ];
  };

  if (!menuVisible || !targetCellKey) {
    return null;
  }

  const actions = createMenuActions(targetCellKey);

  return (
    <div
      ref={menuRef}
      className="table-action-menu"
      role="menu"
      aria-label="Table actions"
      style={{
        position: 'fixed',
        left: menuPosition.x,
        top: menuPosition.y,
        zIndex: 20
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {actions.map((action, index) => (
        <React.Fragment key={index}>
          <div
            className={`table-action-menu-item ${action.disabled ? 'disabled' : ''}`}
            role="menuitem"
            aria-disabled={action.disabled}
            tabIndex={action.disabled ? -1 : 0}
            onClick={action.disabled ? undefined : action.action}
          >
            {action.label}
          </div>
          {action.separator && <div className="table-action-menu-separator" />}
        </React.Fragment>
      ))}
    </div>
  );
};