export interface Message {
  role: 'user' | 'model';
  text: string;
  isError?: boolean;
}

export interface ChatState {
  messages: Message[];
  isLoading: boolean;
}

export enum EditorMode {
  RICH_TEXT = 'RICH_TEXT',
  XML_PREVIEW = 'XML_PREVIEW'
}

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

export interface DitaFile {
  id: string;
  fileName: string; // e.g., "getting-started.dita"
  content: string; // The raw XML
  lastModified: string;
}

export interface Project {
  id: string;
  name: string;
  files: DitaFile[];
  createdAt: string;
}