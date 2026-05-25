import React, { useRef, useEffect } from 'react';
import Editor, { OnMount, OnChange, Monaco } from '@monaco-editor/react';

import type { ThemeName } from './Toolbar';

// ── Syntax Theme Types & Options ────────────────────────────────────────────

export const SYNTAX_THEME_OPTIONS = [
  { value: 'material',   label: 'Material',   mode: 'dark'  },
  { value: 'github',     label: 'GitHub',     mode: 'dark'  },
  { value: 'monokai',    label: 'Monokai',    mode: 'dark'  },
  { value: 'dracula',    label: 'Dracula',    mode: 'dark'  },
  { value: 'one-dark',   label: 'One Dark',   mode: 'dark'  },
  { value: 'catppuccin', label: 'Catppuccin', mode: 'dark'  },
  { value: 'daylight',   label: 'Daylight',   mode: 'light' },
] as const;

export type SyntaxThemeName = typeof SYNTAX_THEME_OPTIONS[number]['value'];

// ── Syntax Token Rules ──────────────────────────────────────────────────────

const syntaxRules: Record<SyntaxThemeName, { base: 'vs' | 'vs-dark'; foreground: string; rules: Array<{ token: string; foreground: string; fontStyle?: string }> }> = {
  material: {
    base: 'vs-dark',
    foreground: 'EEFFFF',
    rules: [
      { token: 'tag', foreground: '80CBC4' },
      { token: 'attribute.name', foreground: 'FFCB6B' },
      { token: 'attribute.value', foreground: 'C3E88D' },
      { token: 'comment', foreground: '546E7A', fontStyle: 'italic' },
      { token: 'delimiter', foreground: '89DDFF' },
    ],
  },
  github: {
    base: 'vs-dark',
    foreground: 'E6EDF3',
    rules: [
      { token: 'tag', foreground: '7EE787' },
      { token: 'attribute.name', foreground: '79C0FF' },
      { token: 'attribute.value', foreground: 'A5D6FF' },
      { token: 'comment', foreground: '8B949E', fontStyle: 'italic' },
      { token: 'delimiter', foreground: 'D2A8FF' },
    ],
  },
  monokai: {
    base: 'vs-dark',
    foreground: 'F8F8F2',
    rules: [
      { token: 'tag', foreground: 'F92672' },
      { token: 'attribute.name', foreground: 'A6E22E' },
      { token: 'attribute.value', foreground: 'E6DB74' },
      { token: 'comment', foreground: '75715E', fontStyle: 'italic' },
      { token: 'delimiter', foreground: 'F8F8F2' },
    ],
  },
  dracula: {
    base: 'vs-dark',
    foreground: 'F8F8F2',
    rules: [
      { token: 'tag', foreground: 'FF79C6' },
      { token: 'attribute.name', foreground: '50FA7B' },
      { token: 'attribute.value', foreground: 'F1FA8C' },
      { token: 'comment', foreground: '6272A4', fontStyle: 'italic' },
      { token: 'delimiter', foreground: 'BD93F9' },
    ],
  },
  'one-dark': {
    base: 'vs-dark',
    foreground: 'ABB2BF',
    rules: [
      { token: 'tag', foreground: 'E06C75' },
      { token: 'attribute.name', foreground: 'D19A66' },
      { token: 'attribute.value', foreground: '98C379' },
      { token: 'comment', foreground: '5C6370', fontStyle: 'italic' },
      { token: 'delimiter', foreground: '56B6C2' },
    ],
  },
  catppuccin: {
    base: 'vs-dark',
    foreground: 'CDD6F4',
    rules: [
      { token: 'tag', foreground: 'CBA6F7' },
      { token: 'attribute.name', foreground: 'F9E2AF' },
      { token: 'attribute.value', foreground: 'A6E3A1' },
      { token: 'comment', foreground: '6C7086', fontStyle: 'italic' },
      { token: 'delimiter', foreground: 'F5C2E7' },
    ],
  },
  daylight: {
    base: 'vs',
    foreground: '24292F',
    rules: [
      { token: 'tag', foreground: '0550AE' },
      { token: 'attribute.name', foreground: '953800' },
      { token: 'attribute.value', foreground: '116329' },
      { token: 'comment', foreground: '6E7781', fontStyle: 'italic' },
      { token: 'delimiter', foreground: '0550AE' },
    ],
  },
};

