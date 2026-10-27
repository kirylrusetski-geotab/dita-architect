import { createContext } from 'react';
import type { KeyRegistry } from '../lib/heretto-map-loader';

/**
 * The connected map's key registry (ADR-013 decision 5), or null when no map is
 * connected. Provided once above every editor; chips read it while rendering
 * (decision 7), so a connect or reload never touches any document.
 */
export const KeyRegistryContext = createContext<KeyRegistry | null>(null);
