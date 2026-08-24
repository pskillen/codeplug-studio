import { useEffect, useState } from 'react';

/**
 * Tracks which of the given section ids is topmost in the viewport, for driving
 * a sticky jump-nav's active state. Works whether the document scrolls (desktop)
 * or an inner container scrolls (mobile `.mainScroll`) — `root: null` observes
 * intersection with the viewport either way.
 */
export function useSectionScrollSpy(ids: readonly string[]): string | undefined {
  const [activeId, setActiveId] = useState<string | undefined>(ids[0]);

  useEffect(() => {
    if (ids.length === 0) {
      return;
    }

    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el != null);

    if (elements.length === 0) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const intersecting = entries.filter((entry) => entry.isIntersecting);
        if (intersecting.length === 0) return;
        // Topmost intersecting section — smallest boundingClientRect.top.
        const topmost = intersecting.reduce((best, entry) =>
          entry.boundingClientRect.top < best.boundingClientRect.top ? entry : best,
        );
        setActiveId(topmost.target.id);
      },
      { root: null, rootMargin: '0px 0px -70% 0px', threshold: 0 },
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [ids]);

  return activeId;
}