// ── Background Colors Per App Theme ─────────────────────────────────────────

const bgColors: Record<ThemeName, { bg: string; lineHighlight: string; lineNumber: string }> = {
  dark:      { bg: '#111111', lineHighlight: '#1e1e1e', lineNumber: '#555555' },
  light:     { bg: '#f1f5f9', lineHighlight: '#e2e8f0', lineNumber: '#94a3b8' },
  claude:    { bg: '#1f150f', lineHighlight: '#3d2e24', lineNumber: '#8a7568' },
  nord:      { bg: '#242933', lineHighlight: '#3b4252', lineNumber: '#616e88' },
  solarized: { bg: '#001e28', lineHighlight: '#073642', lineNumber: '#586e75' },
  geotab:    { bg: '#1e2332', lineHighlight: '#25477b', lineNumber: '#8a9ba8' },
};

function buildThemeName(appTheme: ThemeName, syntax: SyntaxThemeName): string {
  return `combo-${appTheme}-${syntax}`;
}

// ── DITA Content Model ──────────────────────────────────────────────────────

interface DitaChild {
  element: string;
  doc: string;
}

const blockElements: DitaChild[] = [
  { element: 'p', doc: 'A paragraph' },
  { element: 'ul', doc: 'Unordered list' },
  { element: 'ol', doc: 'Ordered list' },
  { element: 'sl', doc: 'Simple list' },
  { element: 'dl', doc: 'Definition list' },
  { element: 'note', doc: 'A note, tip, or warning' },
  { element: 'table', doc: 'A table' },
  { element: 'simpletable', doc: 'A simple table' },
  { element: 'fig', doc: 'A figure with optional title' },
  { element: 'image', doc: 'An image reference' },
  { element: 'codeblock', doc: 'A block of code' },
  { element: 'pre', doc: 'Preformatted text' },
  { element: 'lq', doc: 'A long quotation' },
  { element: 'section', doc: 'A section with optional title' },
  { element: 'example', doc: 'An example' },
  { element: 'lines', doc: 'Lines of text (preserves line breaks)' },
  { element: 'draft-comment', doc: 'A comment for review' },
];

const inlineElements: DitaChild[] = [
  { element: 'b', doc: 'Bold text' },
  { element: 'i', doc: 'Italic text' },
  { element: 'u', doc: 'Underlined text' },
  { element: 'codeph', doc: 'Inline code phrase' },
  { element: 'uicontrol', doc: 'UI control name' },
  { element: 'filepath', doc: 'File path' },
  { element: 'menucascade', doc: 'Menu sequence (e.g. File > Save)' },
  { element: 'xref', doc: 'Cross-reference or link' },
  { element: 'ph', doc: 'Phrase container' },
  { element: 'keyword', doc: 'A keyword' },
  { element: 'term', doc: 'A term' },
  { element: 'cite', doc: 'A citation' },
  { element: 'wintitle', doc: 'Window or dialog title' },
  { element: 'varname', doc: 'A variable name' },
  { element: 'cmdname', doc: 'A command name' },
  { element: 'option', doc: 'An option or parameter value' },
  { element: 'parmname', doc: 'A parameter name' },
  { element: 'systemoutput', doc: 'System output text' },
  { element: 'userinput', doc: 'User input text' },
  { element: 'fn', doc: 'A footnote' },
];

const bodyChildren: DitaChild[] = [...blockElements, ...inlineElements];

