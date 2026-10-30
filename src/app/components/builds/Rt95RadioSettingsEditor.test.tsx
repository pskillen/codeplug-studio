import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { RT95_BASIC_SETTINGS_FIELD_IDS } from '@core/radios/retevis/rt95/radioSettings.ts';
import { MemoryRouter } from 'react-router-dom';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import { DesignSystemV2Provider } from '../v2/index.ts';
import { clearAllOverrides } from '../../state/rt95RadioSettingsSession.ts';
import Rt95RadioSettingsEditor from './Rt95RadioSettingsEditor.tsx';

vi.mock('../../services/radioIoSession.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/radioIoSession.ts')>();
  return { ...actual, isRadioSerialSupported: () => true };
});

const { egress } = newRadioBuildForProfile('proj', 'radio-io-rt95');
const BUILD = 'build-rt95-editor';

describe('Rt95RadioSettingsEditor', () => {
  it("renders basic fields defaulting to Keep radio's value", () => {
    clearAllOverrides(BUILD);
    render(
      <MemoryRouter>
        <DesignSystemV2Provider>
          <Rt95RadioSettingsEditor buildId={BUILD} egress={egress} />
        </DesignSystemV2Provider>
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Read a radio' })).toBeInTheDocument();
    for (const id of ['startingDisplay', 'beepVolume', 'voxOnOff']) {
      expect(RT95_BASIC_SETTINGS_FIELD_IDS).toContain(id);
    }
    const select = screen.getByRole('combobox', { name: 'Beep Volume' }) as HTMLSelectElement;
    expect(select.value).toBe('keep');
  });
});
