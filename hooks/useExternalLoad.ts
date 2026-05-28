import { useEffect, useRef } from 'react';
import type { Tab } from '../types/tab';
import { createTab } from '../types/tab';
import { validateDitaXml, formatXml } from '../lib/xml-utils';
import { toast } from 'sonner';

interface UseExternalLoadParams {
  createTab: typeof createTab;
  setTabs: React.Dispatch<React.SetStateAction<Tab[]>>;
  setActiveTabId: React.Dispatch<React.SetStateAction<string>>;
}

interface PendingLoad {
  xml: string;
  fileName: string;
  herettoTargetUuid?: string;
}

export function useExternalLoad({
  createTab,
  setTabs,
  setActiveTabId,
}: UseExternalLoadParams) {
  const pollIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;

      try {
        const response = await fetch('/api/pending-loads');
        if (cancelled || !response.ok) return;

        const { loads: pendingLoads }: { loads: PendingLoad[] } = await response.json();
        if (cancelled || !pendingLoads || pendingLoads.length === 0) {
          scheduleNext();
          return;
        }

        // Process each pending load
        for (const load of pendingLoads) {
          if (cancelled) return;

          const { xml, fileName, herettoTargetUuid } = load;

          // Validate XML
          const validation = validateDitaXml(xml);
          if (!validation.valid) {
            toast.error(`Failed to load ${fileName}: ${validation.error}`);
            continue;
          }

          try {
            // Format XML
            const formattedXml = formatXml(xml);

            // Create new tab
            const newTab = createTab(formattedXml);
            newTab.localFileName = fileName;

            // Set Heretto connection if a target UUID is provided. Populating
            // herettoFile enables the Save-to-Heretto button (gated on tab.herettoFile).
            // We use fileName for name/path because the API caller knows the file by
            // those values; richer breadcrumb metadata would require traversing the
            // Heretto folder tree, which is left to the open-from-Heretto flow.
            if (herettoTargetUuid) {
              newTab.herettoReplaceTarget = { uuid: herettoTargetUuid };
              newTab.herettoFile = {
                uuid: herettoTargetUuid,
                name: fileName,
                path: fileName,
              };
              newTab.herettoLastSaved = new Date();
              newTab.herettoJustLoaded = true;
            }

            // Add tab and set as active
            setTabs(prev => [...prev, newTab]);
            setActiveTabId(newTab.id);

            toast.success(`Imported ${fileName}`);
          } catch (err) {
            const errorMessage = err instanceof Error ? err.message : String(err);
            toast.error(`Failed to format ${fileName}: ${errorMessage}`);
          }
        }

        scheduleNext();
      } catch (err) {
        if (cancelled) return;
        // Silently fail on network errors to avoid spam
        scheduleNext();
      }
    };

    const scheduleNext = () => {
      if (cancelled) return;
      pollIntervalRef.current = setTimeout(poll, 2000); // 2-second interval
    };

    // Start polling
    scheduleNext();

    return () => {
      cancelled = true;
      if (pollIntervalRef.current) {
        clearTimeout(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [createTab, setTabs, setActiveTabId]);

  // This hook has no return value - it's purely side-effects
}