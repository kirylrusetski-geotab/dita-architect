/**
 * DITA to Print HTML Serializer
 *
 * Converts a DITA XML string to a complete, self-contained HTML document
 * optimised for print/PDF via the browser's native print dialog.
 *
 * Entry point: generatePrintHtml(xmlContent, docTitle)
 */

// ── Inline element serializer ────────────────────────────────────────────────

function serializeInlineContent(node: Element): string {
  let html = '';
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      html += escapeHtml(child.textContent ?? '');
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const el = child as Element;
    const tag = el.tagName.toLowerCase();

    switch (tag) {
      case 'b':
      case 'bold':
        html += `<strong>${serializeInlineContent(el)}</strong>`;
        break;
      case 'i':
      case 'italic':
        html += `<em>${serializeInlineContent(el)}</em>`;
        break;
      case 'u':
        html += `<u>${serializeInlineContent(el)}</u>`;
        break;
      case 'codeph':
      case 'code':
        html += `<code>${escapeHtml(el.textContent ?? '')}</code>`;
        break;
      case 'uicontrol':
        html += `<kbd>${serializeInlineContent(el)}</kbd>`;
        break;
      case 'filepath':
      case 'varname':
      case 'cmdname':
      case 'userinput':
      case 'systemoutput':
      case 'msgph':
      case 'parmname':
      case 'apiname':
        html += `<code class="filepath">${escapeHtml(el.textContent ?? '')}</code>`;
        break;
      case 'term':
      case 'keyword':
      case 'cite':
        html += `<em>${serializeInlineContent(el)}</em>`;
        break;
      case 'ph':
      case 'wintitle':
      case 'menucascade':
      case 'option':
      case 'synph':
        html += `<span>${serializeInlineContent(el)}</span>`;
        break;
      case 'xref': {
        const href = el.getAttribute('href') ?? '#';
        const text = el.textContent?.trim() || href;
        html += `<a href="${escapeAttr(href)}">${escapeHtml(text)}</a>`;
        break;
      }
      case 'fn':
        html += ` <span class="fn">(${serializeInlineContent(el)})</span>`;
        break;
      case 'image': {
        const src = el.getAttribute('href') ?? '';
        const alt = el.getAttribute('alt') ?? '';
        if (src) html += `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" class="inline-image">`;
        break;
      }
      default:
        html += serializeInlineContent(el);
    }
  }
  return html;
}

// ── Block-level serializer ───────────────────────────────────────────────────

