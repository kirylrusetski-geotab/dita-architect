import { useState, useEffect, useRef, useCallback } from 'react';
import type { Tab } from '../types/tab';
import { createTab } from '../types/tab';
import type { HerettoItem, HerettoSearchResult, HerettoSearchStatus, ImportVerificationState } from '../types/heretto';
import { HERETTO_ROOT_UUID, herettoFolderCache } from '../constants/heretto';
import { parseHerettoFolder, getFolderName } from '../lib/heretto-utils';
import { escapeXml, getTitleFromXml, slugifyToFilename, slugifyToId, withUpdatedTopicId, findUnrecognizedElements, compareXml, stripHerettoClassAttrs } from '../lib/xml-utils';
import { formatXml } from '../lib/xml-utils';
import { toast } from 'sonner';

const FETCH_TIMEOUT_MS = 30_000;
const withTimeout = (signal?: AbortSignal): AbortSignal =>
  signal
    ? AbortSignal.any([signal, AbortSignal.timeout(FETCH_TIMEOUT_MS)])
    : AbortSignal.timeout(FETCH_TIMEOUT_MS);

interface UseHerettoCmsParams {
  activeTab: Tab;
  tabs: Tab[];
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
  setActiveTabId: React.Dispatch<React.SetStateAction<string>>;
  setConfirmModal: React.Dispatch<React.SetStateAction<{ message: string; onConfirm: () => void } | null>>;
}

