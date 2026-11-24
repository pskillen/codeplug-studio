import { useEffect, useSyncExternalStore } from 'react';
import { useBlocker, useLocation } from 'react-router-dom';
import ConfirmModal from '@app/components/v2/ConfirmModal.tsx';
import DesignSystemV2Provider from '@app/components/v2/DesignSystemV2Provider.tsx';
import { getDebugReadHistory, type DebugReadHistoryStore } from './debugReadHistory.ts';
import { radioDebugDescriptors } from './descriptors.ts';

const normalize = (path: string) => path.replace(/\/+$/, '');

interface GuardedHistory {
  store: DebugReadHistoryStore;
  radio: string;
  covers: (path: string) => boolean;
}

const guarded: readonly GuardedHistory[] = radioDebugDescriptors
  .filter((descriptor) => descriptor.readHistory)
  .map((descriptor) => ({
    store: getDebugReadHistory(descriptor),
    radio: descriptor.radio,
    covers: (path: string) => {
      const normalised = normalize(path);
      if (
        normalised === `/debug/radios/${descriptor.radio}` ||
        normalised.startsWith(`/debug/radios/${descriptor.radio}/`)
      )
        return true;
      return descriptor.alsoGuards?.some((extra) => normalize(extra) === normalised) ?? false;
    },
  }));

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
  const active = guarded.some((entry, i) => entry.covers(pathname) && pending[i]! > 0);
  return active ? <NavigationGuard pending={pending} /> : null;
}

function NavigationGuard({ pending }: { pending: number[] }) {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (currentLocation.pathname === nextLocation.pathname) return false;
    return guarded.some(
      (entry, i) =>
        pending[i]! > 0 &&
        entry.covers(currentLocation.pathname) &&
        !entry.covers(nextLocation.pathname),
    );
  });
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
