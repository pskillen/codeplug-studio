import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AT_D890_SETTING_FIELDS,
  AT_D890_V1_SETTINGS_FIELD_IDS,
} from '@core/radios/anytone/at-d890uv/radioSettings.ts';
import { MemoryRouter } from 'react-router-dom';
import { DesignSystemV2Provider } from '../v2/index.ts';
import {
  clearAllOverrides,
  setRead,
  getAtD890RadioSettingsSession,
  setOverride,
} from '../../state/atD890RadioSettingsSession.ts';
import AtD890RadioSettingsEditor from './AtD890RadioSettingsEditor.tsx';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import * as readService from '../../services/radioIoAtD890SettingsRead.ts';

vi.mock('../../services/radioIoSession.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/radioIoSession.ts')>();
  return { ...actual, isRadioSerialSupported: () => true };
});

vi.mock('../../services/radioIoAtD890SettingsRead.ts', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../services/radioIoAtD890SettingsRead.ts')>();
  return { ...actual, readAtD890SettingsFromRadio: vi.fn() };
});

const { egress: D890_EGRESS } = newRadioBuildForProfile('proj', 'radio-io-at-d890uv');

const READ = {
  serial: 'ABCD1234567',
  masterIdName: 'DEMO-1',
  readAt: new Date(2026, 9, 26, 14, 2).getTime(),
  bandCode: 3,
  languageLock: 0 as const,
  decoded: {
    keyTone: { value: false, raw: [0] },
    smsFormat: { value: 1, raw: [1] },
    callDisplayMode: {
      value: undefined,
      raw: [2],
      label: 'Name based (the radio resets this at power-on)',
    },
  },
};

let BUILD = 'build-editor-0';
let buildSeq = 0;

