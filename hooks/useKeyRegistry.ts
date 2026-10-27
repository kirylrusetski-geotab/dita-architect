import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { loadKeyRegistry, MapLoadError, type KeyRegistry, type MapLoadErrorKind } from '../lib/heretto-map-loader';

// ADR-013 decision 5: one key registry for the app, from the map the writer
// connected. Only the map's {uuid, name} is persisted; the registry is rebuilt
// from Heretto on every launch, silently (P2-27: no toast on restore).

export const CONNECTED_MAP_STORAGE_KEY = 'dita-architect-connected-map';

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** The UUID in `input` — a bare UUID or any text holding one (a pasted Heretto URL) — lower-cased. */
export const extractUuid = (input: string): string | null => input.match(UUID_RE)?.[0].toLowerCase() ?? null;

interface ConnectedMap { uuid: string; name: string }

const readStored = (): ConnectedMap | null => {
  try {
    const raw = localStorage.getItem(CONNECTED_MAP_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return typeof parsed?.uuid === 'string' && typeof parsed?.name === 'string' ? { uuid: parsed.uuid, name: parsed.name } : null;
  } catch {
    return null;
  }
};

const writeStored = (map: ConnectedMap | null): void => {
  try {
    if (map) localStorage.setItem(CONNECTED_MAP_STORAGE_KEY, JSON.stringify(map));
    else localStorage.removeItem(CONNECTED_MAP_STORAGE_KEY);
  } catch {
    // Storage unavailable: the map simply is not remembered.
  }
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Success toast copy (P2-27), plus what the walk could not reach (ADR-013). */
const describeConnect = (reg: KeyRegistry): string => {
  let message = `Connected ${reg.map.name} — ${plural(reg.keys.size, 'key definition', 'key definitions')} loaded`;
  if (reg.mapsSkipped > 0) message += `, ${plural(reg.mapsSkipped, 'submap', 'submaps')} could not be read`;
  if (reg.capped) message += '; stopped at the safety limit, so deeper maps were not read';
  return message;
};

export interface KeyRegistryState {
  registry: KeyRegistry | null;
  connectedMap: ConnectedMap | null;
  loading: boolean;
  /** Set when a connect or reload the writer asked for failed (shown as a modal). */
  error: { kind: MapLoadErrorKind; message: string } | null;
  /** Connect the map named by `input` (a UUID or text holding one). True on success. */
  connect: (input: string) => Promise<boolean>;
  reload: () => Promise<boolean>;
  disconnect: () => void;
  clearError: () => void;
}

export const useKeyRegistry = (): KeyRegistryState => {
  const [registry, setRegistry] = useState<KeyRegistry | null>(null);
  const [connectedMap, setConnectedMap] = useState<ConnectedMap | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<KeyRegistryState['error']>(null);
  // A later request supersedes an earlier one still in flight.
  const requestRef = useRef(0);

  const load = useCallback(async (uuid: string, silent: boolean): Promise<boolean> => {
    const request = ++requestRef.current;
    setLoading(true);
    try {
      const reg = await loadKeyRegistry(uuid);
      if (request !== requestRef.current) return false;
      const map = { uuid: reg.map.uuid, name: reg.map.name };
      setRegistry(reg);
      setConnectedMap(map);
      writeStored(map);
      if (!silent) toast.success(describeConnect(reg));
      return true;
    } catch (err) {
      if (request !== requestRef.current) return false;
      // A failed connect keeps whatever was connected before (P2-27). A failed
      // silent restore shows nothing and keeps the stored map for next launch.
      if (!silent) {
        setError(err instanceof MapLoadError
          ? { kind: err.kind, message: err.message }
          : { kind: 'network', message: 'The map could not be loaded.' });
      }
      return false;
    } finally {
      if (request === requestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const stored = readStored();
    if (stored) {
      setConnectedMap(stored);
      void load(stored.uuid, true);
    }
  }, [load]);

  const connect = useCallback(async (input: string) => {
    const uuid = extractUuid(input);
    if (!uuid) {
      setError({ kind: 'not-found', message: 'That is not a Heretto UUID. Paste the map\'s UUID or a Heretto link to it.' });
      return false;
    }
    return load(uuid, false);
  }, [load]);

  const reload = useCallback(async () => (connectedMap ? load(connectedMap.uuid, false) : false), [connectedMap, load]);

  const disconnect = useCallback(() => {
    requestRef.current++;
    setRegistry(null);
    setConnectedMap(null);
    setLoading(false);
    writeStored(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { registry, connectedMap, loading, error, connect, reload, disconnect, clearError };
};