function serializeNode(node: Element, sectionDepth: number = 0): string {
  const tag = node.tagName.toLowerCase();

  switch (tag) {
    case 'topic':
    case 'concept':
    case 'task':
    case 'reference':
    case 'glossentry':
    case 'glossgroup':
      return `<article class="dita-topic">${serializeChildren(node, sectionDepth)}</article>`;

    case 'title': {
      const level = sectionDepth === 0 ? 1 : Math.min(sectionDepth + 1, 6);
      return `<h${level}>${serializeInlineContent(node)}</h${level}>\n`;
    }

    case 'shortdesc':
      return `<p class="shortdesc">${serializeInlineContent(node)}</p>\n`;

    case 'abstract':
      return serializeChildren(node, sectionDepth);

    case 'body':
    case 'conbody':
    case 'taskbody':
    case 'refbody':
    case 'glossbody':
      return `<div class="body">${serializeChildren(node, sectionDepth)}</div>\n`;

    case 'section':
    case 'refsyn':
      return `<section>${serializeChildren(node, sectionDepth + 1)}</section>\n`;

    case 'prereq':
      return `<div class="prereq"><span class="block-label">Prerequisites</span>${serializeChildren(node, sectionDepth)}</div>\n`;
    case 'context':
      return `<div class="context"><span class="block-label">Context</span>${serializeChildren(node, sectionDepth)}</div>\n`;
    case 'result':
      return `<div class="result"><span class="block-label">Result</span>${serializeChildren(node, sectionDepth)}</div>\n`;
    case 'postreq':
      return `<div class="postreq"><span class="block-label">What to do next</span>${serializeChildren(node, sectionDepth)}</div>\n`;
    case 'stepsection':
      return `<p class="stepsection">${serializeInlineContent(node)}</p>\n`;

    case 'steps': {
      const items = Array.from(node.children)
        .filter(c => c.tagName.toLowerCase() === 'step')
        .map(step => serializeStep(step, sectionDepth))
        .join('');
      return `<ol class="steps">${items}</ol>\n`;
    }
    case 'steps-unordered': {
      const items = Array.from(node.children)
        .filter(c => c.tagName.toLowerCase() === 'step')
        .map(step => serializeStep(step, sectionDepth))
        .join('');
      return `<ul class="steps">${items}</ul>\n`;
    }
    case 'steps-informal':
      return `<div class="steps-informal">${serializeChildren(node, sectionDepth)}</div>\n`;

    case 'p':
      return `<p>${serializeInlineContent(node)}</p>\n`;

    case 'ul':
      return `<ul>${serializeListItems(node, sectionDepth)}</ul>\n`;
    case 'ol':
      return `<ol>${serializeListItems(node, sectionDepth)}</ol>\n`;
    case 'sl':
      return `<ul class="sl">${serializeSimpleListItems(node)}</ul>\n`;

    case 'codeblock':
      return `<pre><code>${escapeHtml(node.textContent ?? '')}</code></pre>\n`;

    case 'note': {
      const noteType = node.getAttribute('type') ?? 'note';
      const label = NOTE_LABELS[noteType] ?? 'Note';
      return `<div class="note note-${escapeAttr(noteType)}"><span class="note-label">${label}:</span> ${serializeInlineContent(node)}</div>\n`;
    }

    case 'table':
      return serializeCalTable(node);

    case 'simpletable':
      return serializeSimpleTable(node);

    case 'fig': {
      const caption = node.querySelector(':scope > title');
      const img = node.querySelector('image');
      let html = '<figure>';
      if (img) {
        const src = img.getAttribute('href') ?? '';
        const alt = img.getAttribute('alt') ?? (caption?.textContent?.trim() ?? '');
        html += `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}">`;
      }
      if (caption) {
        html += `<figcaption>${escapeHtml(caption.textContent ?? '')}</figcaption>`;
      }
      html += '</figure>\n';
      return html;
    }
    case 'image': {
      const src = node.getAttribute('href') ?? '';
      const alt = node.getAttribute('alt') ?? '';
      if (!src) return '';
      return `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" class="block-image">\n`;
    }

    case 'dl': {
      const entries = Array.from(node.children).filter(c => c.tagName.toLowerCase() === 'dlentry');
      if (!entries.length) return '';
      const rows = entries.map(entry => {
        const dt = entry.querySelector('dt');
        const dd = entry.querySelector('dd');
        return `<dt>${dt ? serializeInlineContent(dt) : ''}</dt><dd>${dd ? serializeInlineContent(dd) : ''}</dd>`;
      }).join('\n');
      return `<dl>\n${rows}\n</dl>\n`;
    }

    case 'example':
      return `<div class="example"><span class="block-label">Example</span>${serializeChildren(node, sectionDepth)}</div>\n`;

    // Intentionally hidden in print output
    case 'related-links':
    case 'linkpool':
    case 'linklist':
    case 'link':
    case 'metadata':
    case 'prolog':
    case 'titlealts':
    case 'navtitle':
    case 'searchtitle':
    case 'required-cleanup':
    case 'draft-comment':
      return '';

    default:
      return serializeChildren(node, sectionDepth);
  }
}