function renderEditor(target: 'stock' | 'mm9pdy' = 'stock') {
  return render(
    <MemoryRouter>
      <DesignSystemV2Provider>
        <AtD890RadioSettingsEditor buildId={BUILD} target={target} egress={D890_EGRESS} />
      </DesignSystemV2Provider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  BUILD = `build-editor-${++buildSeq}`;
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
    for (const field of AT_D890_SETTING_FIELDS.filter((f) => !f.advanced)) {
      const control = screen.getByLabelText(field.label, { selector: '[id^="d890-setting-"]' });
      if (field.kind === 'text') {
        expect((control as HTMLInputElement).value).toBe('');
        expect((control as HTMLInputElement).placeholder).toBe("Keep radio's value");
      } else {
        expect((control as HTMLSelectElement).value).toBe('keep');
      }
    }
    expect(screen.getByTestId('changes-count')).toHaveTextContent('0 changes');
  }, 30_000);

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

  it('Read a radio fills the Radio column, banner and read-only rows, and changes no control', async () => {
    vi.mocked(readService.readAtD890SettingsFromRadio).mockResolvedValue(READ);
    renderEditor();
    expect(screen.getAllByText('not read').length).toBeGreaterThan(40);
    fireEvent.click(screen.getByRole('button', { name: 'Read a radio' }));
    const banner = await screen.findByTestId('read-banner');
    expect(banner).toHaveTextContent('Read from DEMO-1 (ABCD1234567) at');
    expect(banner).toHaveTextContent('range Amateur Europe');
    expect(banner).toHaveTextContent('Frequency range');
    expect(banner).toHaveTextContent('unknown');
    expect(within(banner).getByText('ABCD1234567')).toBeInTheDocument();
    expect(screen.getByText('Off', { selector: 'span' })).toBeInTheDocument();
    expect(screen.getByText(/Name based .* \(not offered\)/)).toBeInTheDocument();
    expect(screen.getByTestId('changes-count')).toHaveTextContent('0 changes');
    expect(getAtD890RadioSettingsSession(BUILD).overrides.size).toBe(0);
    expect((screen.getByRole('combobox', { name: 'Key tone' }) as HTMLSelectElement).value).toBe(
      'keep',
    );
    expect(await screen.findByText(/radio restarts/i)).toBeInTheDocument();
  });

  it('shows a read error in an alert and keeps the page as it was', async () => {
    vi.mocked(readService.readAtD890SettingsFromRadio).mockRejectedValue(
      new Error('No radio found'),
    );
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Read a radio' }));
    expect(await screen.findByText('No radio found')).toBeInTheDocument();
    expect(screen.queryByTestId('read-banner')).not.toBeInTheDocument();
  });

  it('keeps overrides when a read replaces the earlier one', () => {
    act(() => setOverride(BUILD, 'keyTone', true));
    act(() => setRead(BUILD, READ));
    renderEditor();
    expect(screen.getByTestId('changes-count')).toHaveTextContent('1 change');
    expect((screen.getByRole('combobox', { name: 'Key tone' }) as HTMLSelectElement).value).toBe(
      'on',
    );
  });

  it('shows the sticky footer only with changes, and Clear all asks first', async () => {
    renderEditor();
    expect(screen.queryByTestId('changes-footer')).not.toBeInTheDocument();
    act(() => setOverride(BUILD, 'keyTone', true));
    act(() => setOverride(BUILD, 'smsFormat', 2));
    const footer = screen.getByTestId('changes-footer');
    expect(footer).toHaveTextContent('2 changes');
    expect(footer).toHaveTextContent('Write settings');
    expect(within(footer).getByRole('link', { name: 'Back up a radio' })).toHaveAttribute(
      'href',
      `/builds/${BUILD}/backup`,
    );
    fireEvent.click(within(footer).getByRole('button', { name: 'Clear all' }));
    expect(getAtD890RadioSettingsSession(BUILD).overrides.size).toBe(2);
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Clear all' }));
    expect(getAtD890RadioSettingsSession(BUILD).overrides.size).toBe(0);
  });

  it('Copy all from this radio only exists after a read, and asks first', async () => {
    renderEditor();
    expect(screen.queryByRole('button', { name: 'Copy all from this radio' })).toBeNull();
    act(() => setRead(BUILD, READ));
    fireEvent.click(screen.getByRole('button', { name: 'Copy all from this radio' }));
    expect(getAtD890RadioSettingsSession(BUILD).overrides.size).toBe(0);
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent("Set 2 fields to this radio's values?");
    fireEvent.click(within(dialog).getByRole('button', { name: 'Copy all' }));
    const overrides = getAtD890RadioSettingsSession(BUILD).overrides;
    expect(overrides.get('keyTone')).toBe(false);
    expect(overrides.get('smsFormat')).toBe(1);
    expect(overrides.has('callDisplayMode')).toBe(false);
  });

  it('offers Cancel only once the port picker has closed', async () => {
    let onStage: ((stage: 'connecting' | 'reading') => void) | undefined;
    let signal: AbortSignal | undefined;
    vi.mocked(readService.readAtD890SettingsFromRadio).mockImplementation(
      (_egress, opts) =>
        new Promise((_resolve, reject) => {
          onStage = opts?.onStage;
          signal = opts?.signal;
          opts?.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
    );
    renderEditor();
    fireEvent.click(screen.getByRole('button', { name: 'Read a radio' }));
    expect(await screen.findByText(/Choose the radio in the port picker/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();

    act(() => onStage?.('connecting'));
    fireEvent.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(signal?.aborted).toBe(true);
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    // A cancelled read is not an error.
    expect(screen.queryByText('Could not read the radio')).not.toBeInTheDocument();
  });

  it('Copy all copies P1/P2 into overrides, which hides the step-key nudge (MM9PDY)', async () => {
    const read = {
      ...READ,
      decoded: {
        ...READ.decoded,
        keyShortP1: { value: 3, raw: [3] },
        keyShortP2: { value: 4, raw: [4] },
      },
    };
    act(() => setRead(BUILD, read));
    renderEditor('mm9pdy');
    expect(screen.getByTestId('mm9pdy-step-keys-nudge')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Copy all from this radio' }));
    const dialog = await screen.findByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Copy all' }));
    const overrides = getAtD890RadioSettingsSession(BUILD).overrides;
    expect(overrides.get('keyShortP1')).toBe(3);
    expect(overrides.get('keyShortP2')).toBe(4);
    // The user never chose a key layout, but the keys now equal the radio's: nudge stays quiet.
    expect(screen.queryByTestId('mm9pdy-step-keys-nudge')).not.toBeInTheDocument();
  });
});

describe('AtD890RadioSettingsEditor — range row (#1369)', () => {
  beforeEach(() => {
    BUILD = `build-editor-range-${++buildSeq}`;
    setRead(BUILD, READ);
  });

  it('links Change… to Danger zone and says so in the why text when the gate is open', () => {
    render(
      <MemoryRouter>
        <DesignSystemV2Provider>
          <AtD890RadioSettingsEditor
            buildId={BUILD}
            target="stock"
            egress={D890_EGRESS}
            dangerZoneOffered
          />
        </DesignSystemV2Provider>
      </MemoryRouter>,
    );
    const link = screen.getByRole('link', { name: 'Change…' });
    expect(link).toHaveAttribute('href', `/builds/${BUILD}/export/danger-zone`);
    expect(screen.getByText(/You can change it from Danger zone\./)).toBeInTheDocument();
    expect(screen.queryByText(/issue #1369/)).toBeNull();
  });

  it('shows no link and says Studio can only show it when the gate is closed', () => {
    renderEditor();
    expect(screen.queryByRole('link', { name: 'Change…' })).toBeNull();
    expect(screen.getByText(/Studio can only show it\./)).toBeInTheDocument();
    expect(screen.queryByText(/issue #1369/)).toBeNull();
  });
});
