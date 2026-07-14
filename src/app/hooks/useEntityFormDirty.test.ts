import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useEntityFormDirty, useFormBaseline } from './useEntityFormDirty.ts';

describe('useEntityFormDirty', () => {
  it('tracks dirty state against the mount-time baseline only', () => {
    let name = 'Saved';
    const build = () => ({ name });

    const { result, rerender } = renderHook(() => {
      const baseline = useFormBaseline(build);
      return useEntityFormDirty({ baseline, buildCurrent: build });
    });

    expect(result.current.isDirty).toBe(false);

    name = 'Edited';
    rerender();
    expect(result.current.isDirty).toBe(true);
  });

  it('clears dirty state after remount with a fresh baseline', () => {
    let name = 'Saved';
    const build = () => ({ name });

    const { result, rerender, unmount } = renderHook(() => {
      const baseline = useFormBaseline(build);
      return useEntityFormDirty({ baseline, buildCurrent: build });
    });

    name = 'Edited';
    rerender();
    expect(result.current.isDirty).toBe(true);

    unmount();
    name = 'Saved';

    const { result: fresh } = renderHook(() => {
      const baseline = useFormBaseline(build);
      return useEntityFormDirty({ baseline, buildCurrent: build });
    });

    expect(fresh.current.isDirty).toBe(false);
  });
});