function serializeStep(step: Element, sectionDepth: number): string {
  const cmd = step.querySelector(':scope > cmd');
  const info = step.querySelector(':scope > info');
  const stepxmp = step.querySelector(':scope > stepxmp');
  const substeps = step.querySelector(':scope > substeps');
  const choicetable = step.querySelector(':scope > choicetable');

  let html = '<li>';
  if (cmd) html += `<span class="cmd">${serializeInlineContent(cmd)}</span>`;
  if (info) html += `<div class="info">${serializeChildren(info, sectionDepth)}</div>`;
  if (stepxmp) html += `<div class="stepxmp">${serializeChildren(stepxmp, sectionDepth)}</div>`;
  if (substeps) {
    const subItems = Array.from(substeps.children)
      .filter(c => c.tagName.toLowerCase() === 'substep')
      .map(substep => {
        const subcmd = substep.querySelector(':scope > cmd');
        const subinfo = substep.querySelector(':scope > info');
        let sub = '<li>';
        if (subcmd) sub += `<span class="cmd">${serializeInlineContent(subcmd)}</span>`;
        if (subinfo) sub += `<div class="info">${serializeChildren(subinfo, sectionDepth)}</div>`;
        return sub + '</li>';
      })
      .join('');
    html += `<ol class="substeps">${subItems}</ol>`;
  }
  if (choicetable) html += serializeChoiceTable(choicetable);
  html += '</li>\n';
  return html;
}

function serializeListItems(list: Element, sectionDepth: number): string {
  return Array.from(list.children)
    .filter(c => ['li', 'listitem'].includes(c.tagName.toLowerCase()))
    .map(li => `<li>${serializeChildren(li, sectionDepth)}</li>\n`)
    .join('');
}

function serializeSimpleListItems(sl: Element): string {
  return Array.from(sl.children)
    .filter(c => c.tagName.toLowerCase() === 'sli')
    .map(sli => `<li>${serializeInlineContent(sli)}</li>\n`)
    .join('');
}

function serializeCalTable(table: Element): string {
  let html = '<table>\n';
  const tgroups = Array.from(table.children).filter(c => c.tagName.toLowerCase() === 'tgroup');
  const containers = tgroups.length > 0 ? tgroups : [table];

  for (const container of containers) {
    const thead = container.querySelector(':scope > thead');
    const tbody = container.querySelector(':scope > tbody');
    const tfoot = container.querySelector(':scope > tfoot');

    if (thead) {
      html += '<thead>\n';
      for (const row of Array.from(thead.children).filter(c => c.tagName.toLowerCase() === 'row')) {
        html += '<tr>' + Array.from(row.children)
          .filter(c => c.tagName.toLowerCase() === 'entry')
          .map(entry => `<th>${serializeInlineContent(entry)}</th>`)
          .join('') + '</tr>\n';
      }
      html += '</thead>\n';
    }
    if (tbody) {
      html += '<tbody>\n';
      for (const row of Array.from(tbody.children).filter(c => c.tagName.toLowerCase() === 'row')) {
        html += '<tr>' + Array.from(row.children)
          .filter(c => c.tagName.toLowerCase() === 'entry')
          .map(entry => `<td>${serializeInlineContent(entry)}</td>`)
          .join('') + '</tr>\n';
      }
      html += '</tbody>\n';
    }
    if (tfoot) {
      html += '<tfoot>\n';
      for (const row of Array.from(tfoot.children).filter(c => c.tagName.toLowerCase() === 'row')) {
        html += '<tr>' + Array.from(row.children)
          .filter(c => c.tagName.toLowerCase() === 'entry')
          .map(entry => `<td>${serializeInlineContent(entry)}</td>`)
          .join('') + '</tr>\n';
      }
      html += '</tfoot>\n';
    }

    const directRows = Array.from(container.children).filter(c => c.tagName.toLowerCase() === 'row');
    if (directRows.length > 0) {
      html += '<tbody>\n';
      for (const row of directRows) {
        html += '<tr>' + Array.from(row.children)
          .filter(c => c.tagName.toLowerCase() === 'entry')
          .map(entry => `<td>${serializeInlineContent(entry)}</td>`)
          .join('') + '</tr>\n';
      }
      html += '</tbody>\n';
    }
  }

  html += '</table>\n';
  return html;
}

