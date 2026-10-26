import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AT_D890_SETTING_FIELDS,
  AT_D890_V1_SETTINGS_FIELD_IDS,
} from '@core/radios/anytone/at-d890uv/radioSettings.ts';
import { MemoryRouter } from 'react-router-dom';
import { DesignSystemV2Provider } from '../v2/index.ts';
import {
  clearAllOverrides,
  getAtD890RadioSettingsSession,
  setOverride,
} from '../../state/atD890RadioSettingsSession.ts';
import AtD890RadioSettingsEditor from './AtD890RadioSettingsEditor.tsx';

const BUILD = 'build-editor-test';

function renderEditor(target: 'stock' | 'mm9pdy' = 'stock') {
  return render(
    <MemoryRouter>
      <DesignSystemV2Provider>
        <AtD890RadioSettingsEditor buildId={BUILD} target={target} />
      </DesignSystemV2Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  clearAllOverrides(BUILD);
});

afterEach(() => {
  clearAllOverrides(BUILD);
  vi.restoreAllMocks();
});

describe('AtD890RadioSettingsEditor', () => {
  it("renders every v1 field, each defaulting to Keep radio's value", () => {
    renderEditor();
    expect(AT_D890_SETTING_FIELDS.map((f) => f.id)).toEqual(
      expect.arrayContaining([...AT_D890_V1_SETTINGS_FIELD_IDS]),
    );
    for (const field of AT_D890_SETTING_FIELDS) {
      const control = screen.getByLabelText(field.label, { selector: '[id^="d890-setting-"]' });
      if (field.kind === 'text') {
        expect((control as HTMLInputElement).value).toBe('');
        expect((control as HTMLInputElement).placeholder).toBe("Keep radio's value");
      } else {
        expect((control as HTMLSelectElement).value).toBe('keep');
      }
    }
    expect(screen.getByTestId('changes-count')).toHaveTextContent('0 changes');
  });

  it('marks a set field, counts it, and Clear returns it to Keep', () => {
    renderEditor();
    fireEvent.change(screen.getByRole('combobox', { name: 'Key tone' }), {
      target: { value: 'off' },
    });
    expect(getAtD890RadioSettingsSession(BUILD).overrides.get('keyTone')).toBe(false);
    expect(screen.getByTestId('changes-count')).toHaveTextContent('1 change');
    fireEvent.click(screen.getByRole('button', { name: 'Clear Key tone' }));
    expect(getAtD890RadioSettingsSession(BUILD).overrides.size).toBe(0);
    expect(screen.getByTestId('changes-count')).toHaveTextContent('0 changes');
  });

  it('shows overrides set earlier in the session (navigation keeps them)', () => {
    act(() => setOverride(BUILD, 'keyTone', true));
    act(() => setOverride(BUILD, 'smsFormat', 2));
    renderEditor();
    expect(screen.getByTestId('changes-count')).toHaveTextContent('2 changes');
    const row = screen.getByRole('combobox', { name: 'SMS format' }).closest('[data-field-id]')!;
    expect(row).toHaveAttribute('data-set', 'true');
    expect(within(row as HTMLElement).getByRole('img', { name: 'Will be set' })).toBeVisible();
  });

  it('warns when the power-on screen is Custom text and line 1 ends up empty', () => {
    renderEditor();
    expect(screen.queryByText(/line 1 is empty/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Power-on screen' }), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByRole('textbox', { name: 'Power-on line 1' }), {
      target: { value: 'ab' },
    });
    expect(screen.queryByText(/line 1 is empty/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Power-on line 1' }), {
      target: { value: '' },
    });
    expect(screen.getByText(/line 1 is empty/)).toBeInTheDocument();
    expect(screen.getAllByText(/8 characters or fewer use the large font/)).toHaveLength(2);
  });
});
