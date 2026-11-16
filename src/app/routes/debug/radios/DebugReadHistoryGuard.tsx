import { useEffect, useSyncExternalStore } from 'react';
import { useBlocker, useLocation } from 'react-router-dom';
import ConfirmModal from '@app/components/v2/ConfirmModal.tsx';
import DesignSystemV2Provider from '@app/components/v2/DesignSystemV2Provider.tsx';
import { getDebugReadHistory, type DebugReadHistoryStore } from './debugReadHistory.ts';
import { radioDebugDescriptors } from './descriptors.ts';

const normalize = (path: string) => path.replace(/\/+$/, '');

interface GuardedHistory {
  store: DebugReadHistoryStore;
  matches: (path: string) => boolean;
}

const guarded: readonly GuardedHistory[] = [
  {
    store: getDebugReadHistory({ slug: 'uv-5r-mini', archiveModelId: 'UV-5R Mini' }),
    matches: (path) => ['/debug/uv5r-mini', '/debug/radios/uv-5r-mini'].includes(normalize(path)),
  },
  {
    store: getDebugReadHistory({ slug: 'rt95', archiveModelId: 'retevis-rt95' }),
    matches: (path) => normalize(path) === '/debug/radios/rt95',
  },
  {
    store: getDebugReadHistory({ slug: 'at-d890uv', archiveModelId: 'AT-D890UV' }),
    matches: (path) => normalize(path) === '/debug/radios/at-d890uv',
  },
  {
    store: getDebugReadHistory({ slug: 'dm-32uv', archiveModelId: 'DM-32UV' }),
    matches: (path) => normalize(path) === '/debug/radios/dm-32uv',
  },
  ...radioDebugDescriptors
    .filter((descriptor) => descriptor.readHistory)
    .map((descriptor) => ({
      store: getDebugReadHistory(descriptor),
      matches: (path: string) => normalize(path) === `/debug/radios/${descriptor.slug}`,
    })),
];

const subscribeAll = (listener: () => void) => {
  const unsubscribes = guarded.map((entry) => entry.store.subscribe(listener));
  return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
};
/** One primitive snapshot (undownloaded count per history), so it is stable between changes. */
const pendingKey = () => guarded.map((entry) => entry.store.getSnapshot().undownloaded).join(',');

export function DebugReadHistoryGuard() {
  const pending = useSyncExternalStore(subscribeAll, pendingKey, pendingKey).split(',').map(Number);
  const anyPending = pending.some((count) => count > 0);
  const { pathname } = useLocation();
  useEffect(() => {
    if (!anyPending) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [anyPending]);
  const active = guarded.some((entry, i) => entry.matches(pathname) && pending[i]! > 0);
  return active ? <NavigationGuard /> : null;
}

function NavigationGuard() {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      currentLocation.pathname !== nextLocation.pathname &&
      guarded.some(
        (entry) => entry.matches(currentLocation.pathname) && !entry.matches(nextLocation.pathname),
      ),
  );
  return (
    <DesignSystemV2Provider>
      <ConfirmModal
        open={blocker.state === 'blocked'}
        onClose={() => blocker.reset?.()}
        onConfirm={() => blocker.proceed?.()}
        title="Leave with undownloaded reads?"
        cancelLabel="Stay"
        confirmLabel="Leave"
      >
        Reads remain in this tab until cleared or the tab is closed or reloaded.
      </ConfirmModal>
    </DesignSystemV2Provider>
  );
}
