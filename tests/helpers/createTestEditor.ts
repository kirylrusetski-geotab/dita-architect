// Shared test editor factory (FR-047).
//
// Imports the PRODUCTION node registry so test editors can never drift from
// the app's — previously 16 hand-rolled node lists omitted TrackedDeletionNode
// and ValidationDecoratorNode (making the Edit Mode serialization path
// unrepresentable in round-trip tests) and several omitted DitaInfoPreviewNode.
import { createEditor } from 'lexical';
import { EDITOR_NODES } from '../../constants/editor-nodes';
import { parseXmlToLexical } from '../../sync/parseXmlToLexical';
import { serializeLexicalToXml, createXmlMetaCache } from '../../sync/serializeLexicalToXml';
import { createNodeOriginMap } from '../../sync/nodeOriginMap';

export function createTestEditor() {
  // onError MUST rethrow: Lexical's default is console.error, which silently
  // swallows assertion failures thrown inside editor.update() — tests would
  // pass vacuously (discovered in FR-046 Phase 1).
  return createEditor({
    nodes: EDITOR_NODES,
    onError: (error: Error) => {
      throw error;
    },
  });
}

/** Parse XML into a fresh editor and serialize straight back out — the
 *  canonical unedited round-trip used by the byte-stability corpus. */
export function roundTrip(xml: string): string {
  const editor = createTestEditor();
  const originMap = createNodeOriginMap();
  const cache = createXmlMetaCache();
  parseXmlToLexical(xml, editor, originMap, true);
  return serializeLexicalToXml(editor.getEditorState(), xml, originMap, cache);
}
