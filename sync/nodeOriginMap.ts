// Maps Lexical node keys to their original DITA element identity
// so the DOM-patching serializer can locate the right element to update.
export interface NodeOrigin {
  tag: string;        // 'p' | 'note' | 'shortdesc' | 'prereq' | 'table' | etc.
  bodyIndex: number;  // position among direct body children (-1 = title, -2 = shortdesc)
  noteType?: string;  // 'WARNING' | 'CAUTION' | 'TIP' | 'DANGER' | 'NOTE' (for <note> elements)
  // For TextNodes parsed from DITA inline elements (e.g. <uicontrol>, <wintitle>),
  // remembers the source tag so accept-path serialization can re-emit it instead
  // of falling back to <b>/<i> based on the bold/italic format flag alone.
  inlineTag?: string;
  inlineAttrs?: Record<string, string>;
  // XML id attribute of the source element. Used by the API replaceId flow
  // to locate a Lexical node from a DITA element id.
  xmlId?: string;
  // Definition-list membership. A <dl> flattens to a run of body-level nodes
  // (one <dt> paragraph + the <dd>'s block children, repeated per <dlentry>).
  // dlEntryIndex marks which <dlentry> a node belongs to so the serializer can
  // re-group the run and patch the preserved <dl>/<dlentry> skeleton in place.
  // It is merged onto a node's existing origin, so nested blocks inside a <dd>
  // (e.g. a <note> or <table>) keep their own tag/noteType identity.
  dlEntryIndex?: number;  // index of the <dlentry> within the <dl>
  ddFirst?: boolean;      // marks the first node produced from a <dd>
  // Troubleshooting-topic container membership (ADR-009). <troublebody> nests
  // its content in section-class containers (<condition>, <cause>, <remedy>),
  // a bodydiv wrapper (<troubleSolution>), and <steps-informal>. Each is
  // flattened to body-level Lexical nodes; containerPath records the chain of
  // enclosing containers as "tag#ordinal" segments joined by "/", e.g.
  // "troubleSolution#1/remedy#0". The serializer groups consecutive nodes by
  // path and patches the preserved container elements in place. Merged onto
  // the node's existing origin like dlEntryIndex.
  containerPath?: string;
  // A <p> that wraps block children (Heretto authors <p>text<ul>…</ul></p>)
  // flattens to a run of nodes: the inline runs as paragraphs, the blocks as
  // themselves. pWrapperId ties the run back to its source <p> so the
  // serializer patches the wrapper in place instead of splitting it into
  // <p>text</p><ul/> and dropping its attributes (BUG-25). Unique per parse.
  pWrapperId?: number;
}

// Factory to create a per-editor-instance map.
export const createNodeOriginMap = () => new Map<string, NodeOrigin>();

export type NodeOriginMapType = Map<string, NodeOrigin>;