function serializeSimpleTable(table: Element): string {
  let html = '<table>\n';
  const sthead = table.querySelector(':scope > sthead');
  if (sthead) {
    html += '<thead><tr>' + Array.from(sthead.children)
      .filter(c => c.tagName.toLowerCase() === 'stentry')
      .map(e => `<th>${serializeInlineContent(e)}</th>`)
      .join('') + '</tr></thead>\n';
  }
  html += '<tbody>\n';
  for (const row of Array.from(table.children).filter(c => c.tagName.toLowerCase() === 'strow')) {
    html += '<tr>' + Array.from(row.children)
      .filter(c => c.tagName.toLowerCase() === 'stentry')
      .map(e => `<td>${serializeInlineContent(e)}</td>`)
      .join('') + '</tr>\n';
  }
  html += '</tbody>\n</table>\n';
  return html;
}

function serializeChoiceTable(ct: Element): string {
  let html = '<table class="choicetable">\n';
  const header = ct.querySelector(':scope > chhead');
  if (header) {
    const optHdr = header.querySelector('choptionhd');
    const descHdr = header.querySelector('chdeschd');
    html += `<thead><tr><th>${optHdr ? serializeInlineContent(optHdr) : 'Option'}</th><th>${descHdr ? serializeInlineContent(descHdr) : 'Description'}</th></tr></thead>\n`;
  }
  html += '<tbody>\n';
  for (const row of Array.from(ct.children).filter(c => c.tagName.toLowerCase() === 'chrow')) {
    const opt = row.querySelector('choption');
    const desc = row.querySelector('chdesc');
    html += `<tr><td>${opt ? serializeInlineContent(opt) : ''}</td><td>${desc ? serializeInlineContent(desc) : ''}</td></tr>\n`;
  }
  html += '</tbody>\n</table>\n';
  return html;
}

function serializeChildren(node: Element, sectionDepth: number): string {
  let html = '';
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = (child.textContent ?? '').trim();
      if (text) html += escapeHtml(text);
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      html += serializeNode(child as Element, sectionDepth);
    }
  }
  return html;
}

// ── Utilities ────────────────────────────────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const NOTE_LABELS: Record<string, string> = {
  note: 'Note',
  warning: 'Warning',
  caution: 'Caution',
  danger: 'Danger',
  tip: 'Tip',
  important: 'Important',
  remember: 'Remember',
  restriction: 'Restriction',
  attention: 'Attention',
  fastpath: 'Fast path',
  other: 'Note',
};

// ── Print CSS ────────────────────────────────────────────────────────────────

