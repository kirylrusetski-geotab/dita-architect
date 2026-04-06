export type DitaBlockType = 'title' | 'shortdesc' | 'paragraph' | 'note' | 'ordered-list' | 'unordered-list' | 'codeblock' | 'unknown' | 'section-title' | 'context' | 'result' | 'prereq' | 'steps';

export interface DitaStep {
  cmd: string;
  info?: string;
  substeps?: string[];
}

export interface DitaBlock {
  type: DitaBlockType;
  content?: string;
  noteType?: string;
  items?: string[];
  steps?: DitaStep[];
  rawXml?: string;
}