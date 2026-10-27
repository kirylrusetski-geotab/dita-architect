// The three keyref chip states (ADR-013 decision 7; P2-27's UX review): no map
// connected, key not found, key found. Each has its own class and tooltip —
// "no map" and "resolved" must never look alike, or a writer reads "not
// checked" as "fine".
import type { KeyRegistry } from './heretto-map-loader';

export type ChipKeyState = 'no-map' | 'unresolved' | 'resolved';

export const CHIP_STATE_CLASS: Record<ChipKeyState, string> = {
  'no-map': 'dita-chip--no-map',
  unresolved: 'dita-chip--unresolved',
  resolved: 'dita-chip--resolved',
};

export const CHIP_TOOLTIP = {
  'no-map': 'Load a ditamap to verify this key resolves',
  unresolved: 'Key not found in the loaded map',
} as const;

/**
 * The key state of a chip, or null for a chip that has no key (conref, image).
 * The key is the part of the reference before any `/` (`varsAltitude` in
 * `conkeyref="varsAltitude/ProdNameShort"`).
 */
export const chipKeyState = (
  refType: string,
  refValue: string,
  registry: KeyRegistry | null,
): { state: ChipKeyState; tooltip: string } | null => {
  if (refType !== 'conkeyref' && refType !== 'keyref') return null;
  if (!registry) return { state: 'no-map', tooltip: CHIP_TOOLTIP['no-map'] };
  const def = registry.keys.get(refValue.split('/')[0]);
  return def
    ? { state: 'resolved', tooltip: `Key found in ${def.mapName}` }
    : { state: 'unresolved', tooltip: CHIP_TOOLTIP.unresolved };
};