const PRINT_CSS = `
  *, *::before, *::after { box-sizing: border-box; }
  @page {
    size: A4;
    margin: 2cm 2.2cm 2.5cm 2.2cm;
    @bottom-center {
      content: counter(page) " / " counter(pages);
      font-size: 9pt;
      color: #777;
    }
  }
  body {
    font-family: 'Inter', sans-serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #111;
    background: #fff;
    margin: 0;
    padding: 0;
  }
  h1 { font-size: 22pt; margin: 0 0 6pt; border-bottom: 1.5pt solid #111; padding-bottom: 4pt; }
  h2 { font-size: 14pt; margin: 18pt 0 6pt; }
  h3 { font-size: 12pt; margin: 14pt 0 4pt; }
  h4, h5, h6 { font-size: 11pt; margin: 10pt 0 4pt; }
  p.shortdesc { font-size: 11pt; color: #444; font-style: italic; margin: 0 0 14pt; }
  p { margin: 0 0 8pt; }
  a { color: #0369a1; text-decoration: underline; }
  code, kbd, .filepath {
    font-family: 'JetBrains Mono', Menlo, Consolas, monospace;
    font-size: 9.5pt;
    background: #f5f5f5;
    padding: 1px 3px;
    border-radius: 2px;
    color: #166534;
  }
  pre {
    background: #f5f5f5;
    padding: 10pt;
    border-radius: 4px;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: 'JetBrains Mono', Menlo, Consolas, monospace;
    font-size: 9pt;
    line-height: 1.4;
    margin: 0 0 10pt;
    border: 1px solid #e0e0e0;
  }
  pre code { background: none; padding: 0; color: inherit; font-size: inherit; }
  kbd { border: 1px solid #ccc; }
  ul, ol { margin: 0 0 8pt; padding-left: 22pt; }
  li { margin-bottom: 4pt; }
  ol.steps { padding-left: 22pt; }
  ol.steps > li { margin-bottom: 6pt; }
  ol.substeps { margin-top: 4pt; list-style-type: lower-alpha; }
  ul.sl { list-style-type: none; padding-left: 0; }
  ul.sl li::before { content: "\\2013\\00A0"; }
  .cmd { font-weight: 600; }
  .info { margin-top: 4pt; padding-left: 8pt; border-left: 2px solid #ccc; }
  .stepxmp { margin-top: 4pt; }
  .stepsection { font-style: italic; color: #555; margin: 6pt 0; }
  .note {
    padding: 8pt 10pt;
    margin: 10pt 0;
    border-left: 4pt solid #888;
    background: #fafafa;
    border-radius: 0 4px 4px 0;
  }
  .note-label {
    font-weight: 700;
    text-transform: uppercase;
    font-size: 9pt;
    letter-spacing: 0.04em;
    margin-right: 4pt;
  }
  .note-warning  { border-left-color: #d97706; background: #fffbeb; }
  .note-caution  { border-left-color: #ea580c; background: #fff7ed; }
  .note-danger   { border-left-color: #dc2626; background: #fef2f2; }
  .note-tip      { border-left-color: #16a34a; background: #f0fdf4; }
  .note-important, .note-attention, .note-restriction { border-left-color: #0369a1; background: #eff6ff; }
  .block-label {
    display: block;
    font-size: 8.5pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #555;
    margin-bottom: 4pt;
  }
  .prereq  { border-left: 3pt solid #3b82f6; padding-left: 10pt; margin: 10pt 0; }
  .context { border-left: 3pt solid #8b5cf6; padding-left: 10pt; margin: 10pt 0; }
  .result  { border-left: 3pt solid #10b981; padding-left: 10pt; margin: 10pt 0; }
  .postreq { border-left: 3pt solid #ec4899; padding-left: 10pt; margin: 10pt 0; }
  .example { border-left: 3pt solid #6b7280; padding-left: 10pt; margin: 10pt 0; }
  table { border-collapse: collapse; width: 100%; margin: 10pt 0; font-size: 10pt; }
  th, td { border: 1px solid #ccc; padding: 5pt 8pt; text-align: left; vertical-align: top; }
  th { background: #f0f0f0; font-weight: 600; }
  table.choicetable { width: auto; min-width: 50%; }
  img { max-width: 100%; height: auto; display: block; }
  .block-image { margin: 10pt 0; }
  .inline-image { display: inline; vertical-align: middle; max-height: 1.2em; }
  figure { margin: 10pt 0; text-align: center; }
  figcaption { font-size: 9pt; color: #555; margin-top: 4pt; }
  dl { margin: 0 0 8pt; }
  dt { font-weight: 600; margin-top: 6pt; }
  dd { margin-left: 20pt; }
  .fn { font-size: 8.5pt; color: #555; }
  pre, .note, table { page-break-inside: avoid; }
  h1, h2, h3, h4 { page-break-after: avoid; }
`;

// ── Main exports ─────────────────────────────────────────────────────────────

/**
 * Converts a DITA XML string to a complete, self-contained HTML document
 * optimised for printing / Save as PDF.
 */
export function generatePrintHtml(xmlContent: string, docTitle: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlContent, 'text/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    return buildHtmlDocument(
      docTitle,
      `<article><h1>${escapeHtml(docTitle)}</h1><p class="shortdesc" style="color:#c00">Unable to parse XML — showing raw source.</p><pre><code>${escapeHtml(xmlContent)}</code></pre></article>`,
    );
  }

  const root = doc.documentElement;
  const body = serializeNode(root, 0);
  return buildHtmlDocument(docTitle, body);
}

function buildHtmlDocument(title: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>${PRINT_CSS}</style>
</head>
<body>
${body}
</body>
</html>`;
}

/**
 * Derives a human-readable document title from a Tab's file metadata.
 */
export function derivePrintTitle(
  localFileName: string | null,
  herettoFileName: string | null | undefined,
): string {
  const raw = localFileName ?? herettoFileName ?? null;
  if (!raw) return 'DITA Topic';
  return raw.replace(/\.(dita|xml|ditamap)$/i, '');
}
