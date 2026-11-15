import { useEffect } from 'react';
import { useBlocker, useLocation } from 'react-router-dom';
import ConfirmModal from '@app/components/v2/ConfirmModal.tsx';
import DesignSystemV2Provider from '@app/components/v2/DesignSystemV2Provider.tsx';
import { getDebugReadHistory, useDebugReadHistory } from './debugReadHistory.ts';

const mini = getDebugReadHistory({ slug: 'uv-5r-mini', archiveModelId: 'UV-5R Mini' });
const rt95 = getDebugReadHistory({ slug: 'rt95', archiveModelId: 'retevis-rt95' });
const isMini = (path: string) => path === '/debug/uv5r-mini' || path === '/debug/radios/uv-5r-mini';
const isRt95 = (path: string) => path === '/debug/radios/rt95';

export function DebugReadHistoryGuard() {
  const miniPending = useDebugReadHistory(mini).undownloaded;
  const rt95Pending = useDebugReadHistory(rt95).undownloaded;
  const { pathname } = useLocation();
  useEffect(() => {
    if (!miniPending && !rt95Pending) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [miniPending, rt95Pending]);
  const active = (isMini(pathname) && miniPending > 0) || (isRt95(pathname) && rt95Pending > 0);
  return active ? <NavigationGuard /> : null;
}

function NavigationGuard() {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      currentLocation.pathname !== nextLocation.pathname &&
      ((isMini(currentLocation.pathname) && !isMini(nextLocation.pathname)) ||
        (isRt95(currentLocation.pathname) && !isRt95(nextLocation.pathname))),
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
