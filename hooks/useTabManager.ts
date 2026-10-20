import { useState, useCallback, useMemo } from 'react';
import type { Tab } from '../types/tab';
import { createTab } from '../types/tab';
import { DITA_TEMPLATES, INITIAL_DITA } from '../constants/dita';
import { convertDitaTopic } from '../lib/xml-utils';
import { toast } from 'sonner';

interface UseTabManagerParams {
  setIsConvertModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setIsNewTopicModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setConfirmModal: React.Dispatch<React.SetStateAction<{ message: string; onConfirm: () => void } | null>>;
}

export function useTabManager({
  setIsConvertModalOpen,
  setIsNewTopicModalOpen,
  setConfirmModal,
}: UseTabManagerParams) {
  const [tabs, setTabs] = useState<Tab[]>(() => [createTab(INITIAL_DITA)]);
  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0]?.id ?? '');
  const activeTab = tabs.find(t => t.id === activeTabId) ?? tabs[0];

  const updateTab = useCallback((id: string, updates: Partial<Tab>) => {
    setTabs(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
  }, []);

  const currentTopicType = useMemo(() => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(activeTab.xmlContent, 'text/xml');
    const root = doc.documentElement;
    if (!root || root.tagName === 'html' || root.tagName === 'parsererror') return 'undefined' as const;

    const tagName = root.tagName.toLowerCase();
    if (['task', 'concept', 'reference', 'topic', 'troubleshooting'].includes(tagName)) {
      return tagName as 'task' | 'concept' | 'reference' | 'topic' | 'troubleshooting';
    }
    return 'undefined' as const;
  }, [activeTab.xmlContent]);

  const doCloseTab = useCallback((tabId: string) => {
    setTabs(prev => {
      if (prev.length === 1) {
        const fresh = createTab(DITA_TEMPLATES.task);
        setActiveTabId(fresh.id);
        return [fresh];
      }
      const idx = prev.findIndex(t => t.id === tabId);
      if (tabId === activeTabId) {
        const nextTab = prev[idx + 1] ?? prev[idx - 1];
        setActiveTabId(nextTab.id);
      }
      return prev.filter(t => t.id !== tabId);
    });
  }, [activeTabId]);

  const handleCloseTab = useCallback((tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    if (tab.xmlContent !== tab.savedXmlRef.current) {
      setConfirmModal({
        message: 'This tab has edits that haven\'t been saved. Close anyway?',
        onConfirm: () => { setConfirmModal(null); doCloseTab(tabId); },
      });
      return;
    }

    doCloseTab(tabId);
  }, [tabs, doCloseTab, setConfirmModal]);

  const handleNewTab = useCallback(() => {
    const newTab = createTab(DITA_TEMPLATES.task);
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
  }, []);

  const handleNewTopic = useCallback((type: 'task' | 'concept' | 'reference') => {
    const template = DITA_TEMPLATES[type];
    const newTab = createTab(template);
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newTab.id);
    setIsNewTopicModalOpen(false);
    toast.success(`New ${type} topic created`);
  }, [setIsNewTopicModalOpen]);

  const handleConvertTopic = useCallback((targetType: 'task' | 'concept' | 'reference') => {
    const result = convertDitaTopic(activeTab.xmlContent, targetType);

    if (!result.ok) {
      if (result.reason === 'invalid-xml') {
        toast.error('Cannot convert invalid XML');
      } else if (result.reason === 'same-type') {
        toast.info(`Already a ${targetType}`);
        setIsConvertModalOpen(false);
      }
      return;
    }

    updateTab(activeTab.id, { xmlContent: result.xml, lastUpdatedBy: 'code' });
    setTimeout(() => {
      setTabs(prev => prev.map(t => t.id === activeTab.id ? { ...t, syncTrigger: t.syncTrigger + 1 } : t));
    }, 0);
    setIsConvertModalOpen(false);
    toast.success(`Converted to ${targetType}`);
  }, [activeTab, updateTab, setIsConvertModalOpen, setTabs]);

  return {
    tabs,
    setTabs,
    activeTabId,
    setActiveTabId,
    activeTab,
    updateTab,
    currentTopicType,
    doCloseTab,
    handleCloseTab,
    handleNewTab,
    handleNewTopic,
    handleConvertTopic,
  };
}
