import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { rt95SettingField } from '@core/radios/retevis/rt95/radioSettings.ts';
import { DesignSystemV2Provider } from '../v2/index.ts';
import Rt95RadioSettingRow from './Rt95RadioSettingRow.tsx';

function renderRow(
  id: string,
  props: Partial<React.ComponentProps<typeof Rt95RadioSettingRow>> = {},
) {
  const field = rt95SettingField(id)!;
  const onSet = vi.fn();
  const onClear = vi.fn();
  render(
    <DesignSystemV2Provider>
      <Rt95RadioSettingRow
        field={field}
        override={undefined}
        decoded={undefined}
        hasRead={false}
        onSet={onSet}
        onClear={onClear}
        {...props}
      />
    </DesignSystemV2Provider>,
  );
  return { field, onSet, onClear };
}

describe('Rt95RadioSettingRow', () => {
  it("lists Keep radio's value first and shows not read before a Read", () => {
    renderRow('beepVolume');
    const select = screen.getByRole('combobox', { name: 'Beep Volume' }) as HTMLSelectElement;
    expect(select.options[0]?.text).toBe("Keep radio's value");
    expect(screen.getByText('not read')).toBeInTheDocument();
  });

  it('sets an enum and Keep clears', () => {
    const { onSet, onClear } = renderRow('beepVolume');
    fireEvent.change(screen.getByRole('combobox', { name: 'Beep Volume' }), {
      target: { value: '2' },
    });
    expect(onSet).toHaveBeenCalledWith(2);
    fireEvent.change(screen.getByRole('combobox', { name: 'Beep Volume' }), {
      target: { value: 'keep' },
    });
    expect(onClear).toHaveBeenCalled();
  });

  it('shows the set marker for an override', () => {
    renderRow('voxOnOff', { override: true });
    expect(screen.getByRole('img', { name: 'Will be set' })).toBeInTheDocument();
    cleanup();
    renderRow('startingDisplay', { override: 'HELLO' });
    expect(screen.getByRole('textbox', { name: 'Starting Display' })).toHaveValue('HELLO');
  });
});
