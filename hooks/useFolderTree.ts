import { useCallback, useEffect, useRef, useState } from 'react';
import { herettoFolderCache } from '../constants/heretto';
import { parseHerettoFolder } from '../lib/heretto-utils';
import type { HerettoItem } from '../types/heretto';

export type FolderChildren = { status: 'loading' } | { status: 'error' } | { status: 'ready'; items: HerettoItem[] };

export interface FolderTreeRow {
  item: HerettoItem;
  depth: number;
  /** The folder UUIDs above this row, root first (the root itself included). */
  ancestorUuids: string[];
  /** The folder names above this row, the root's name excluded (how `herettoFile.path` is spelled). */
  ancestorNames: string[];
  expanded: boolean;
  children?: FolderChildren;
}

const FETCH_TIMEOUT_MS = 15_000;

/**
 * ADR-017 decision 5 / W5: the Explorer's lazy folder tree. A folder is listed
 * on its first expand only, through `herettoFolderCache` (shared with the
 * browser modal, the path resolver and the image resolver, five-minute TTL), so
 * a tree with one expanded ten-deep path makes exactly eleven requests. The
 * root is expanded at mount. Nothing here touches tab state.
 */
export function useFolderTree(rootUuid: string, rootName = 'Heretto') {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(rootUuid ? [rootUuid] : []));
  const [children, setChildren] = useState<Map<string, FolderChildren>>(() => new Map());
  const inFlight = useRef<Set<string>>(new Set());

  const load = useCallback(async (uuid: string, force = false) => {
    if (!uuid) return;
    if (!force && herettoFolderCache.has(uuid)) {
      const items = herettoFolderCache.get(uuid)!;
      setChildren(prev => new Map(prev).set(uuid, { status: 'ready', items }));
      return;
    }
    if (inFlight.current.has(uuid)) return;
    inFlight.current.add(uuid);
    setChildren(prev => new Map(prev).set(uuid, { status: 'loading' }));
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
      const res = await fetch(`/heretto-api/all-files/${uuid}`, { signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const items = parseHerettoFolder(await res.text());
      herettoFolderCache.set(uuid, items);
      setChildren(prev => new Map(prev).set(uuid, { status: 'ready', items }));
    } catch {
      setChildren(prev => new Map(prev).set(uuid, { status: 'error' }));
    } finally {
      inFlight.current.delete(uuid);
    }
  }, []);

  // The root lists itself at mount and whenever the root changes (a new ~/heretto.json).
  useEffect(() => {
    if (!rootUuid) return;
    setExpanded(new Set([rootUuid]));
    setChildren(new Map());
    void load(rootUuid);
  }, [rootUuid, load]);

  // Refs mirror the two states so `toggle` can read them without re-creating itself.
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;
  const childrenRef = useRef(children);
  childrenRef.current = children;

  const toggle = useCallback((uuid: string) => {
    const wasExpanded = expandedRef.current.has(uuid);
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
    // Fetch on first expand only: a listing already held (or in flight) is reused.
    if (!wasExpanded && !childrenRef.current.has(uuid)) void load(uuid);
  }, [load]);

  const retry = useCallback((uuid: string) => { void load(uuid, true); }, [load]);

  /** The visible rows, depth-first, in Heretto's listing order (folders then files, as the API lists them). */
  const rows: FolderTreeRow[] = [];
  const walk = (uuid: string, name: string, depth: number, ancestorUuids: string[], ancestorNames: string[]) => {
    const isOpen = expanded.has(uuid);
    const kids = children.get(uuid);
    rows.push({ item: { uuid, name, type: 'folder' }, depth, ancestorUuids, ancestorNames, expanded: isOpen, children: kids });
    if (!isOpen || !kids || kids.status !== 'ready') return;
    const nextUuids = [...ancestorUuids, uuid];
    const nextNames = depth === 0 ? ancestorNames : [...ancestorNames, name];
    for (const item of kids.items) {
      if (item.type === 'folder') walk(item.uuid, item.name, depth + 1, nextUuids, nextNames);
      else rows.push({ item, depth: depth + 1, ancestorUuids: nextUuids, ancestorNames: nextNames, expanded: false });
    }
  };
  if (rootUuid) walk(rootUuid, rootName, 0, [], []);

  return { rows, toggle, retry, expanded };
}