const ditaContentModel: Record<string, DitaChild[]> = {
  // Task
  task: [
    { element: 'title', doc: 'The title of the task topic' },
    { element: 'shortdesc', doc: 'A brief description of the task' },
    { element: 'prolog', doc: 'Metadata container' },
    { element: 'taskbody', doc: 'The main body of the task' },
  ],
  taskbody: [
    { element: 'prereq', doc: 'Prerequisites for the task' },
    { element: 'context', doc: 'Background information' },
    { element: 'steps', doc: 'Ordered steps to complete the task' },
    { element: 'steps-unordered', doc: 'Unordered steps' },
    { element: 'result', doc: 'Expected result after completing the task' },
    { element: 'example', doc: 'An example of the task' },
    { element: 'postreq', doc: 'Actions to do after the task' },
  ],
  steps: [{ element: 'step', doc: 'A single step in the task' }],
  'steps-unordered': [{ element: 'step', doc: 'A single step' }],
  step: [
    { element: 'cmd', doc: 'The command or action for this step' },
    { element: 'info', doc: 'Additional information about the step' },
    { element: 'substeps', doc: 'Sub-steps within this step' },
    { element: 'stepresult', doc: 'The result of performing this step' },
    { element: 'choices', doc: 'A list of choices for the step' },
    { element: 'choicetable', doc: 'A table of choices' },
    { element: 'stepxmp', doc: 'An example for this step' },
    { element: 'tutorialinfo', doc: 'Tutorial-specific information' },
  ],
  substeps: [{ element: 'substep', doc: 'A sub-step' }],
  substep: [
    { element: 'cmd', doc: 'The command for this sub-step' },
    { element: 'info', doc: 'Additional information' },
    { element: 'stepresult', doc: 'Result of the sub-step' },
  ],
  choices: [{ element: 'choice', doc: 'A choice option' }],

  // Concept
  concept: [
    { element: 'title', doc: 'The title of the concept topic' },
    { element: 'shortdesc', doc: 'A brief description' },
    { element: 'prolog', doc: 'Metadata container' },
    { element: 'conbody', doc: 'The main body of the concept' },
  ],

  // Reference
  reference: [
    { element: 'title', doc: 'The title of the reference topic' },
    { element: 'shortdesc', doc: 'A brief description' },
    { element: 'prolog', doc: 'Metadata container' },
    { element: 'refbody', doc: 'The main body of the reference' },
  ],

  // Topic (generic)
  topic: [
    { element: 'title', doc: 'The title of the topic' },
    { element: 'shortdesc', doc: 'A brief description' },
    { element: 'prolog', doc: 'Metadata container' },
    { element: 'body', doc: 'The main body of the topic' },
  ],

  // Body-level containers → block + inline children
  conbody: bodyChildren,
  refbody: bodyChildren,
  body: bodyChildren,
  prereq: bodyChildren,
  context: bodyChildren,
  result: bodyChildren,
  postreq: bodyChildren,
  info: bodyChildren,
  stepresult: bodyChildren,
  stepxmp: bodyChildren,
  choice: bodyChildren,
  lq: bodyChildren,

  // Inline containers → inline children
  cmd: inlineElements,
  p: inlineElements,
  title: inlineElements,
  shortdesc: inlineElements,
  note: [...blockElements, ...inlineElements],
  ph: inlineElements,
  cite: inlineElements,
  fn: inlineElements,

  // List children
  ul: [{ element: 'li', doc: 'A list item' }],
  ol: [{ element: 'li', doc: 'A list item' }],
  sl: [{ element: 'sli', doc: 'A simple list item' }],
  li: bodyChildren,
  sli: inlineElements,

  // Definition list
  dl: [{ element: 'dlentry', doc: 'A definition list entry (term + definition)' }],
  dlentry: [
    { element: 'dt', doc: 'Definition term' },
    { element: 'dd', doc: 'Definition description' },
  ],
  dt: inlineElements,
  dd: bodyChildren,

  // Tables
  table: [
    { element: 'title', doc: 'Table title' },
    { element: 'tgroup', doc: 'Table group (columns, header, body)' },
  ],
  tgroup: [
    { element: 'colspec', doc: 'Column specification' },
    { element: 'thead', doc: 'Table header' },
    { element: 'tbody', doc: 'Table body' },
  ],
  thead: [{ element: 'row', doc: 'A header row' }],
  tbody: [{ element: 'row', doc: 'A table row' }],
  row: [{ element: 'entry', doc: 'A table cell' }],
  entry: bodyChildren,
  simpletable: [
    { element: 'sthead', doc: 'Simple table header row' },
    { element: 'strow', doc: 'Simple table row' },
  ],
  sthead: [{ element: 'stentry', doc: 'A header cell' }],
  strow: [{ element: 'stentry', doc: 'A table cell' }],
  stentry: bodyChildren,

  // Figure
  fig: [
    { element: 'title', doc: 'Figure title' },
    { element: 'image', doc: 'An image' },
    { element: 'p', doc: 'A paragraph' },
  ],
  image: [{ element: 'alt', doc: 'Alternative text for the image' }],

  // Section / Example
  section: [{ element: 'title', doc: 'Section title' }, ...bodyChildren],
  example: [{ element: 'title', doc: 'Example title' }, ...bodyChildren],

  // Menucascade
  menucascade: [{ element: 'uicontrol', doc: 'A UI control in the menu path' }],
};

