import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import { DesignSystemV2Provider } from '../v2/index.ts';
import {
  clearAllOverrides,
  getAtD890RadioSettingsSession,
  setOverride,
  setRead,
  setShowAdvanced,
  type AtD890RadioSettingsRead,
} from '../../state/atD890RadioSettingsSession.ts';
import AtD890RadioSettingsEditor from './AtD890RadioSettingsEditor.tsx';

vi.mock('../../services/radioIoSession.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/radioIoSession.ts')>();
  return { ...actual, isRadioSerialSupported: () => true };
});

vi.setConfig({ testTimeout: 30_000 });

const { egress: D890_EGRESS } = newRadioBuildForProfile('proj', 'radio-io-at-d890uv');

function readWith(
  languageLock: 0 | 1 | 2,
  decoded: AtD890RadioSettingsRead['decoded'] = {},
): AtD890RadioSettingsRead {
  return {
    serial: 'ABCD1234567',
    masterIdName: 'DEMO-1',
    readAt: new Date(2026, 9, 26, 14, 2).getTime(),
    bandCode: 3,
    languageLock,
    decoded,
  };
}

let BUILD = 'build-adv-0';
let seq = 0;

function renderEditor() {
  return render(
    <MemoryRouter>
      <DesignSystemV2Provider>
        <AtD890RadioSettingsEditor buildId={BUILD} target="stock" egress={D890_EGRESS} />
      </DesignSystemV2Provider>
    </MemoryRouter>,
  );
}

function showAdvanced() {
  fireEvent.click(screen.getByRole('checkbox', { name: 'Show advanced settings' }));
}

beforeEach(() => {
  BUILD = `build-adv-${++seq}`;
  clearAllOverrides(BUILD);
  setShowAdvanced(BUILD, false);
});

afterEach(() => {
  clearAllOverrides(BUILD);
  setShowAdvanced(BUILD, false);
});

