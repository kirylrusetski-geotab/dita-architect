// FR-046 — marks-as-data tracked changes: shared model types.
//
// A TrackedMark is the durable, identity-bearing payload carried by every
// TrackedTextNode. Changes are grouped by changeId — never by Lexical node
// keys, which churn on structural edits (the BUG-02 failure class).

export type TrackedKind = 'insert' | 'delete' | 'split';

export interface TrackedMark {
  changeId: string;
  kind: TrackedKind;
  author: string;
  /** ISO timestamp — stamped once per change (gesture), not per keystroke. */
  date: string;
}

/** A logical change derived by scanning the tree — see lib/tracked-changes/scan.ts. */
export interface Change {
  changeId: string;
  kind: TrackedKind;
  /** Concatenated text of every node carrying this changeId, in document order. */
  text: string;
  author: string;
  date: string;
  /** Key of the first node in document order — for scroll-into-view anchoring only. */
  firstNodeKey: string;
}

// ADR-015 decision 7: the author written into Heretto's suggestion PIs is
// the Heretto account email, set when the credentials load. 'You' is the
// fallback for a session that never connected (a save then cannot reach
// Heretto anyway). Own-ness (merging into / retracting an own suggestion)
// compares against the same value, so a suggestion carried back from Heretto
// by the same account is still yours after a reopen.
let currentAuthor = 'You';

export function sessionAuthor(): string {
  return currentAuthor;
}

export function setSessionAuthor(author: string): void {
  currentAuthor = author.trim() || 'You';
}

export function newChangeId(): string {
  return crypto.randomUUID();
}

/** Merge predicate: two marks belong to the same visual run when kind and author match. */
export function sameChange(a: TrackedMark, b: TrackedMark): boolean {
  return a.kind === b.kind && a.author === b.author;
}

export function newMark(kind: TrackedKind): TrackedMark {
  return {
    changeId: newChangeId(),
    kind,
    author: sessionAuthor(),
    date: new Date().toISOString(),
  };
}
