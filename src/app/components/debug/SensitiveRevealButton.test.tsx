import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DesignSystemV2Provider } from '@app/components/v2/index.ts';
import SensitiveRevealButton from './SensitiveRevealButton.tsx';
import { useSensitiveReveal } from './useSensitiveReveal.ts';

describe('useSensitiveReveal', () => {
  it('is hidden by default, toggles, and hides again when the key changes', () => {
    const { result, rerender } = renderHook(({ key }) => useSensitiveReveal(key), {
      initialProps: { key: 1 as number | undefined },
    });
    expect(result.current.revealed).toBe(false);
    act(() => result.current.toggle());
    expect(result.current.revealed).toBe(true);
    rerender({ key: 2 });
    expect(result.current.revealed).toBe(false);
    rerender({ key: 1 });
    expect(result.current.revealed).toBe(true);
    act(() => result.current.toggle());
    expect(result.current.revealed).toBe(false);
  });

  it('never reveals without a key', () => {
    const { result } = renderHook(() => useSensitiveReveal(undefined));
    act(() => result.current.toggle());
    expect(result.current.revealed).toBe(false);
  });
});

describe('SensitiveRevealButton', () => {
  it('labels and pressed state follow revealed', () => {
    let calls = 0;
    const view = render(
      <DesignSystemV2Provider>
        <SensitiveRevealButton revealed={false} onToggle={() => calls++} />
      </DesignSystemV2Provider>,
    );
    const show = screen.getByRole('button', { name: 'Show password' });
    expect(show).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(show);
    expect(calls).toBe(1);
    view.rerender(
      <DesignSystemV2Provider>
        <SensitiveRevealButton revealed onToggle={() => calls++} />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});
