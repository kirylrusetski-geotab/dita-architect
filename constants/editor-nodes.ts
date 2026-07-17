// Single source of truth for the Lexical node registry.
//
// dita-architect.tsx consumes this for the production editor config, and
// tests/helpers/createTestEditor.ts consumes it for every test editor — so a
// node added to the app can never silently be missing from round-trip tests
// (FR-047; previously 16 hand-rolled test factories had drifted from the app).
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import { TableNode, TableRowNode, TableCellNode } from '@lexical/table';
import { ParagraphNode, TextNode } from 'lexical';
import { DitaOpaqueNode } from '../components/DitaOpaqueNode';
import { DitaCodeBlockNode } from '../components/DitaCodeBlockNode';
import { DitaImageNode } from '../components/DitaImageNode';
import { DitaPhRefNode } from '../components/DitaPhRefNode';
import { DitaInfoPreviewNode } from '../components/DitaInfoPreviewNode';
import { TrackedTextNode } from '../components/TrackedTextNode';
import { ValidationDecoratorNode } from '../components/ValidationDecoratorNode';

export const EDITOR_NODES = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  ParagraphNode,
  TextNode,
  LinkNode,
  AutoLinkNode,
  TableNode,
  TableRowNode,
  TableCellNode,
  DitaOpaqueNode,
  DitaCodeBlockNode,
  DitaImageNode,
  DitaPhRefNode,
  DitaInfoPreviewNode,
  TrackedTextNode,
  ValidationDecoratorNode,
];
