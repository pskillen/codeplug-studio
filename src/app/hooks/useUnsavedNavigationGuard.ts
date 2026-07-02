import { useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

/**
 * Blocks in-app navigation and tab close when `active` is true.
 * Returns modal handlers — render a confirm dialog when `modalOpen` is true.
 */
export function useUnsavedNavigationGuard(active: boolean) {
  const blocker = useBlocker(active);
  const modalOpen = blocker.state === 'blocked';

  useEffect(() => {
    if (!active) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [active]);

  function stay() {
    if (blocker.state === 'blocked') {
      blocker.reset();
    }
  }

  function leave() {
    if (blocker.state === 'blocked') {
      blocker.proceed();
    }
  }

  return { modalOpen, stay, leave };
}
