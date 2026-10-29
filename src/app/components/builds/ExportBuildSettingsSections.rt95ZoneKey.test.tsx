import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import {
  radioBuildFormatExportDefaults,
  resolvedBuildExportSettings,
} from '../../lib/buildExportSettingsUi.ts';
import { DesignSystemV2Provider } from '../v2/index.ts';
import ExportBuildSettingsSections from './ExportBuildSettingsSections.tsx';

function show(profileId: string, patch = vi.fn(), zoneKey?: { group: 1 | 2; key: 1 }) {
  const { build, egress } = newRadioBuildForProfile('proj', profileId);
  if (zoneKey) build.exportSettings = { ...build.exportSettings, rt95ZoneKey: zoneKey };
  render(
    <MemoryRouter>
      <DesignSystemV2Provider>
        <ExportBuildSettingsSections
          build={build}
          formatId={egress.formatId}
          profileId={egress.profileId}
          saving={false}
          settingsError={null}
          resolvedSettings={resolvedBuildExportSettings(build)}
          formatDefaults={radioBuildFormatExportDefaults(build)}
          defaultScanValue="scan"
          onExportSettingsPatch={patch}
          onExportInclusionChange={vi.fn()}
        />
      </DesignSystemV2Provider>
    </MemoryRouter>,
  );
  return patch;
}

describe('Put Zone on a P-key setting', () => {
  it('is off by default and enabling it sets P1, group 1', () => {
    const patch = show('radio-io-rt95-mm9pdy');
    const toggle = screen.getByRole('switch', { name: 'Put Zone on a P-key' });
    expect(toggle).not.toBeChecked();
    fireEvent.click(toggle);
    expect(patch).toHaveBeenCalledWith({ rt95ZoneKey: { group: 1, key: 1 } });
  });

  it('shows the pickers when set', () => {
    show('radio-io-rt95-mm9pdy', vi.fn(), { group: 1, key: 1 });
    expect(screen.getByRole('radiogroup', { name: 'Zone key' })).toBeInTheDocument();
  });

  it('is absent on the stock RT95 target', () => {
    show('radio-io-rt95');
    expect(screen.queryByText('Put Zone on a P-key')).not.toBeInTheDocument();
  });
});
