import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import { DesignSystemV2Provider } from '../v2/index.ts';
import { getAtD890RadioSettingsSession, setRead } from '../../state/atD890RadioSettingsSession.ts';
import AtD890RadioSettingsEditor from './AtD890RadioSettingsEditor.tsx';
import Mm9pdyStepKeysNudge from './Mm9pdyStepKeysNudge.tsx';

vi.mock('../../services/radioIoSession.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/radioIoSession.ts')>();
  return { ...actual, isRadioSerialSupported: () => true };
});

const NUDGE = /aren.t set to TG previous \/ next/;

function nudge(props: Partial<React.ComponentProps<typeof Mm9pdyStepKeysNudge>> = {}) {
  const onUse = vi.fn();
  render(
    <DesignSystemV2Provider>
      <Mm9pdyStepKeysNudge target="mm9pdy" hasRead readP1={3} readP2={4} onUse={onUse} {...props} />
    </DesignSystemV2Provider>,
  );
  return { onUse };
}

describe('Mm9pdyStepKeysNudge', () => {
  it('is hidden on the stock target', () => {
    nudge({ target: 'stock' });
    expect(screen.queryByText(NUDGE)).not.toBeInTheDocument();
  });

  it('is hidden before a read', () => {
    nudge({ hasRead: false, readP1: undefined, readP2: undefined });
    expect(screen.queryByText(NUDGE)).not.toBeInTheDocument();
  });

  it('is hidden when the radio already has TG next on P1 and TG previous on P2', () => {
    nudge({ readP1: 14, readP2: 13 });
    expect(screen.queryByText(NUDGE)).not.toBeInTheDocument();
    expect(screen.queryByText(/all good|✓/i)).not.toBeInTheDocument();
  });

  it('is shown when only one key differs', () => {
    nudge({ readP1: 14, readP2: 4 });
    expect(screen.getByText(NUDGE)).toBeInTheDocument();
  });

  it('is hidden once the session overrides either key (the nudge, or a layout of the user own)', () => {
    nudge({ overrideP1: 14, overrideP2: 13 });
    expect(screen.queryByText(NUDGE)).not.toBeInTheDocument();
  });

  it('is hidden when only one key is overridden', () => {
    nudge({ overrideP1: 10 });
    expect(screen.queryByText(NUDGE)).not.toBeInTheDocument();
  });

  it('calls onUse from the button', () => {
    const { onUse } = nudge();
    expect(screen.getByText(NUDGE)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Use MM9PDY step keys' }));
    expect(onUse).toHaveBeenCalledTimes(1);
  });
});

describe('step-key nudge on the settings page', () => {
  const { egress } = newRadioBuildForProfile('proj', 'radio-io-at-d890uv-mm9pdy');
  const read = (p1: number, p2: number) => ({
    serial: 'SN',
    masterIdName: 'DEMO',
    readAt: 1,
    bandCode: 3,
    languageLock: 0 as const,
    decoded: {
      keyShortP1: { value: p1, raw: [p1] },
      keyShortP2: { value: p2, raw: [p2] },
    },
  });

  function renderEditor(buildId: string, target: 'stock' | 'mm9pdy') {
    return render(
      <MemoryRouter>
        <DesignSystemV2Provider>
          <AtD890RadioSettingsEditor buildId={buildId} target={target} egress={egress} />
        </DesignSystemV2Provider>
      </MemoryRouter>,
    );
  }

  it('sets exactly the two ordinary overrides and then disappears', () => {
    setRead('nudge-1', read(3, 4));
    renderEditor('nudge-1', 'mm9pdy');
    fireEvent.click(screen.getByRole('button', { name: 'Use MM9PDY step keys' }));
    const overrides = getAtD890RadioSettingsSession('nudge-1').overrides;
    expect([...overrides.entries()]).toEqual([
      ['keyShortP1', 14],
      ['keyShortP2', 13],
    ]);
    expect(screen.queryByText(NUDGE)).not.toBeInTheDocument();
    // Ordinary overrides: the rows show them and the user can change one.
    const p1 = screen.getByRole('combobox', { name: 'P1 short press' }) as HTMLSelectElement;
    expect(p1.value).toBe('14');
    expect([...p1.options].find((o) => o.value === '14')?.text).toBe('TG Next');
    fireEvent.change(p1, { target: { value: '10' } });
    expect(getAtD890RadioSettingsSession('nudge-1').overrides.get('keyShortP1')).toBe(10);
    expect(screen.queryByText(NUDGE)).not.toBeInTheDocument();
  });

  it('shows nothing when the read keys already are TG keys', () => {
    setRead('nudge-2', read(14, 13));
    renderEditor('nudge-2', 'mm9pdy');
    expect(screen.queryByText(NUDGE)).not.toBeInTheDocument();
  });

  it('never shows on the stock target', () => {
    act(() => setRead('nudge-3', read(3, 4)));
    renderEditor('nudge-3', 'stock');
    expect(screen.queryByText(NUDGE)).not.toBeInTheDocument();
  });
});
