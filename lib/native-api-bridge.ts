import type { Tab } from '../types/tab';
import { validateDitaXml, formatXml } from './xml-utils';
import { createTab } from '../types/tab';
import { APP_VERSION } from '../constants/version';
import { toast } from 'sonner';

let sectionInsertExecutor: ((tabId: string, xml: string) => void) | null = null;

export function registerSectionInsertExecutor(fn: (tabId: string, xml: string) => void): void {
  sectionInsertExecutor = fn;
}

function scheduleSectionInsert(tabId: string, sectionXml: string): void {
  setTimeout(() => {
    if (sectionInsertExecutor) {
      sectionInsertExecutor(tabId, sectionXml);
    }
  }, 50);
}

export interface NativeApiBridgeHandlers {
  getTabs: () => Tab[];
  getActiveTabId: () => string;
  getHerettoConnected: () => boolean;
  getTheme: () => string;
  updateTab: (id: string, updates: Partial<Tab>) => void;
  handleHerettoSave: (tabId: string) => Promise<void>;
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
  setActiveTabId: React.Dispatch<React.SetStateAction<string>>;
}

export function registerNativeApiBridge(handlers: NativeApiBridgeHandlers): void {
  // Only activate in the native app — the dita:// URL scheme is used exclusively there
  if (typeof location === 'undefined' || location.protocol !== 'dita:') return;

  const {
    getTabs,
    getActiveTabId,
    getHerettoConnected,
    getTheme,
    updateTab,
    handleHerettoSave,
    setTabs,
    setActiveTabId,
  } = handlers;

  (window as unknown as Record<string, unknown>).__ditaApi = {
    getStatus: (): string => {
      const tabs = getTabs();
      return JSON.stringify({
        version: APP_VERSION,
        herettoConnected: getHerettoConnected(),
        tabCount: tabs.length,
        activeTabId: getActiveTabId(),
        theme: getTheme(),
      });
    },

    getTabs: (): string => {
      const tabs = getTabs();
      return JSON.stringify({
        activeTabId: getActiveTabId(),
        tabs: tabs.map(tab => ({
          id: tab.id,
          fileName: tab.localFileName || tab.herettoFile?.name || null,
          herettoFile: tab.herettoFile
            ? { uuid: tab.herettoFile.uuid, name: tab.herettoFile.name, path: tab.herettoFile.path }
            : null,
          dirty: tab.herettoDirty || (tab.savedXmlRef.current !== tab.xmlContent),
          xmlErrorCount: tab.xmlErrors.length,
        })),
      });
    },

    getTabContent: (id: string): string => {
      const tab = getTabs().find(t => t.id === id);
      if (!tab) return JSON.stringify({ success: false, error: `Tab with ID "${id}" not found` });
      return JSON.stringify({
        id: tab.id,
        fileName: tab.localFileName || tab.herettoFile?.name || null,
        herettoFile: tab.herettoFile
          ? { uuid: tab.herettoFile.uuid, name: tab.herettoFile.name, path: tab.herettoFile.path }
          : null,
        dirty: tab.herettoDirty || (tab.savedXmlRef.current !== tab.xmlContent),
        xmlErrors: tab.xmlErrors,
        xml: tab.xmlContent,
      });
    },

    updateTabContent: (id: string, xml: string): string => {
      const tabs = getTabs();
      const tab = tabs.find(t => t.id === id);
      if (!tab) return JSON.stringify({ success: false, error: `Tab with ID "${id}" not found` });

      const validation = validateDitaXml(xml);
      if (!validation.valid) {
        return JSON.stringify({ error: 'Invalid XML format', details: validation.error ?? 'Parse error' });
      }

      updateTab(id, { xmlContent: xml, lastUpdatedBy: 'api', syncTrigger: tab.syncTrigger + 1 });
      return JSON.stringify({ success: true, tabId: id });
    },

    saveTab: async (id: string): Promise<string> => {
      const tabs = getTabs();
      const tab = tabs.find(t => t.id === id);
      if (!tab) return JSON.stringify({ success: false, error: `Tab with ID "${id}" not found` });
      if (!tab.herettoFile) return JSON.stringify({ success: false, error: 'Tab has no associated Heretto file' });

      try {
        await handleHerettoSave(id);
        return JSON.stringify({ success: true, tabId: id });
      } catch (error) {
        return JSON.stringify({
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error during save',
        });
      }
    },

    insertSection: (tabId: string, sectionXml: string): string => {
      const tabs = getTabs();
      const tab = tabs.find(t => t.id === tabId);
      if (!tab) return JSON.stringify({ success: false, error: `Tab "${tabId}" not found` });

      // Validate the incoming XML fragment
      const probe = `<?xml version="1.0"?><concept id="x"><title>x</title><conbody>${sectionXml}</conbody></concept>`;
      const validation = validateDitaXml(probe);
      if (!validation.valid) {
        return JSON.stringify({ success: false, error: `Invalid XML: ${validation.error ?? 'parse error'}` });
      }

      // Enter edit mode — increment enterTrigger so EditModePlugin captures a baseline snapshot
      setTabs(prev => prev.map(t =>
        t.id === tabId
          ? { ...t, editMode: true, editModeEnterTrigger: (t.editModeEnterTrigger ?? 0) + 1 }
          : t
      ));

      // After the React render cycle (snapshot captured), insert nodes into the live Lexical tree
      scheduleSectionInsert(tabId, sectionXml);

      return JSON.stringify({ success: true, status: 'inserting' });
    },

    loadContent: (xml: string, fileName: string, herettoTargetUuid?: string): string => {
      const validation = validateDitaXml(xml);
      if (!validation.valid) {
        return JSON.stringify({ success: false, error: `Invalid XML: ${validation.error ?? 'Parse error'}` });
      }

      try {
        const formattedXml = formatXml(xml);
        const newTab = createTab(formattedXml);
        newTab.localFileName = fileName;
        if (herettoTargetUuid) newTab.herettoReplaceTarget = { uuid: herettoTargetUuid };

        setTabs(prev => [...prev, newTab]);
        setActiveTabId(newTab.id);
        toast.success(`Imported ${fileName}`);
        return JSON.stringify({ success: true, status: 'loaded' });
      } catch (err) {
        return JSON.stringify({
          success: false,
          error: err instanceof Error ? err.message : 'Failed to load content',
        });
      }
    },
  };
}