describe('AtD890RadioSettingsEditor advanced settings', () => {
  it('hides every advanced row until the switch is on, and shows them after', () => {
    renderEditor();
    expect(screen.queryByTestId('advanced-rows')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Language')).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Working mode' })).toBeNull();
    showAdvanced();
    expect(screen.getByTestId('advanced-rows')).toBeInTheDocument();
    for (const name of [
      'Language',
      'Working mode',
      'Repeater mode',
      'Accept remote stun/kill',
      'Accept remote monitor',
      'Answer GPS position requests',
      'Encryption type',
      'Auto repeater A',
      'Auto repeater B',
    ]) {
      expect(screen.getByRole('combobox', { name }), name).toBeInTheDocument();
    }
    expect(screen.getByLabelText('New power-on password')).toBeInTheDocument();
  });

  it('is off by default and not kept in the project', () => {
    renderEditor();
    expect(getAtD890RadioSettingsSession(BUILD).showAdvanced).toBe(false);
    showAdvanced();
    expect(getAtD890RadioSettingsSession(BUILD).showAdvanced).toBe(true);
  });

  it('switching off with nothing set just hides; with changes set it asks and then discards them', async () => {
    renderEditor();
    showAdvanced();
    fireEvent.change(screen.getByRole('combobox', { name: 'Working mode' }), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Key tone' }), {
      target: { value: 'on' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: 'Show advanced settings' }));
    // Still on until the user confirms.
    expect(getAtD890RadioSettingsSession(BUILD).overrides.get('professionalMode')).toBe(1);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('discards 1 advanced change');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Hide and discard' }));
    const session = getAtD890RadioSettingsSession(BUILD);
    expect(session.showAdvanced).toBe(false);
    expect(session.overrides.has('professionalMode')).toBe(false);
    expect(session.overrides.get('keyTone')).toBe(true);
  });

  it('shows the field warning once the field is set', () => {
    renderEditor();
    showAdvanced();
    const row = screen.getByRole('combobox', { name: 'Working mode' }).closest('[data-field-id]')!;
    expect(within(row as HTMLElement).queryByTestId('field-warning')).toBeNull();
    fireEvent.change(screen.getByRole('combobox', { name: 'Working mode' }), {
      target: { value: '1' },
    });
    expect(within(row as HTMLElement).getByTestId('field-warning')).toHaveTextContent(
      'Hides VFO and most menus. Set it back to Amateur here to undo.',
    );
  });

  describe('language', () => {
    it("can't be set before a read", () => {
      renderEditor();
      showAdvanced();
      const select = screen.getByRole('combobox', { name: 'Language' });
      expect(select).toBeDisabled();
      expect(screen.getByText(/Read the radio first/)).toBeInTheDocument();
    });

    it.each([
      [0, ['Keep radio’s value'.replace('’', "'"), 'English', 'Chinese', 'Russian']],
      [1, ["Keep radio's value", 'English']],
      [2, ["Keep radio's value", 'Chinese']],
    ] as const)('lock %i offers only what the radio keeps', (lock, labels) => {
      act(() => setRead(BUILD, readWith(lock)));
      renderEditor();
      showAdvanced();
      const select = screen.getByRole('combobox', { name: 'Language' });
      expect(select).toBeEnabled();
      expect([...select.querySelectorAll('option')].map((o) => o.textContent)).toEqual([...labels]);
    });

    it('keeps a language the read radio forbids visible, marked, with a red line', () => {
      act(() => setOverride(BUILD, 'language', 2));
      act(() => setShowAdvanced(BUILD, true));
      act(() => setRead(BUILD, readWith(1)));
      renderEditor();
      const select = screen.getByRole('combobox', { name: 'Language' }) as HTMLSelectElement;
      expect(select.value).toBe('2');
      expect(
        within(select).getByRole('option', { name: 'Russian (not allowed here)' }),
      ).toBeTruthy();
      expect(screen.getByRole('alert')).toHaveTextContent(/region doesn't allow that language/);
    });
  });

  describe('power-on password', () => {
    const typeBoth = (a: string, b: string) => {
      fireEvent.change(screen.getByLabelText('New power-on password'), { target: { value: a } });
      fireEvent.change(screen.getByLabelText('Type the power-on password again'), {
        target: { value: b },
      });
    };

    it('only sets the pair once the digits are valid and typed twice the same', () => {
      renderEditor();
      showAdvanced();
      typeBoth('4821', '4820');
      expect(screen.getByText('The two entries do not match.')).toBeInTheDocument();
      expect(getAtD890RadioSettingsSession(BUILD).overrides.size).toBe(0);
      typeBoth('48a1', '48a1');
      expect(screen.getByText(/Digits only/)).toBeInTheDocument();
      expect(getAtD890RadioSettingsSession(BUILD).overrides.size).toBe(0);
      typeBoth('123456789', '123456789');
      expect(getAtD890RadioSettingsSession(BUILD).overrides.size).toBe(0);
      typeBoth('4821', '4821');
      const overrides = getAtD890RadioSettingsSession(BUILD).overrides;
      expect(overrides.get('powerOnPasswordEnabled')).toBe(true);
      expect(overrides.get('powerOnPasswordDigits')).toBe('4821');
      expect(screen.getByTestId('changes-count')).toHaveTextContent('1 change');
      expect(screen.getByTestId('field-warning')).toHaveTextContent(
        "The radio won't start until this is typed. Write it down.",
      );
    });

    it('shows the digits in clear', () => {
      renderEditor();
      showAdvanced();
      typeBoth('4821', '4821');
      expect((screen.getByLabelText('New power-on password') as HTMLInputElement).type).toBe(
        'text',
      );
      expect((screen.getByLabelText('New power-on password') as HTMLInputElement).value).toBe(
        '4821',
      );
    });

    it('a broken edit after a good one goes back to Keep (the latest action wins)', () => {
      renderEditor();
      showAdvanced();
      typeBoth('4821', '4821');
      fireEvent.change(screen.getByLabelText('Type the power-on password again'), {
        target: { value: '482' },
      });
      expect(getAtD890RadioSettingsSession(BUILD).overrides.size).toBe(0);
    });

    it('Clear password works without a read: enable off and empty digits', () => {
      renderEditor();
      showAdvanced();
      fireEvent.click(screen.getByRole('button', { name: 'Clear password' }));
      const overrides = getAtD890RadioSettingsSession(BUILD).overrides;
      expect(overrides.get('powerOnPasswordEnabled')).toBe(false);
      expect(overrides.get('powerOnPasswordDigits')).toBe('');
      expect(screen.getByTestId('password-will-clear')).toBeInTheDocument();
      expect(screen.getByTestId('changes-count')).toHaveTextContent('1 change');
    });

    it('typing after Clear password replaces it with the new password', () => {
      renderEditor();
      showAdvanced();
      fireEvent.click(screen.getByRole('button', { name: 'Clear password' }));
      typeBoth('1234', '1234');
      expect(getAtD890RadioSettingsSession(BUILD).overrides.get('powerOnPasswordEnabled')).toBe(
        true,
      );
    });

    it("shows the radio's on/off state but never its digits", () => {
      act(() =>
        setRead(
          BUILD,
          readWith(0, {
            powerOnPasswordEnabled: { value: true, raw: [1] },
            powerOnPasswordDigits: { value: '9876', raw: [0x39, 0x38, 0x37, 0x36, 0, 0, 0, 0] },
          }),
        ),
      );
      renderEditor();
      showAdvanced();
      const row = screen
        .getByLabelText('New power-on password')
        .closest('[data-field-id]') as HTMLElement;
      expect(row).toHaveTextContent('Radio: On');
      expect(row).not.toHaveTextContent('9876');
    });
  });
});
