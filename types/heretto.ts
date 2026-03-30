export interface HerettoFile {
  uuid: string;
  name: string;
  path: string;
  parentFolderUuid?: string;
  ancestorUuids?: string[];
}

export interface HerettoItem {
  uuid: string;
  name: string;
  type: 'folder' | 'file';
}

export interface HerettoSearchResult extends HerettoItem {
  path: string;
}

export type HerettoSearchStatus =
  | { phase: 'idle' }
  | { phase: 'searching'; foldersVisited: number; foldersTotal: number; foldersFailed: number }
  | { phase: 'done'; foldersVisited: number; foldersFailed: number }
  | { phase: 'cancelled'; foldersVisited: number };

// `verified` and `unrecognizedElements` are only meaningful in the 'results'
// phase. They are absent on 'downloading' / 'verifying' — consumer code must
// narrow on `phase` before reading them.
export type ImportVerificationState =
  | {
      phase: 'downloading' | 'verifying';
      item: HerettoItem;
      pathStr: string;
      firstContent: string;
      breadcrumbs: { uuid: string; name: string }[];
    }
  | {
      phase: 'results';
      item: HerettoItem;
      pathStr: string;
      firstContent: string;
      breadcrumbs: { uuid: string; name: string }[];
      verified: boolean;
      unrecognizedElements: string[];
    };