// Snippets for elements that benefit from structured insertion
const elementSnippets: Record<string, string> = {
  step: '<step>\n\t<cmd>${1}</cmd>\n</step>',
  substep: '<substep>\n\t<cmd>${1}</cmd>\n</substep>',
  note: '<note type="${1|note,tip,important,warning,danger|}">${2}</note>',
  xref: '<xref href="${1}" format="${2|html,dita|}" scope="${3|external,local|}">${4}</xref>',
  image: '<image href="${1}" placement="${2|break,inline|}">\n\t<alt>${3}</alt>\n</image>',
  table: '<table>\n\t<title>${1}</title>\n\t<tgroup cols="${2:2}">\n\t\t<thead>\n\t\t\t<row>\n\t\t\t\t<entry>${3}</entry>\n\t\t\t</row>\n\t\t</thead>\n\t\t<tbody>\n\t\t\t<row>\n\t\t\t\t<entry>${4}</entry>\n\t\t\t</row>\n\t\t</tbody>\n\t</tgroup>\n</table>',
  simpletable: '<simpletable>\n\t<sthead>\n\t\t<stentry>${1}</stentry>\n\t\t<stentry>${2}</stentry>\n\t</sthead>\n\t<strow>\n\t\t<stentry>${3}</stentry>\n\t\t<stentry>${4}</stentry>\n\t</strow>\n</simpletable>',
  fig: '<fig>\n\t<title>${1}</title>\n\t<image href="${2}">\n\t\t<alt>${3}</alt>\n\t</image>\n</fig>',
  dl: '<dl>\n\t<dlentry>\n\t\t<dt>${1}</dt>\n\t\t<dd>${2}</dd>\n\t</dlentry>\n</dl>',
  section: '<section>\n\t<title>${1}</title>\n\t<p>${2}</p>\n</section>',
  example: '<example>\n\t<title>${1}</title>\n\t<p>${2}</p>\n</example>',
  codeblock: '<codeblock>${1}</codeblock>',
  menucascade: '<menucascade>\n\t<uicontrol>${1}</uicontrol>\n\t<uicontrol>${2}</uicontrol>\n</menucascade>',
  choices: '<choices>\n\t<choice>${1}</choice>\n</choices>',
  dlentry: '<dlentry>\n\t<dt>${1}</dt>\n\t<dd>${2}</dd>\n</dlentry>',
  tgroup: '<tgroup cols="${1:2}">\n\t<thead>\n\t\t<row>\n\t\t\t<entry>${2}</entry>\n\t\t</row>\n\t</thead>\n\t<tbody>\n\t\t<row>\n\t\t\t<entry>${3}</entry>\n\t\t</row>\n\t</tbody>\n</tgroup>',
};

// ── XML Helpers ─────────────────────────────────────────────────────────────

/** Walk text up to `offset`, tracking a stack of open XML tags. Returns the innermost unclosed element name. */
function findParentElement(text: string, offset: number): string | null {
  const src = text.substring(0, offset);
  const stack: string[] = [];
  let i = 0;

  while (i < src.length) {
    if (src[i] !== '<') { i++; continue; }

    // Comment
    if (src.startsWith('<!--', i)) {
      const end = src.indexOf('-->', i + 4);
      i = end === -1 ? src.length : end + 3;
      continue;
    }
    // PI
    if (src.startsWith('<?', i)) {
      const end = src.indexOf('?>', i + 2);
      i = end === -1 ? src.length : end + 2;
      continue;
    }
    // DOCTYPE / CDATA
    if (src.startsWith('<!', i)) {
      const end = src.indexOf('>', i + 2);
      i = end === -1 ? src.length : end + 1;
      continue;
    }

    const closing = src[i + 1] === '/';
    const nameStart = closing ? i + 2 : i + 1;
    let nameEnd = nameStart;
    while (nameEnd < src.length && /[\w.-]/.test(src[nameEnd])) nameEnd++;
    const tagName = src.substring(nameStart, nameEnd);
    if (!tagName) { i++; continue; }

    // Advance past attributes, respecting quotes
    let j = nameEnd;
    while (j < src.length && src[j] !== '>') {
      if (src[j] === '"') { j = src.indexOf('"', j + 1); if (j === -1) j = src.length; else j++; }
      else if (src[j] === "'") { j = src.indexOf("'", j + 1); if (j === -1) j = src.length; else j++; }
      else j++;
    }
    if (j >= src.length) break;

    const selfClosing = src[j - 1] === '/';
    if (closing) {
      const idx = stack.lastIndexOf(tagName);
      if (idx !== -1) stack.splice(idx, 1);
    } else if (!selfClosing) {
      stack.push(tagName);
    }
    i = j + 1;
  }
  return stack.length > 0 ? stack[stack.length - 1] : null;
}

