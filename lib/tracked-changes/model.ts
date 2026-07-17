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

/**
 * The session author. Single-maintainer app with no auth — a constant is
 * honest. The TrackedMark shape (author/date/changeId) is already what the
 * future ezd-review PI carrier would serialize, so multi-author support is a
 * data question, not a model change.
 */
export const SESSION_AUTHOR = 'You';

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
    author: SESSION_AUTHOR,
    date: new Date().toISOString(),
  };
}
