import {
  $createParagraphNode,
  $createTextNode,
  $getNodeByKey,
  ElementNode,
  LexicalEditor,
} from 'lexical';
import { $createQuoteNode } from '@lexical/rich-text';
import {
  INSERT_UNORDERED_LIST_COMMAND,
  INSERT_ORDERED_LIST_COMMAND,
} from '@lexical/list';
import { $createDitaCodeBlockNode } from '../components/DitaCodeBlockNode';
import { $createDitaImageNode } from '../components/DitaImageNode';
import {
  OPEN_INSERT_TABLE_MODAL_COMMAND,
  OPEN_INSERT_LINK_MODAL_COMMAND,
} from '../dita-architect';

export interface InsertableElement {
  ditaTag: string;
  displayName: string;
  searchTerms: string[];
  insert: (editor: LexicalEditor, afterKey: string) => void;
}

const withAfter = (
  editor: LexicalEditor,
  afterKey: string,
  fn: (after: ElementNode) => void,
) => {
  editor.update(() => {
    const node = $getNodeByKey(afterKey);
    if (!node || !(node instanceof ElementNode)) return;
    fn(node);
  });
};

export const INSERTABLE_ELEMENTS: InsertableElement[] = [
  {
    ditaTag: 'p',
    displayName: 'Paragraph',
    searchTerms: ['paragraph', 'text', 'p'],
    insert: (editor, afterKey) => {
      withAfter(editor, afterKey, (after) => {
        const p = $createParagraphNode();
        after.insertAfter(p);
        p.select();
      });
    },
  },
  {
    ditaTag: 'ul',
    displayName: 'Bulleted list',
    searchTerms: ['bulleted', 'unordered', 'list', 'ul'],
    insert: (editor, afterKey) => {
      withAfter(editor, afterKey, (after) => {
        const p = $createParagraphNode();
        after.insertAfter(p);
        p.select();
      });
      editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
    },
  },
  {
    ditaTag: 'ol',
    displayName: 'Numbered list',
    searchTerms: ['numbered', 'ordered', 'list', 'ol'],
    insert: (editor, afterKey) => {
      withAfter(editor, afterKey, (after) => {
        const p = $createParagraphNode();
        after.insertAfter(p);
        p.select();
      });
      editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
    },
  },
  {
    ditaTag: 'note',
    displayName: 'Note',
    searchTerms: ['note', 'warning', 'tip', 'caution', 'quote'],
    insert: (editor, afterKey) => {
      withAfter(editor, afterKey, (after) => {
        const quote = $createQuoteNode();
        const inner = $createParagraphNode();
        quote.append(inner);
        after.insertAfter(quote);
        inner.select();
      });
    },
  },
  {
    ditaTag: 'codeblock',
    displayName: 'Code block',
    searchTerms: ['code', 'pre', 'codeblock'],
    insert: (editor, afterKey) => {
      withAfter(editor, afterKey, (after) => {
        const codeBlock = $createDitaCodeBlockNode('', 'plain');
        after.insertAfter(codeBlock);
      });
    },
  },
  {
    ditaTag: 'table',
    displayName: 'Table',
    searchTerms: ['table', 'grid'],
    insert: (editor, afterKey) => {
      withAfter(editor, afterKey, (after) => {
        const anchor = $createParagraphNode();
        after.insertAfter(anchor);
        anchor.select();
      });
      editor.dispatchCommand(OPEN_INSERT_TABLE_MODAL_COMMAND, undefined);
    },
  },
  {
    ditaTag: 'image',
    displayName: 'Image',
    searchTerms: ['image', 'figure', 'picture', 'img'],
    insert: (editor, afterKey) => {
      withAfter(editor, afterKey, (after) => {
        const wrapper = $createParagraphNode();
        wrapper.append($createDitaImageNode('', '', '', false));
        after.insertAfter(wrapper);
      });
    },
  },
  {
    ditaTag: 'xref',
    displayName: 'Link',
    searchTerms: ['link', 'xref', 'cross-reference', 'hyperlink'],
    insert: (editor, afterKey) => {
      withAfter(editor, afterKey, (after) => {
        const p = $createParagraphNode();
        const text = $createTextNode('link');
        p.append(text);
        after.insertAfter(p);
        text.select(0, text.getTextContentSize());
      });
      editor.dispatchCommand(OPEN_INSERT_LINK_MODAL_COMMAND, undefined);
    },
  },
];
