// Maps Lexical node keys to their original DITA element identity
// so the DOM-patching serializer can locate the right element to update.
export interface NodeOrigin {
  tag: string;        // 'p' | 'note' | 'shortdesc' | 'prereq' | 'table' | etc.
  bodyIndex: number;  // position among direct body children (-1 = title, -2 = shortdesc)
  noteType?: string;  // 'WARNING' | 'CAUTION' | 'TIP' | 'DANGER' | 'NOTE' (for <note> elements)
}

// Factory to create a per-editor-instance map.
export const createNodeOriginMap = () => new Map<string, NodeOrigin>();

export type NodeOriginMapType = Map<string, NodeOrigin>;