// formatXml is defined in lib/xml-utils.ts and re-exported here for backwards compatibility
// with the Monaco formatting provider registration below.
import { formatXml } from '../lib/xml-utils';
export { formatXml };

// ── Monaco Provider Registration (once per session) ─────────────────────────

let providersRegistered = false;

function registerProviders(monaco: Monaco) {
  if (providersRegistered) return;
  providersRegistered = true;

  // XML formatting (Shift+Alt+F or right-click → Format Document)
  monaco.languages.registerDocumentFormattingEditProvider('xml', {
    provideDocumentFormattingEdits(model: any) {
      const text = model.getValue();
      const formatted = formatXml(text);
      return [{
        range: model.getFullModelRange(),
        text: formatted,
      }];
    },
  });

  // DITA element completion (triggered on '<' or Ctrl+Space)
  monaco.languages.registerCompletionItemProvider('xml', {
    triggerCharacters: ['<'],
    provideCompletionItems(model: any, position: any) {
      const lineContent = model.getLineContent(position.lineNumber);
      const textBeforeCursor = lineContent.substring(0, position.column - 1);

      // Are we right after `<` optionally followed by a partial name?
      const match = textBeforeCursor.match(/<(\w*)$/);
      if (!match) return { suggestions: [] };

      const partialName = match[1];
      const bracketCol = position.column - partialName.length - 1; // column of the `<`

      // Find parent element from full text up to the `<`
      const fullText = model.getValue();
      const offset = model.getOffsetAt({ lineNumber: position.lineNumber, column: bracketCol });
      const parent = findParentElement(fullText, offset);

      const children = parent ? (ditaContentModel[parent] || []) : [];
      if (children.length === 0) return { suggestions: [] };

      const range = {
        startLineNumber: position.lineNumber,
        startColumn: bracketCol,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      };

      return {
        suggestions: children.map((child, index) => ({
          label: child.element,
          kind: monaco.languages.CompletionItemKind.Snippet,
          documentation: child.doc,
          insertText: elementSnippets[child.element] || `<${child.element}>\${1}</${child.element}>`,
          insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
          range,
          filterText: child.element,
          sortText: String(index).padStart(3, '0'),
        })),
      };
    },
  });
}

// ── Auto-Close Tags ─────────────────────────────────────────────────────────

function setupAutoCloseTags(editor: any, monaco: Monaco) {
  editor.onDidChangeModelContent((e: any) => {
    if (e.isUndoing || e.isRedoing || e.isFlush) return;

    for (const change of e.changes) {
      if (change.text !== '>') continue;

      const model = editor.getModel();
      if (!model) return;

      const line = change.range.startLineNumber;
      // After the change, `>` is inserted at startColumn; cursor is at startColumn + 1
      const col = change.range.startColumn + 1; // 1-indexed column right after `>`
      const lineContent = model.getLineContent(line);
      const textBefore = lineContent.substring(0, col - 1); // includes the `>`

      // Walk backwards to find the `<`, respecting quotes
      let lastBracket = -1;
      let inDQ = false;
      let inSQ = false;
      for (let k = 0; k < textBefore.length - 1; k++) {
        const ch = textBefore[k];
        if (ch === '"' && !inSQ) inDQ = !inDQ;
        if (ch === "'" && !inDQ) inSQ = !inSQ;
        if (ch === '<' && !inDQ && !inSQ) lastBracket = k;
      }
      if (lastBracket === -1) continue;

      const segment = textBefore.substring(lastBracket, textBefore.length - 1); // between `<` and `>`

      // Skip closing tags, comments, PIs, DOCTYPE, self-closing
      if (segment.startsWith('</') || segment.startsWith('<!--') || segment.startsWith('<?') || segment.startsWith('<!')) continue;
      if (segment.endsWith('/')) continue;

      const nameMatch = segment.match(/^<(\w[\w.-]*)/);
      if (!nameMatch) continue;
      const tagName = nameMatch[1];

      // Don't insert if closing tag already follows
      const textAfter = lineContent.substring(col - 1);
      if (textAfter.startsWith(`</${tagName}>`)) continue;

      // Insert closing tag and position cursor between
      const insertPos = col; // 1-indexed column right after `>`
      editor.executeEdits('auto-close-tag', [{
        range: new monaco.Range(line, insertPos, line, insertPos),
        text: `</${tagName}>`,
      }]);
      editor.setPosition({ lineNumber: line, column: insertPos });
    }
  });
}

