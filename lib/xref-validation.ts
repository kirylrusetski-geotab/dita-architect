// BUG-38: a keyref/conkeyref/conref <xref> is valid DITA with no href — the
// key resolves it at publish time — and common in real Heretto content
// (`concept/hos-status-page.dita` has five). Shared by the Monaco
// regex-based scanner (MonacoDitaEditor's xref href check) and the visual
// editor's red-underline check (XrefValidationPlugin), so the rule cannot
// drift between the two places it is enforced.
export const REF_ATTRS = ['keyref', 'conkeyref', 'conref'] as const;

const REF_ATTR_RE = new RegExp(`\\b(?:${REF_ATTRS.join('|')})\\s*=`);
const HREF_RE = /href\s*=\s*["']([^"']*)["']/;

/**
 * True when a raw `<xref ...>` (or self-closed `<xref ... />`) start tag
 * should be flagged as having an empty or missing href — i.e. it carries
 * none of REF_ATTRS and its href attribute is absent or blank.
 */
export const isBrokenXrefTag = (tag: string): boolean => {
  if (REF_ATTR_RE.test(tag)) return false;
  const hrefAttr = tag.match(HREF_RE);
  return !hrefAttr || !hrefAttr[1].trim();
};