export function useHerettoCms({
  activeTab,
  tabs,
  setTabs,
  setActiveTabId,
  setConfirmModal,
}: UseHerettoCmsParams) {
  // --- Heretto Status modal ---
  const [isHerettoStatusOpen, setIsHerettoStatusOpen] = useState(false);
  const [herettoCredentials, setHerettoCredentials] = useState({ host: '', email: '', token: '' });
  const [herettoStatusChecking, setHerettoStatusChecking] = useState(false);

  // --- Heretto CMS state (shared across tabs) ---
  const [isHerettoBrowserOpen, setIsHerettoBrowserOpen] = useState(false);
  const [herettoBrowserMode, setHerettoBrowserMode] = useState<'open' | 'save' | 'replace'>('open');
  const [herettoConnected, setHerettoConnected] = useState(false);
  const [herettoBrowsing, setHerettoBrowsing] = useState(false);
  const [herettoBreadcrumbs, setHerettoBreadcrumbs] = useState<{ uuid: string; name: string }[]>([]);
  const [herettoItems, setHerettoItems] = useState<HerettoItem[]>([]);
  const [herettoSelected, setHerettoSelected] = useState<HerettoItem | HerettoSearchResult | null>(null);
  const [herettoSaving, setHerettoSaving] = useState(false);
  const [herettoSaveProgress, setHerettoSaveProgress] = useState<'idle' | 'saving' | 'verifying' | 'complete'>('idle');
  const [isHerettoDropdownOpen, setIsHerettoDropdownOpen] = useState(false);
  const herettoDropdownRef = useRef<HTMLDivElement>(null);
  const [herettoSaveFileName, setHerettoSaveFileName] = useState('');
  const [herettoRefreshing, setHerettoRefreshing] = useState(false);
  // P2-25: session-only memory of the last successfully saved folder location
  const lastSavedBreadcrumbsRef = useRef<{ uuid: string; name: string }[] | null>(null);
  const [herettoAtLastSavedLocation, setHerettoAtLastSavedLocation] = useState(false);

  // --- Abort refs for in-flight save/refresh to prevent race conditions ---
  const herettoSaveAbortRef = useRef<AbortController | null>(null);
  const herettoRefreshAbortRef = useRef<AbortController | null>(null);

  // --- Heretto search state ---
  const [herettoSearchQuery, setHerettoSearchQuery] = useState('');
  const [herettoSearchResults, setHerettoSearchResults] = useState<HerettoSearchResult[]>([]);
  const [herettoSearchStatus, setHerettoSearchStatus] = useState<HerettoSearchStatus>({ phase: 'idle' });
  const herettoSearchAbortRef = useRef<AbortController | null>(null);
  const herettoSearchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Import verification modal state ---
  const [importVerification, setImportVerification] =
    useState<ImportVerificationState | null>(null);
  const importAbortRef = useRef<AbortController | null>(null);

  // Check Heretto connectivity on mount — abort on unmount to avoid state updates after cleanup
  useEffect(() => {
    const abort = new AbortController();
    fetch(`/heretto-api/all-files/${HERETTO_ROOT_UUID}`, { signal: withTimeout(abort.signal) })
      .then(res => {
        if (res.ok && res.headers.get('content-type')?.includes('xml')) setHerettoConnected(true);
      })
      .catch(() => {});
    return () => { abort.abort(); };
  }, []);

  const openHerettoStatus = useCallback(async () => {
    setIsHerettoStatusOpen(true);
    try {
      const res = await fetch('/heretto-credentials', { signal: withTimeout() });
      if (res.ok) {
        const data = await res.json();
        // Token is never returned by the server; leave blank so the user must re-enter to save.
        setHerettoCredentials({ host: data.host || '', email: data.email || '', token: '' });
      }
    } catch { /* silent */ }
  }, []);

  const testHerettoConnection = useCallback(async () => {
    setHerettoStatusChecking(true);
    try {
      const res = await fetch(`/heretto-api/all-files/${HERETTO_ROOT_UUID}`, { signal: withTimeout() });
      setHerettoConnected(res.ok && !!res.headers.get('content-type')?.includes('xml'));
    } catch {
      setHerettoConnected(false);
    } finally {
      setHerettoStatusChecking(false);
    }
  }, []);

  const saveHerettoCredentials = useCallback(async () => {
    setHerettoStatusChecking(true);
    try {
      const res = await fetch('/heretto-credentials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(herettoCredentials),
        signal: withTimeout(),
      });
      if (!res.ok) throw new Error();
      // Test connection with new credentials
      const testRes = await fetch(`/heretto-api/all-files/${HERETTO_ROOT_UUID}`, { signal: withTimeout() });
      const testConnected = testRes.ok && !!testRes.headers.get('content-type')?.includes('xml');
      setHerettoConnected(testConnected);
      if (testConnected) {
        toast.success('Credentials saved and connection verified');
      } else {
        toast.warning('Credentials saved but connection failed — check your Heretto host, email and token');
      }
    } catch {
      toast.error('Failed to save credentials');
    } finally {
      setHerettoStatusChecking(false);
    }
  }, [herettoCredentials]);

  // Track unsaved Heretto changes (per-tab)
  useEffect(() => {
    if (!activeTab) return;
    if (!activeTab.herettoFile) {
      if (activeTab.herettoDirty) setTabs(prev => prev.map(t => t.id === activeTab.id ? { ...t, herettoDirty: false } : t));
      return;
    }
    const dirty = activeTab.xmlContent !== activeTab.savedXmlRef.current;
    if (dirty !== activeTab.herettoDirty) setTabs(prev => prev.map(t => t.id === activeTab.id ? { ...t, herettoDirty: dirty } : t));
  }, [activeTab?.xmlContent, activeTab?.herettoFile, activeTab?.id, setTabs]);

  // Poll for remote changes on Heretto (per-tab) with exponential backoff
  const pollFailCountRef = useRef(0);
  useEffect(() => {
    if (!activeTab?.herettoFile) return;
    const tabId = activeTab.id;
    const file = activeTab.herettoFile;
    pollFailCountRef.current = 0;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    const BASE_INTERVAL = 30_000;
    const MAX_INTERVAL = 5 * 60_000; // 5 minutes cap

    const schedule = () => {
      const fails = pollFailCountRef.current;
      // Exponential backoff: 30s, 60s, 120s, 240s, capped at 5min
      const backoff = Math.min(BASE_INTERVAL * Math.pow(2, fails), MAX_INTERVAL);
      // Add jitter: ±25% to avoid thundering herd
      const jitter = backoff * (0.75 + Math.random() * 0.5);
      timer = setTimeout(poll, jitter);
    };

    const poll = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`/heretto-api/all-files/${file.uuid}/content`, { signal: withTimeout() });
        if (cancelled) return;
        if (!res.ok) {
          pollFailCountRef.current++;
          if (pollFailCountRef.current === 3) {
            toast.error(res.status === 401 || res.status === 403
              ? 'Heretto credentials may have expired — reconnect in Heretto Status'
              : `Heretto sync check failing (HTTP ${res.status})`);
          }
          schedule();
          return;
        }
        if (!res.headers.get('content-type')?.includes('application/xml')) {
          pollFailCountRef.current++;
          schedule();
          return;
        }
        pollFailCountRef.current = 0;
        const remote = await res.text();
        setTabs(prev => prev.map(t => {
          if (t.id !== tabId) return t;
          const comparison = compareXml(t.savedXmlRef.current, remote);
          return { ...t, herettoRemoteChanged: comparison === 'different' };
        }));
      } catch {
        if (cancelled) return;
        pollFailCountRef.current++;
        if (pollFailCountRef.current === 3) {
          toast.error('Cannot reach Heretto — check your network connection');
        }
      }
      if (!cancelled) schedule();
    };

    schedule();
    return () => { cancelled = true; clearTimeout(timer); };
  }, [activeTab?.herettoFile?.uuid, activeTab?.id, setTabs]);

  const herettoNavigate = useCallback(async (uuid: string, name: string, resetBreadcrumbs?: boolean) => {
    setHerettoBrowsing(true);
    setHerettoSelected(null);
    try {
      const res = await fetch(`/heretto-api/all-files/${uuid}`, { signal: withTimeout() });
      if (!res.ok) throw new Error('Failed to fetch folder');
      const xml = await res.text();
      const items = parseHerettoFolder(xml);
      setHerettoItems(items);

      if (resetBreadcrumbs) {
        const folderName = getFolderName(xml) || name;
        setHerettoBreadcrumbs([{ uuid, name: folderName }]);
      } else {
        setHerettoBreadcrumbs(prev => [...prev, { uuid, name }]);
      }
    } catch {
      toast.error('Failed to browse Heretto folder');
    } finally {
      setHerettoBrowsing(false);
    }
  }, []);

  const herettoSearch = useCallback(async (query: string, rootUuid: string, signal: AbortSignal) => {
    const lowerQuery = query.toLowerCase().replace(/[\s_-]+/g, ' ').trim();
    const results: HerettoSearchResult[] = [];
    const queue: [string, string[], string[]][] = [[rootUuid, [], [rootUuid]]];
    let foldersVisited = 0;
    let foldersTotal = 1;
    let foldersFailed = 0;

    setHerettoSearchResults([]);
    setHerettoSearchStatus({ phase: 'searching', foldersVisited: 0, foldersTotal: 1, foldersFailed: 0 });

    while (queue.length > 0) {
      if (signal.aborted) return;

      const batch = queue.splice(0, Math.min(5, queue.length));
      const batchPromises = batch.map(async ([uuid, pathSegments, uuidChain]) => {
        if (signal.aborted) return { matched: [] as HerettoSearchResult[], subfolders: [] as [string, string[], string[]][], failed: false };

        let items: HerettoItem[];
        if (herettoFolderCache.has(uuid)) {
          items = herettoFolderCache.get(uuid)!;
        } else {
          try {
            const res = await fetch(`/heretto-api/all-files/${uuid}`, { signal: withTimeout(signal) });
            if (!res.ok) return { matched: [] as HerettoSearchResult[], subfolders: [] as [string, string[], string[]][], failed: true };
            const xml = await res.text();
            items = parseHerettoFolder(xml);
            herettoFolderCache.set(uuid, items);
          } catch {
            return { matched: [] as HerettoSearchResult[], subfolders: [] as [string, string[], string[]][], failed: true };
          }
        }

        const matched: HerettoSearchResult[] = [];
        const subfolders: [string, string[], string[]][] = [];

        for (const item of items) {
          if (item.type === 'folder') {
            subfolders.push([item.uuid, [...pathSegments, item.name], [...uuidChain, item.uuid]]);
          } else if (item.name.toLowerCase().replace(/[\s_-]+/g, ' ').includes(lowerQuery)) {
            matched.push({
              ...item,
              path: [...pathSegments, item.name].join('/'),
              ancestorUuids: uuidChain,
            });
          }
        }

        return { matched, subfolders, failed: false };
      });

      const batchResults = await Promise.all(batchPromises);
      if (signal.aborted) return;

      for (const result of batchResults) {
        if (!result) continue;
        const { matched, subfolders, failed } = result;
        if (failed) {
          foldersFailed++;
          continue;
        }
        if (matched.length > 0) {
          results.push(...matched);
          setHerettoSearchResults([...results]);
        }
        queue.push(...subfolders);
        foldersTotal += subfolders.length;
      }

      foldersVisited += batch.length;
      setHerettoSearchStatus({ phase: 'searching', foldersVisited, foldersTotal, foldersFailed });
    }

    if (!signal.aborted) {
      setHerettoSearchStatus({ phase: 'done', foldersVisited, foldersFailed });
    }
  }, []);

  // Debounced search trigger
  useEffect(() => {
    if (!isHerettoBrowserOpen) return;

    if (herettoSearchDebounceRef.current) {
      clearTimeout(herettoSearchDebounceRef.current);
    }

    if (!herettoSearchQuery.trim()) {
      herettoSearchAbortRef.current?.abort();
      setHerettoSearchResults([]);
      setHerettoSearchStatus({ phase: 'idle' });
      return;
    }

    herettoSearchDebounceRef.current = setTimeout(() => {
      herettoSearchAbortRef.current?.abort();
      const abort = new AbortController();
      herettoSearchAbortRef.current = abort;

      const searchRoot = herettoBreadcrumbs.length > 0
        ? herettoBreadcrumbs[herettoBreadcrumbs.length - 1].uuid
        : HERETTO_ROOT_UUID;

      herettoSearch(herettoSearchQuery.trim(), searchRoot, abort.signal);
    }, 350);

    return () => {
      if (herettoSearchDebounceRef.current) {
        clearTimeout(herettoSearchDebounceRef.current);
      }
    };
  }, [herettoSearchQuery, isHerettoBrowserOpen, herettoBreadcrumbs, herettoSearch]);

  // Cleanup: abort search when modal closes
  useEffect(() => {
    if (!isHerettoBrowserOpen) {
      herettoSearchAbortRef.current?.abort();
    }
  }, [isHerettoBrowserOpen]);

  const openHerettoBrowser = useCallback(async (mode: 'open' | 'save' | 'replace') => {
    setHerettoBrowserMode(mode);
    setIsHerettoBrowserOpen(true);
    setHerettoSelected(null);
    setHerettoItems([]);
    setHerettoBreadcrumbs([]);
    setHerettoSearchQuery('');
    setHerettoSearchResults([]);
    setHerettoSearchStatus({ phase: 'idle' });
    if (mode === 'save') {
      // P2-23: pre-populate filename from topic title, falling back to "topic"
      const title = getTitleFromXml(activeTab.xmlContent);
      const slug = title ? slugifyToFilename(title) : 'topic';
      setHerettoSaveFileName(`${slug}.dita`);
      // P2-25: restore last saved location if available
      if (lastSavedBreadcrumbsRef.current) {
        const saved = lastSavedBreadcrumbsRef.current;
        setHerettoAtLastSavedLocation(true);
        await herettoNavigate(saved[saved.length - 1].uuid, saved[saved.length - 1].name, true);
        setHerettoBreadcrumbs(saved);
        return;
      }
    }
    setHerettoAtLastSavedLocation(false);
    await herettoNavigate(HERETTO_ROOT_UUID, 'Content Root', true);
  }, [herettoNavigate, activeTab?.xmlContent]);

  const handleHerettoOpen = useCallback(async (item: HerettoItem | HerettoSearchResult) => {
    importAbortRef.current?.abort();
    const abort = new AbortController();
    importAbortRef.current = abort;

    const pathStr = 'path' in item && item.path
      ? item.path
      : herettoBreadcrumbs.slice(1).map(b => b.name).join('/') + '/' + item.name;

    // Search results carry their own ancestor UUID chain; normal browse uses breadcrumbs
    const breadcrumbs: { uuid: string; name: string }[] =
      'ancestorUuids' in item && item.ancestorUuids
        ? item.ancestorUuids.map((uuid, i) => {
            // path = "Folder1/Folder2/.../file.dita"; split gives folder names at indices 0..n-2
            const folders = item.path.split('/').slice(0, -1);
            return { uuid, name: i === 0 ? '' : (folders[i - 1] || '') };
          })
        : [...herettoBreadcrumbs];

    // Defensive check to ensure ancestorUuids is never empty
    if ('ancestorUuids' in item && item.ancestorUuids && !item.ancestorUuids.length) {
      console.warn('[HerettoCms] Search result has empty ancestorUuids:', item);
    }

    setIsHerettoBrowserOpen(false);
    setImportVerification({
      phase: 'downloading',
      item,
      pathStr,
      firstContent: '',
      breadcrumbs,
    });

    try {
      const res = await fetch(`/heretto-api/all-files/${item.uuid}/content`, { signal: withTimeout(abort.signal) });
      if (!res.ok) throw new Error('Failed to fetch content');
      const firstContent = await res.text();

      if (abort.signal.aborted) return;

      setImportVerification(prev => prev ? { ...prev, phase: 'verifying', firstContent } : null);

      const verifyRes = await fetch(`/heretto-api/all-files/${item.uuid}/content`, { signal: withTimeout(abort.signal) });
      if (!verifyRes.ok) throw new Error('Failed to verify content');
      const secondContent = await verifyRes.text();

      if (abort.signal.aborted) return;

      const verified = firstContent === secondContent;
      const unrecognizedElements = findUnrecognizedElements(firstContent);

      setImportVerification(prev => prev ? {
        ...prev,
        phase: 'results',
        verified,
        unrecognizedElements,
      } : null);
    } catch {
      if (abort.signal.aborted) return;
      setImportVerification(null);
      toast.error('Failed to open file from Heretto');
    }
  }, [herettoBreadcrumbs]);

  const handleImportContinue = useCallback(() => {
    if (!importVerification) return;
    const { firstContent, item, pathStr, breadcrumbs } = importVerification;

    const beautified = formatXml(firstContent);
    const newTab = createTab(beautified);
    const parentCrumb = breadcrumbs[breadcrumbs.length - 1];
    const ancestorUuids = breadcrumbs.map(b => b.uuid);

    // Defensive checks to ensure data integrity
    if (!ancestorUuids.length) {
      console.warn('[HerettoCms] ancestorUuids is empty, adding root UUID:', HERETTO_ROOT_UUID);
      ancestorUuids.push(HERETTO_ROOT_UUID);
    }
    if (!parentCrumb?.uuid) {
      console.warn('[HerettoCms] parentFolderUuid is missing, using last ancestor UUID');
    }

    newTab.herettoFile = {
      uuid: item.uuid,
      name: item.name,
      path: pathStr,
      parentFolderUuid: parentCrumb?.uuid || ancestorUuids[ancestorUuids.length - 1],
      ancestorUuids,
    };
    newTab.herettoLastSaved = new Date();
    newTab.herettoJustLoaded = true;
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setImportVerification(null);
    setTimeout(() => {
      setTabs(prev => prev.map(t => t.id === newTab.id ? { ...t, syncTrigger: t.syncTrigger + 1 } : t));
    }, 0);
    toast.success(`Opened ${item.name} from Heretto`);
  }, [importVerification, setTabs, setActiveTabId]);

  const handleHerettoSave = useCallback(async (tabId?: string) => {
    if (tabId && !tabs.find(t => t.id === tabId)) {
      throw new Error(`Tab "${tabId}" not found`);
    }
    const tab = tabId ? tabs.find(t => t.id === tabId)! : activeTab;
    if (!tab.herettoFile) {
      openHerettoBrowser('save');
      return;
    }
    const savedTabId = tab.id;
    const herettoFile = tab.herettoFile;
    const content = tab.xmlContent;

    // Abort any in-flight save to avoid concurrent overwrites
    herettoSaveAbortRef.current?.abort();
    const abort = new AbortController();
    herettoSaveAbortRef.current = abort;

    setHerettoSaving(true);
    setHerettoSaveProgress('saving');
    try {
      const res = await fetch(`/heretto-api/all-files/${herettoFile.uuid}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/xml' },
        body: content,
        signal: withTimeout(abort.signal),
      });
      if (!res.ok) {
        let errorMessage = `Failed to save (HTTP ${res.status})`;
        try {
          const errorResponse = await res.text();
          const trimmed = errorResponse.trim();
          if (trimmed) {
            // HTML response means the proxy or SPA handler intercepted the request
            if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
              errorMessage += ' — Heretto returned an unexpected response. If you just added credentials, restart the dev server and try again.';
            } else if (trimmed.includes('DTD') || trimmed.includes('validation')) {
              errorMessage += ` - DTD validation error: ${trimmed.substring(0, 200)}`;
            } else if (trimmed.includes('error') || trimmed.includes('Error')) {
              errorMessage += ` - ${trimmed.substring(0, 200)}`;
            } else {
              errorMessage += ` - ${trimmed.substring(0, 100)}`;
            }
          }
        } catch {
          // Fall back to generic error if response parsing fails
        }
        throw new Error(errorMessage);
      }

      setHerettoSaveProgress('verifying');
      const verifyRes = await fetch(`/heretto-api/all-files/${herettoFile.uuid}/content`, { signal: withTimeout(abort.signal) });
      if (!verifyRes.ok) throw new Error('Failed to verify');
      if (!verifyRes.headers.get('content-type')?.includes('application/xml')) throw new Error('Heretto returned a non-XML response during verification');
      const remote = await verifyRes.text();

      if (abort.signal.aborted) return;

      const comparison = compareXml(stripHerettoClassAttrs(content), stripHerettoClassAttrs(remote));
      setHerettoSaveProgress('complete');
      if (comparison === 'identical') {
        toast.success(`Saved and verified ${herettoFile.name}`);
      } else if (comparison === 'formatting') {
        toast.success(`Saved ${herettoFile.name} (Heretto reformatted whitespace)`);
      } else {
        toast.warning(`Saved ${herettoFile.name}, but remote content differs — verify manually`);
      }
      setHerettoSaveProgress('idle');

      // Update savedXmlRef outside the state updater to avoid mutating React state.
      // savedXmlRef is a stable ref-like object (created once per tab in createTab()),
      // so mutating .current outside the updater is safe and avoids stale-closure issues.
      tab.savedXmlRef.current = content;

      setTabs(prev => prev.map(t => {
        if (t.id !== savedTabId) return t;
        return { ...t, herettoLastSaved: new Date(), herettoRemoteChanged: false, herettoDirty: false, herettoJustLoaded: false };
      }));
    } catch (err) {
      if (abort.signal.aborted) return;
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to save to Heretto: ${message}`);
      setHerettoSaveProgress('idle');
      throw err;
    } finally {
      if (!abort.signal.aborted) setHerettoSaving(false);
    }
  }, [activeTab, tabs, openHerettoBrowser, setTabs]);

  const doHerettoRefresh = useCallback(async (tabId: string, file: { uuid: string; name: string }, savedXmlRef: { current: string }) => {
    // Abort any in-flight refresh to avoid concurrent overwrites
    herettoRefreshAbortRef.current?.abort();
    const abort = new AbortController();
    herettoRefreshAbortRef.current = abort;

    setHerettoRefreshing(true);
    try {
      const res = await fetch(`/heretto-api/all-files/${file.uuid}/content`, { signal: withTimeout(abort.signal) });
      if (!res.ok) throw new Error();
      if (!res.headers.get('content-type')?.includes('application/xml')) throw new Error('Heretto returned a non-XML response');
      const content = await res.text();
      const beautified = formatXml(content);

      if (abort.signal.aborted) return;

      // Update savedXmlRef outside the state updater to avoid mutating React state.
      savedXmlRef.current = beautified;

      setTabs(prev => prev.map(t => {
        if (t.id !== tabId) return t;
        return { ...t, xmlContent: beautified, lastUpdatedBy: 'code' as const, herettoRemoteChanged: false, herettoJustLoaded: false };
      }));
      setTimeout(() => {
        setTabs(prev => prev.map(t => t.id === tabId ? { ...t, syncTrigger: t.syncTrigger + 1 } : t));
      }, 0);
      toast.success(`Refreshed ${file.name} from Heretto`);
    } catch (err) {
      if (abort.signal.aborted) return;
      const message = err instanceof Error ? err.message : String(err);
      toast.error(`Failed to refresh from Heretto: ${message}`);
    } finally {
      if (!abort.signal.aborted) setHerettoRefreshing(false);
    }
  }, [setTabs]);

  const handleHerettoRefresh = useCallback(() => {
    const tab = activeTab;
    if (!tab.herettoFile) return;
    if (tab.herettoDirty) {
      setConfirmModal({
        message: 'You have edits that haven\'t been saved to Heretto. Refresh anyway?',
        onConfirm: () => { setConfirmModal(null); doHerettoRefresh(tab.id, tab.herettoFile!, tab.savedXmlRef); },
      });
      return;
    }
    doHerettoRefresh(tab.id, tab.herettoFile, tab.savedXmlRef);
  }, [activeTab, doHerettoRefresh, setConfirmModal]);

  const handleHerettoDisconnect = useCallback(() => {
    setTabs(prev => prev.map(t => {
      if (t.id !== activeTab.id) return t;
      return { ...t, herettoFile: null, herettoLastSaved: null, herettoRemoteChanged: false, herettoDirty: false };
    }));
    toast('Disconnected from Heretto');
  }, [activeTab?.id, setTabs]);

  const handleHerettoSaveNew = useCallback(async (folderUuid: string) => {
    const fileName = herettoSaveFileName.trim() || 'topic.dita';
    const finalName = fileName.endsWith('.dita') || fileName.endsWith('.xml') ? fileName : `${fileName}.dita`;
    const tabId = activeTab.id;

    // P2-24: derive root ID from title if still at a template default
    const title = getTitleFromXml(activeTab.xmlContent);
    const content = title
      ? withUpdatedTopicId(activeTab.xmlContent, slugifyToId(title))
      : activeTab.xmlContent;

    setHerettoSaving(true);
    try {
      const createRes = await fetch(`/heretto-api/all-files/${folderUuid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/xml' },
        body: `<resource><name>${escapeXml(finalName)}</name><type>topic</type></resource>`,
        signal: withTimeout(),
      });
      if (!createRes.ok) throw new Error('Failed to create file');
      const createXml = await createRes.text();

      const parser = new DOMParser();
      const doc = parser.parseFromString(createXml, 'text/xml');
      const newUuid = doc.documentElement.getAttribute('id');
      if (!newUuid) throw new Error('No UUID returned');

      const putRes = await fetch(`/heretto-api/all-files/${newUuid}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/xml' },
        body: content,
        signal: withTimeout(),
      });
      if (!putRes.ok) throw new Error('Failed to write content');

      const pathStr = herettoBreadcrumbs.slice(1).map(b => b.name).join('/') + '/' + finalName;

      // Update savedXmlRef outside the state updater to avoid mutating React state.
      activeTab.savedXmlRef.current = content;

      // P2-25: store current folder path for next save in this session
      lastSavedBreadcrumbsRef.current = herettoBreadcrumbs;
      setHerettoAtLastSavedLocation(false);

      const ancestorUuids = herettoBreadcrumbs.map(b => b.uuid);

      // Defensive check to ensure ancestorUuids is never empty
      if (!ancestorUuids.length) {
        console.warn('[HerettoCms] Breadcrumbs produced empty ancestorUuids, adding root UUID:', HERETTO_ROOT_UUID);
        ancestorUuids.push(HERETTO_ROOT_UUID);
      }

      setTabs(prev => prev.map(t => {
        if (t.id !== tabId) return t;
        return {
          ...t,
          herettoFile: {
            uuid: newUuid,
            name: finalName,
            path: pathStr,
            parentFolderUuid: folderUuid,
            ancestorUuids,
          },
          xmlContent: content,
          lastUpdatedBy: 'code' as const,
        };
      }));
      setIsHerettoBrowserOpen(false);
      toast.success(`Created ${finalName} in Heretto`);
    } catch {
      toast.error('Failed to create file in Heretto');
    } finally {
      setHerettoSaving(false);
    }
  }, [herettoSaveFileName, activeTab, herettoBreadcrumbs, setTabs]);

  const onBrowseFromRoot = useCallback(async () => {
    setHerettoAtLastSavedLocation(false);
    setHerettoBreadcrumbs([]);
    await herettoNavigate(HERETTO_ROOT_UUID, 'Content Root', true);
  }, [herettoNavigate]);

  const handleHerettoReplace = useCallback(async (target: { uuid: string; name: string; path: string }) => {
    const tabId = activeTab.id;
    const content = activeTab.xmlContent;

    try {
      // Step 1: PUT content to replace existing file
      const putRes = await fetch(`/heretto-api/all-files/${target.uuid}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/xml' },
        body: content,
        signal: withTimeout(),
      });

      if (!putRes.ok) {
        let errorMessage = `Failed to replace file (HTTP ${putRes.status})`;
        try {
          const errorResponse = await putRes.text();
          if (errorResponse.trim()) {
            if (errorResponse.includes('DTD') || errorResponse.includes('validation')) {
              errorMessage += ` - DTD validation error: ${errorResponse.substring(0, 200)}`;
            } else if (errorResponse.includes('error') || errorResponse.includes('Error')) {
              errorMessage += ` - ${errorResponse.substring(0, 200)}`;
            } else {
              errorMessage += ` - ${errorResponse.substring(0, 100)}`;
            }
          }
        } catch {
          // Fall back to generic error if response parsing fails
        }
        return { success: false, error: errorMessage };
      }

      // Step 2: GET content back to verify
      const verifyRes = await fetch(`/heretto-api/all-files/${target.uuid}/content`, { signal: withTimeout() });
      if (!verifyRes.ok) {
        return { success: false, error: 'Failed to verify replacement' };
      }
      const remote = await verifyRes.text();

      // Step 3: Compare with compareXml to confirm integrity, stripping
      // Heretto-injected class attributes from both sides (see stripHerettoClassAttrs).
      const comparison = compareXml(stripHerettoClassAttrs(content), stripHerettoClassAttrs(remote));
      if (comparison === 'different') {
        return { success: false, error: 'Upload succeeded, but Heretto reformatted the content. Check the topic in Heretto to confirm your changes are there.' };
      }

      // Step 4: Success! Update tab state
      // Update savedXmlRef outside the state updater to avoid mutating React state.
      activeTab.savedXmlRef.current = content;

      setTabs(prev => prev.map(t => {
        if (t.id !== tabId) return t;
        return {
          ...t,
          herettoReplaceTarget: null, // Clear replace target
          herettoFile: { uuid: target.uuid, name: target.name, path: target.path }, // Set as live Heretto file
          herettoLastSaved: new Date(),
          herettoRemoteChanged: false,
          herettoDirty: false,
          herettoJustLoaded: false,
        };
      }));

      // Show success toast
      toast.success(`Replaced ${target.name} in Heretto`);

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { success: false, error: message };
    }
  }, [activeTab, setTabs]);

  return {
    isHerettoStatusOpen,
    setIsHerettoStatusOpen,
    herettoCredentials,
    setHerettoCredentials,
    herettoStatusChecking,
    isHerettoBrowserOpen,
    setIsHerettoBrowserOpen,
    herettoBrowserMode,
    herettoConnected,
    herettoBrowsing,
    herettoBreadcrumbs,
    setHerettoBreadcrumbs,
    herettoItems,
    herettoSelected,
    setHerettoSelected,
    herettoSaving,
    herettoSaveProgress,
    isHerettoDropdownOpen,
    setIsHerettoDropdownOpen,
    herettoDropdownRef,
    herettoSaveFileName,
    setHerettoSaveFileName,
    herettoRefreshing,
    herettoSearchQuery,
    setHerettoSearchQuery,
    herettoSearchResults,
    herettoSearchStatus,
    setHerettoSearchStatus,
    herettoSearchAbortRef,
    importVerification,
    setImportVerification,
    openHerettoStatus,
    testHerettoConnection,
    saveHerettoCredentials,
    herettoNavigate,
    herettoSearch,
    openHerettoBrowser,
    handleHerettoOpen,
    handleImportContinue,
    handleHerettoSave,
    doHerettoRefresh,
    handleHerettoRefresh,
    handleHerettoDisconnect,
    handleHerettoSaveNew,
    handleHerettoReplace,
    herettoAtLastSavedLocation,
    onBrowseFromRoot,
  };
}
