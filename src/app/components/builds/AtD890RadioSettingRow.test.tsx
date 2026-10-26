import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { atD890SettingField } from '@core/radios/anytone/at-d890uv/radioSettings.ts';
import { DesignSystemV2Provider } from '../v2/index.ts';
import AtD890RadioSettingRow, { radioValueText } from './AtD890RadioSettingRow.tsx';

function renderRow(
  id: string,
  props: Partial<React.ComponentProps<typeof AtD890RadioSettingRow>> = {},
) {
  const field = atD890SettingField(id)!;
  const onSet = vi.fn();
  const onClear = vi.fn();
  render(
    <DesignSystemV2Provider>
      <AtD890RadioSettingRow
        field={field}
        target="stock"
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

describe('AtD890RadioSettingRow', () => {
  it("lists Keep radio's value first and shows 'not read' before a Read", () => {
    renderRow('keyTone');
    const select = screen.getByRole('combobox', { name: 'Key tone' }) as HTMLSelectElement;
    expect([...select.options].map((o) => o.text)).toEqual(["Keep radio's value", 'Off', 'On']);
    expect(select.value).toBe('keep');
    expect(screen.getByText('not read')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Clear/ })).not.toBeInTheDocument();
  });

  it('sets a boolean and an enum, and Keep clears', () => {
    const bool = renderRow('keyTone');
    fireEvent.change(screen.getByRole('combobox', { name: 'Key tone' }), {
      target: { value: 'off' },
    });
    expect(bool.onSet).toHaveBeenCalledWith(false);
    fireEvent.change(screen.getByRole('combobox', { name: 'Key tone' }), {
      target: { value: 'keep' },
    });
    expect(bool.onClear).toHaveBeenCalled();
  });

  it('shows the set marker and a Clear button for an override', () => {
    const { onClear } = renderRow('keyTone', { override: true });
    expect(screen.getByRole('img', { name: 'Will be set' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear Key tone' }));
    expect(onClear).toHaveBeenCalled();
  });

  it('shows values the radio holds but Studio does not offer only in the Radio column', () => {
    renderRow('callDisplayMode', {
      hasRead: true,
      decoded: {
        value: undefined,
        raw: [2],
        label: 'Name based (the radio resets this at power-on)',
      },
    });
    expect(screen.getByText(/Name based .* \(not offered\)/)).toBeInTheDocument();
    const select = screen.getByRole('combobox', { name: 'Call display mode' }) as HTMLSelectElement;
    expect([...select.options].map((o) => o.text)).toEqual([
      "Keep radio's value",
      'Turn off talker alias',
      'Call sign based',
    ]);
  });

  it('falls back to the raw bytes when nothing names the value', () => {
    expect(
      radioValueText(
        atD890SettingField('smsFormat')!,
        'stock',
        { value: undefined, raw: [9] },
        true,
      ),
    ).toBe('9 (not offered)');
  });

  it('names key functions with MM9PDY names on the MM9PDY target only', () => {
    renderRow('keyShortP1', { target: 'mm9pdy' });
    const select = screen.getByRole('combobox', { name: 'P1 short press' }) as HTMLSelectElement;
    const labels = [...select.options].map((o) => o.text);
    expect(labels).toContain('TG Next');
    expect(labels).toContain('TG Previous');
  });

  it('validates text lines and keeps an empty set value as a set value', () => {
    const { onSet } = renderRow('powerOnLine1', { override: 'Hello' });
    const input = screen.getByRole('textbox', { name: 'Power-on line 1' });
    fireEvent.change(input, { target: { value: '' } });
    expect(onSet).toHaveBeenCalledWith('');
  });

  it('flags text that is too long or not plain ASCII', () => {
    renderRow('powerOnLine1', { override: 'x'.repeat(17) });
    expect(screen.getByText('At most 16 characters.')).toBeInTheDocument();
  });

  it('flags accented text', () => {
    renderRow('powerOnLine1', { override: 'Café' });
    expect(screen.getByText(/no accents/)).toBeInTheDocument();
  });
});
