import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import { parseAirSecuritySeedInput } from '@integrations/radio-io/radios/at-d890uv/airSecuritySeed.ts';
import { DesignSystemV2Provider } from '../v2/index.ts';
import AtD890AirSecuritySeedCard from './AtD890AirSecuritySeedCard.tsx';
import {
  checkAtD890AirSecuritySeed,
  writeAtD890AirSecuritySeedOnRadio,
} from '../../services/radioIoAtD890AirSecuritySession.ts';

vi.mock('../../services/radioIoAtD890AirSecuritySession.ts', () => ({
  checkAtD890AirSecuritySeed: vi.fn(),
  writeAtD890AirSecuritySeedOnRadio: vi.fn(),
}));

vi.mock('../../services/radioIoSession.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/radioIoSession.ts')>();
  return { ...actual, isRadioSerialSupported: () => true };
});

const BAD = 'gezd 1bnv';
const GOOD = 'gezd gnbv gy3t qojq gezd gnbv gy3t qojq';
const SEED = new TextEncoder().encode('12345678901234567890');
const ENTRY_WARNING =
  'Backups contain the seed. Clearing the seed does not remove it from backups you have already taken.';
const WRITTEN_NOTE = 'Seed written. The radio restarts; wait about 20 seconds.';
const CLEARED_NOTE = 'Seed cleared. The radio restarts; wait about 20 seconds.';

const { egress } = newRadioBuildForProfile('p', 'radio-io-at-d890uv-mm9pdy');

function renderCard() {
  return render(
    <DesignSystemV2Provider>
      <AtD890AirSecuritySeedCard egress={egress} />
    </DesignSystemV2Provider>,
  );
}

function seedField() {
  return screen.getByLabelText('AirSecurity seed');
}

beforeEach(() => {
  vi.mocked(checkAtD890AirSecuritySeed).mockReset();
  vi.mocked(writeAtD890AirSecuritySeedOnRadio).mockReset();
});

describe('AtD890AirSecuritySeedCard', () => {
  it('masks the seed, shows the backup warning, and starts as Not checked', () => {
    renderCard();
    const input = seedField();
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveAttribute('autocomplete', 'off');
    expect(input).toHaveAttribute('placeholder', 'Paste the Selfcare text or the otpauth:// link');
    expect(screen.getByText('Not checked')).toBeInTheDocument();
    expect(screen.getByText(ENTRY_WARNING)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Write seed' })).toBeDisabled();
  });

  it('shows the refusal for a bad paste, keeps Write off, and does not repeat the paste', () => {
    renderCard();
    fireEvent.change(seedField(), { target: { value: BAD } });
    const parsed = parseAirSecuritySeedInput(BAD);
    expect(parsed.ok).toBe(false);
    if (parsed.ok) return;
    expect(parsed.reason).not.toContain(BAD);
    expect(screen.getByText(parsed.reason)).toBeInTheDocument();
    expect(screen.getByText(parsed.reason).textContent).not.toContain(BAD);
    expect(screen.getByRole('button', { name: 'Write seed' })).toBeDisabled();
    expect(document.body.textContent).not.toContain('12345678901234567890');
  });

  it('enables Write for a good paste and writes the 20 bytes, then forgets them', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    let written: Uint8Array | null = null;
    vi.mocked(writeAtD890AirSecuritySeedOnRadio).mockImplementation(async (_egress, seed) => {
      written = seed === null ? null : Uint8Array.from(seed);
    });
    renderCard();
    fireEvent.change(seedField(), { target: { value: GOOD } });
    expect(screen.getByRole('button', { name: 'Write seed' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Write seed' }));
    await waitFor(() => expect(screen.getByText('Seed set')).toBeInTheDocument());
    expect(Array.from(written ?? [])).toEqual(Array.from(SEED));
    expect(seedField()).toHaveValue('');
    expect(screen.getByText(WRITTEN_NOTE)).toBeInTheDocument();
    expect(checkAtD890AirSecuritySeed).not.toHaveBeenCalled();
    expect(setItem).not.toHaveBeenCalled();
    expect(document.body.textContent).not.toContain(GOOD);
    expect(document.body.textContent).not.toContain('12345678901234567890');
    setItem.mockRestore();
  });

  it('clears the seed and shows No seed', async () => {
    let written: Uint8Array | null | undefined;
    vi.mocked(writeAtD890AirSecuritySeedOnRadio).mockImplementation(async (_egress, seed) => {
      written = seed;
    });
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Clear seed' }));
    await waitFor(() => expect(screen.getByText('No seed')).toBeInTheDocument());
    expect(written).toBeNull();
    expect(screen.getByText(CLEARED_NOTE)).toBeInTheDocument();
    expect(checkAtD890AirSecuritySeed).not.toHaveBeenCalled();
  });

  it('shows the state Check radio returns', async () => {
    vi.mocked(checkAtD890AirSecuritySeed).mockResolvedValueOnce(true);
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Check radio' }));
    await waitFor(() => expect(screen.getByText('Seed set')).toBeInTheDocument());
    vi.mocked(checkAtD890AirSecuritySeed).mockResolvedValueOnce(false);
    fireEvent.click(screen.getByRole('button', { name: 'Check radio' }));
    await waitFor(() => expect(screen.getByText('No seed')).toBeInTheDocument());
    expect(writeAtD890AirSecuritySeedOnRadio).not.toHaveBeenCalled();
  });

  it('shows a radio error and does not include the paste', async () => {
    vi.mocked(writeAtD890AirSecuritySeedOnRadio).mockRejectedValueOnce(
      new Error('The radio did not answer.'),
    );
    renderCard();
    fireEvent.change(seedField(), { target: { value: GOOD } });
    fireEvent.click(screen.getByRole('button', { name: 'Write seed' }));
    expect(await screen.findByText('The radio did not answer.')).toBeInTheDocument();
    expect(screen.getByText('The radio did not answer.').textContent).not.toContain(GOOD);
    expect(screen.queryByText('Seed set')).not.toBeInTheDocument();
    expect(seedField()).toHaveValue(GOOD);
  });
});
