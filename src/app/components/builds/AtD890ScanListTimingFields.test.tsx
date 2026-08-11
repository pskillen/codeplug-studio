import { MantineProvider } from '@mantine/core';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LIST_NAME_FILTER_DEBOUNCE_MS } from '@integrations/listPrefs/index.ts';
import AtD890ScanListTimingFields, {
  type AtD890ScanListTimingFieldsProps,
} from './AtD890ScanListTimingFields.tsx';

function renderTimingFields(props: AtD890ScanListTimingFieldsProps) {
  return render(
    <MantineProvider>
      <AtD890ScanListTimingFields {...props} />
    </MantineProvider>,
  );
}

describe('AtD890ScanListTimingFields', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('keeps local draft while typing and patches after debounce', () => {
    const onPatch = vi.fn();
    renderTimingFields({
      exportSettings: { scanListLookBackASeconds: 3 },
      onPatch,
    });

    const input = screen.getByRole('textbox', { name: 'Look Back Time A[s]' });
    fireEvent.change(input, { target: { value: '2.5' } });

    expect(onPatch).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(LIST_NAME_FILTER_DEBOUNCE_MS);
    });
    expect(onPatch).toHaveBeenCalledWith({ scanListLookBackASeconds: 2.5 });
  });

  it('flushes pending edits on blur before debounce elapses', () => {
    const onPatch = vi.fn();
    renderTimingFields({
      exportSettings: { scanListLookBackASeconds: 3 },
      onPatch,
    });

    const input = screen.getByRole('textbox', { name: 'Look Back Time A[s]' });
    fireEvent.change(input, { target: { value: '2.5' } });
    fireEvent.blur(input);

    expect(onPatch).toHaveBeenCalledWith({ scanListLookBackASeconds: 2.5 });
  });

  it('does not patch when value unchanged on blur', () => {
    const onPatch = vi.fn();
    renderTimingFields({
      exportSettings: { scanListDwellTimeSeconds: 3.1 },
      onPatch,
    });

    const input = screen.getByRole('textbox', { name: 'Dwell Time[s]' });
    fireEvent.blur(input);

    expect(onPatch).not.toHaveBeenCalled();
  });
});