// ── Component ───────────────────────────────────────────────────────────────

export interface XmlError {
  line: number;
  column: number;
  message: string;
  severity: 'error' | 'warning';
}

interface MonacoDitaEditorProps {
  value: string;
  onChange?: (value: string) => void;
  onValidation?: (hasErrors: boolean, errors?: XmlError[]) => void;
  readOnly?: boolean;
  editorTheme?: ThemeName;
  syntaxTheme?: SyntaxThemeName;
  wordWrapEnabled?: boolean;
  onEditorReady?: (api: { revealLine: (line: number, col?: number) => void }) => void;
  onFormat?: () => void;
}

export const MonacoDitaEditor: React.FC<MonacoDitaEditorProps> = ({
  value,
  onChange,
  onValidation,
  readOnly = false,
  editorTheme = 'dark',
  syntaxTheme = 'material',
  wordWrapEnabled = false,
  onEditorReady,
  onFormat,
}) => {
  const editorRef = useRef<any>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const validateDita = (model: any, monaco: Monaco) => {
    const content = model.getValue();
    const markers: any[] = [];

    if (content.trim()) {
      // --- Structural XML validation ---
      const lines = content.split('\n');
      const tagStack: { name: string; line: number; col: number }[] = [];
      let i = 0;
      let line = 1;
      let col = 1;
      let hasStructuralError = false;

      const advance = () => {
        if (content[i] === '\n') { line++; col = 1; } else { col++; }
        i++;
      };

      const addError = (msg: string, l: number, c: number) => {
        const endCol = Math.max(c, (lines[l - 1]?.length || 0) + 1);
        markers.push({
          startLineNumber: l, startColumn: c,
          endLineNumber: l, endColumn: endCol,
          message: msg,
          severity: monaco.MarkerSeverity.Error,
        });
        hasStructuralError = true;
      };

      while (i < content.length && !hasStructuralError) {
        if (content[i] === '<') {
          const startLine = line;
          const startCol = col;

          // XML declaration <?...?>
          if (content.startsWith('<?', i)) {
            const end = content.indexOf('?>', i + 2);
            if (end === -1) { addError('Unterminated processing instruction', startLine, startCol); break; }
            while (i <= end + 1) advance();
            continue;
          }

          // Comment <!--...-->
          if (content.startsWith('<!--', i)) {
            const end = content.indexOf('-->', i + 4);
            if (end === -1) { addError('Unterminated comment', startLine, startCol); break; }
            while (i <= end + 2) advance();
            continue;
          }

          // CDATA <![CDATA[...]]>
          if (content.startsWith('<![CDATA[', i)) {
            const end = content.indexOf(']]>', i + 9);
            if (end === -1) { addError('Unterminated CDATA section', startLine, startCol); break; }
            while (i <= end + 2) advance();
            continue;
          }

          // DOCTYPE <!DOCTYPE...>
          if (content.startsWith('<!DOCTYPE', i) || content.startsWith('<!doctype', i)) {
            let depth = 0;
            while (i < content.length) {
              if (content[i] === '[') depth++;
              else if (content[i] === ']') depth--;
              else if (content[i] === '>' && depth === 0) { advance(); break; }
              advance();
            }
            continue;
          }

          // Closing tag </...>
          if (content[i + 1] === '/') {
            advance(); advance(); // skip </
            let tagName = '';
            while (i < content.length && /[\w:\-.]/.test(content[i])) { tagName += content[i]; advance(); }
            while (i < content.length && content[i] !== '>') advance();
            if (i < content.length) advance(); // skip >

            if (tagStack.length === 0) {
              addError(`Unexpected closing tag </${tagName}>: no open element`, startLine, startCol);
            } else if (tagStack[tagStack.length - 1].name !== tagName) {
              const expected = tagStack[tagStack.length - 1];
              addError(
                `Mismatched tag: expected </${expected.name}> (opened at line ${expected.line}) but found </${tagName}>`,
                startLine, startCol,
              );
            } else {
              tagStack.pop();
            }
            continue;
          }

          // Opening or self-closing tag
          advance(); // skip <
          let tagName = '';
          while (i < content.length && /[\w:\-.]/.test(content[i])) { tagName += content[i]; advance(); }

          if (!tagName) {
            addError('Invalid tag: expected element name after <', startLine, startCol);
            break;
          }

          // Skip attributes
          let inQuote: string | null = null;
          while (i < content.length) {
            if (inQuote) {
              if (content[i] === inQuote) inQuote = null;
              advance();
            } else if (content[i] === '"' || content[i] === "'") {
              inQuote = content[i]; advance();
            } else if (content[i] === '>') {
              break;
            } else if (content[i] === '/' && content[i + 1] === '>') {
              break;
            } else if (content[i] === '<') {
              addError(`Unexpected < inside <${tagName}> tag`, line, col);
              break;
            } else {
              advance();
            }
          }

          if (hasStructuralError) break;

          if (content[i] === '/' && content[i + 1] === '>') {
            advance(); advance(); // self-closing
          } else if (content[i] === '>') {
            advance(); // opening tag
            tagStack.push({ name: tagName, line: startLine, col: startCol });
          } else {
            addError(`Unterminated tag <${tagName}>`, startLine, startCol);
            break;
          }

        } else if (content[i] === '>') {
          // Stray > outside of any tag
          addError('Unexpected > character outside of a tag', line, col);
          break;
        } else {
          advance();
        }
      }

      // Unclosed tags at end of document
      if (!hasStructuralError && tagStack.length > 0) {
        const unclosed = tagStack[tagStack.length - 1];
        addError(
          `Unclosed tag <${unclosed.name}> (opened at line ${unclosed.line})`,
          unclosed.line, unclosed.col,
        );
      }

      // Fall back to DOMParser for anything else the structural check might miss
      if (!hasStructuralError) {
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/xml');
        const parseError = doc.querySelector('parsererror');
        if (parseError) {
          const errorText = parseError.textContent || 'Malformed XML';
          const lineMatch = errorText.match(/line\s+(\d+)/i);
          const colMatch = errorText.match(/column\s+(\d+)/i);
          const eLine = lineMatch ? parseInt(lineMatch[1]) : 1;
          const eCol = colMatch ? parseInt(colMatch[1]) : 1;
          markers.push({
            startLineNumber: eLine, startColumn: eCol,
            endLineNumber: eLine, endColumn: (lines[eLine - 1]?.length || 0) + 1,
            message: errorText,
            severity: monaco.MarkerSeverity.Error,
          });
        }
      }
    }

    // --- DITA-specific warnings ---
    if (content.trim() && !content.includes('<!DOCTYPE')) {
      markers.push({
        startLineNumber: 1, startColumn: 1,
        endLineNumber: 1, endColumn: 1,
        message: 'Missing DOCTYPE declaration. DITA topics should include a DOCTYPE.',
        severity: monaco.MarkerSeverity.Warning,
      });
    }

    const rootMatch = content.match(/<(?![?!])(\w+)(?:\s+[^>]*)?>/);
    if (rootMatch) {
      const rootTag = rootMatch[1];
      const validRoots = ['task', 'concept', 'reference', 'topic'];
      if (!validRoots.includes(rootTag)) {
        markers.push({
          startLineNumber: 1, startColumn: 1,
          endLineNumber: 1, endColumn: 1,
          message: `Root tag <${rootTag}> is not a standard DITA topic type (task, concept, reference).`,
          severity: monaco.MarkerSeverity.Warning,
        });
      }
    }

    // --- xref href validation (P2-6 MVP) ---
    const xrefRe = /<xref\b[^>]*?\/?>/g;
    const hrefRe = /href\s*=\s*["']([^"']*)["']/;
    let xrefMatch;
    while ((xrefMatch = xrefRe.exec(content)) !== null) {
      const tag = xrefMatch[0];
      const hrefAttr = tag.match(hrefRe);
      if (!hrefAttr || !hrefAttr[1].trim()) {
        const before = content.substring(0, xrefMatch.index);
        const lineNumber = before.split('\n').length;
        const lastNewline = before.lastIndexOf('\n');
        const column = xrefMatch.index - lastNewline;
        markers.push({
          startLineNumber: lineNumber, startColumn: column,
          endLineNumber: lineNumber, endColumn: column + tag.length,
          message: '<xref> has empty or missing href attribute',
          severity: monaco.MarkerSeverity.Warning,
        });
      }
    }

    monaco.editor.setModelMarkers(model, 'dita-validation', markers);
    const hasErrors = markers.some((m: any) => m.severity === monaco.MarkerSeverity.Error);
    const xmlErrors: XmlError[] = markers.map((m: any) => ({
      line: m.startLineNumber,
      column: m.startColumn,
      message: m.message,
      severity: m.severity === monaco.MarkerSeverity.Error ? 'error' as const : 'warning' as const,
    }));
    onValidation?.(hasErrors, xmlErrors);
  };

  const handleEditorChange: OnChange = (newValue) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      const val = newValue || '';
      if (onChange) onChange(val);
      if (editorRef.current && monacoRef.current) {
        validateDita(editorRef.current.getModel(), monacoRef.current);
      }
    }, 500);
  };

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  const defineComboTheme = (monaco: Monaco, app: ThemeName, syntax: SyntaxThemeName) => {
    const bg = bgColors[app];
    const syn = syntaxRules[syntax];
    const base = app === 'light' ? 'vs' as const : syn.base;

    monaco.editor.defineTheme(buildThemeName(app, syntax), {
      base,
      inherit: true,
      rules: syn.rules,
      colors: {
        'editor.background': bg.bg,
        'editor.foreground': `#${syn.foreground}`,
        'editor.lineHighlightBackground': bg.lineHighlight,
        'editorLineNumber.foreground': bg.lineNumber,
      },
    });
  };

  const currentComboName = buildThemeName(editorTheme, syntaxTheme);

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    defineComboTheme(monaco, editorTheme, syntaxTheme);
    monaco.editor.setTheme(currentComboName);

    registerProviders(monaco);
    setupAutoCloseTags(editor, monaco);

    // Register Shift+Alt+F keyboard shortcut for formatting
    editor.addAction({
      id: 'format-xml',
      label: 'Format XML',
      keybindings: [monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF],
      run: () => {
        onFormat?.();
      },
    });

    validateDita(editor.getModel(), monaco);

    onEditorReady?.({
      revealLine: (line: number, col = 1) => {
        editor.revealLineInCenter(line);
        editor.setPosition({ lineNumber: line, column: col });
        editor.focus();
      },
    });
  };

  useEffect(() => {
    if (monacoRef.current) {
      defineComboTheme(monacoRef.current, editorTheme, syntaxTheme);
      monacoRef.current.editor.setTheme(buildThemeName(editorTheme, syntaxTheme));
    }
  }, [editorTheme, syntaxTheme]);

  useEffect(() => {
    if (!editorRef.current || !monacoRef.current) return;
    const t = setTimeout(() => {
      if (editorRef.current && monacoRef.current) {
        validateDita(editorRef.current.getModel(), monacoRef.current);
      }
    }, 100);
    return () => clearTimeout(t);
  }, [value]);

  useEffect(() => {
    editorRef.current?.updateOptions({ wordWrap: wordWrapEnabled ? 'on' : 'off' });
  }, [wordWrapEnabled]);

  return (
    <div className="h-full w-full relative">
      <Editor
        height="100%"
        defaultLanguage="xml"
        value={value}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        theme={currentComboName}
        options={{
          readOnly,
          automaticLayout: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          fontSize: 13,
          fontFamily: "'JetBrains Mono', monospace",
          renderValidationDecorations: 'on',
          padding: { top: 16, bottom: 16 },
          formatOnPaste: true,
          wordWrap: wordWrapEnabled ? 'on' : 'off',
        }}
      />
    </div>
  );
};
