import type { LucideIcon } from 'lucide-react';
import { Code, FileText, Cloud, BookOpen, Filter, Link, Sparkles, Files, Search, Network, GitBranch } from 'lucide-react';
import type { PanelId, ViewId } from '../../lib/workbench-layout';

/**
 * ADR-017: what each rail icon and each activity-bar view is called and, for
 * the placeholders, which release fills it. One table so the rail, the View ▸
 * Panels menu, the placeholder panels and the tests read the same names.
 */
export interface PanelMeta {
  id: PanelId;
  title: string;
  icon: LucideIcon;
  /** The release that fills the panel; absent for one that ships in v1.1.0. */
  arrives?: string;
  /** The placeholder's one-paragraph description of what the panel will hold. */
  blurb?: string;
}

export const PANEL_META: Record<PanelId, PanelMeta> = {
  xml: { id: 'xml', title: 'XML', icon: Code },
  topic: {
    id: 'topic', title: 'Topic', icon: FileText, arrives: 'v1.4.0',
    blurb: 'The document\'s own identity as a form: id, topic type, title, short description, xml:lang and the root element\'s attributes. Every edit is a byte-exact splice of the named element or attribute.',
  },
  heretto: {
    id: 'heretto', title: 'Heretto', icon: Cloud, arrives: 'v1.4.0',
    blurb: 'The file\'s Heretto metadata: status, Product, custom fields, Add field; computed fields read-only. A backup is written before every change, because Heretto keeps no history of API writes.',
  },
  prolog: {
    id: 'prolog', title: 'Prolog', icon: BookOpen, arrives: 'v1.4.0',
    blurb: 'The <prolog> as a form: author, critdates, keywords, audience, prodinfo, othermeta. Byte-exact outside the edited element.',
  },
  conditions: {
    id: 'conditions', title: 'Conditions', icon: Filter, arrives: 'v1.4.0',
    blurb: 'Conditional-processing attributes (audience, platform, product, otherprops) on the root and on the element at the caret, including ai-authored with Mark as reviewed.',
  },
  links: {
    id: 'links', title: 'Links', icon: Link, arrives: 'v1.4.0',
    blurb: 'Read-only: where this topic is used and what it depends on, from Heretto\'s links endpoints.',
  },
  ai: {
    id: 'ai', title: 'AI', icon: Sparkles, arrives: 'v1.6.0',
    blurb: 'The AI-authored runs in this topic, each with its session, time, and Accept, Reject or Mark as reviewed. Fills in with Session editors.',
  },
};

export interface ViewMeta {
  id: ViewId;
  title: string;
  icon: LucideIcon;
  /** `⌘1`–`⌘4` in the cheat sheet and the View menu. */
  shortcut: string;
  arrives?: string;
  blurb?: string;
}

export const VIEW_META: Record<ViewId, ViewMeta> = {
  explorer: { id: 'explorer', title: 'Explorer', icon: Files, shortcut: '⌘1' },
  search: {
    id: 'search', title: 'Search', icon: Search, shortcut: '⌘2', arrives: 'v1.2.0',
    blurb: 'Heretto search moves here in Session 2. Until then, Open from Heretto in the Explorer\'s menu keeps the filename search in its dialog.',
  },
  map: {
    id: 'map', title: 'Map', icon: Network, shortcut: '⌘3', arrives: 'v1.2.0',
    blurb: 'The connected map\'s topicref tree and its keys arrive in Session 2. Connect a Map is in the File menu and the Explorer\'s menu.',
  },
  scm: {
    id: 'scm', title: 'Source Control', icon: GitBranch, shortcut: '⌘4', arrives: 'v1.5.0',
    blurb: 'A local version history with Heretto as the remote arrives in Session 5: Changes, Outgoing, Incoming, Proposed, Commit, Push, Pull and Sync.',
  },
};
