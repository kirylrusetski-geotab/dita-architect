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
}

// Factory to create a per-editor-instance map.
export const createNodeOriginMap = () => new Map<string, NodeOrigin>();

export type NodeOriginMapType = Map<string, NodeOrigin>;
