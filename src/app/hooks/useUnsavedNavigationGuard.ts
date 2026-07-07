import { type RefObject, useEffect } from 'react';
import { useBlocker } from 'react-router-dom';

/**
 * Blocks in-app navigation and tab close when `active` is true.
 * Pass `permitNavigationRef` and set it to `true` immediately before
 * intentional navigation (e.g. after a successful save) so the blocker
 * does not intercept that transition.
 */
export function useUnsavedNavigationGuard(
  active: boolean,
  permitNavigationRef?: RefObject<boolean>,
) {
  const blocker = useBlocker(() => active && !(permitNavigationRef?.current ?? false));
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
