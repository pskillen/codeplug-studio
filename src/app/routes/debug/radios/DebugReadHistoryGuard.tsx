import { useEffect } from 'react';
import { useBlocker, useLocation } from 'react-router-dom';
import ConfirmModal from '@app/components/v2/ConfirmModal.tsx';
import DesignSystemV2Provider from '@app/components/v2/DesignSystemV2Provider.tsx';
import { getDebugReadHistory, useDebugReadHistory } from './debugReadHistory.ts';

const mini = getDebugReadHistory({ slug: 'uv-5r-mini', archiveModelId: 'UV-5R Mini' });
const rt95 = getDebugReadHistory({ slug: 'rt95', archiveModelId: 'retevis-rt95' });
const d890 = getDebugReadHistory({ slug: 'at-d890uv', archiveModelId: 'AT-D890UV' });
const dm32 = getDebugReadHistory({ slug: 'dm-32uv', archiveModelId: 'DM-32UV' });
const normalize = (path: string) => path.replace(/\/+$/, '');
const isMini = (path: string) =>
  ['/debug/uv5r-mini', '/debug/radios/uv-5r-mini'].includes(normalize(path));
const isRt95 = (path: string) => normalize(path) === '/debug/radios/rt95';

const isDm32 = (path: string) => normalize(path) === '/debug/radios/dm-32uv';
const isD890 = (path: string) => normalize(path) === '/debug/radios/at-d890uv';

export function DebugReadHistoryGuard() {
  const dm32Pending = useDebugReadHistory(dm32).undownloaded;
  const miniPending = useDebugReadHistory(mini).undownloaded;
  const d890Pending = useDebugReadHistory(d890).undownloaded;
  const rt95Pending = useDebugReadHistory(rt95).undownloaded;
  const { pathname } = useLocation();
  useEffect(() => {
    if (!miniPending && !rt95Pending && !d890Pending && !dm32Pending) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [miniPending, rt95Pending, d890Pending, dm32Pending]);
  const active =
    (isMini(pathname) && miniPending > 0) ||
    (isRt95(pathname) && rt95Pending > 0) ||
    (isD890(pathname) && d890Pending > 0) ||
    (isDm32(pathname) && dm32Pending > 0);
  return active ? <NavigationGuard /> : null;
}

function NavigationGuard() {
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      currentLocation.pathname !== nextLocation.pathname &&
      ((isMini(currentLocation.pathname) && !isMini(nextLocation.pathname)) ||
        (isRt95(currentLocation.pathname) && !isRt95(nextLocation.pathname)) ||
        (isD890(currentLocation.pathname) && !isD890(nextLocation.pathname)) ||
        (isDm32(currentLocation.pathname) && !isDm32(nextLocation.pathname))),
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
