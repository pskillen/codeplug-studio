import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import { DesignSystemV2Provider } from '../../components/v2/index.ts';
import { BuildLayoutProvider } from './BuildLayoutContext.tsx';
import BuildRadioSettingsPage, {
  RADIO_SETTINGS_ONLY_D890_MESSAGE,
} from './BuildRadioSettingsPage.tsx';

vi.mock('../../services/radioIoSession.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/radioIoSession.ts')>();
  return { ...actual, isRadioSerialSupported: () => true };
});

function renderPage(profileId: string) {
  const { build, egress } = newRadioBuildForProfile('proj', profileId);
  return render(
    <MemoryRouter>
      <BuildLayoutProvider
        value={{
          build,
          buildId: `page-${profileId}`,
          egressPaths: [egress],
          activeEgress: egress,
          setActiveEgressId: () => {},
          reloadEgressPaths: async () => {},
        }}
      >
        <DesignSystemV2Provider>
          <BuildRadioSettingsPage />
        </DesignSystemV2Provider>
      </BuildLayoutProvider>
    </MemoryRouter>,
  );
}

describe('BuildRadioSettingsPage', () => {
  it('says settings are only available for the AT-D890UV on another radio', () => {
    renderPage('radio-io-uv5r-mini');
    expect(screen.getByText(RADIO_SETTINGS_ONLY_D890_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Read a radio' })).not.toBeInTheDocument();
  });

  it('shows the editor for a stock D890, with a plain title', () => {
    renderPage('radio-io-at-d890uv');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      /^Radio settings — AT-D890UV$/,
    );
    expect(screen.getByRole('button', { name: 'Read a radio' })).toBeInTheDocument();
    expect(screen.queryByText(RADIO_SETTINGS_ONLY_D890_MESSAGE)).not.toBeInTheDocument();
  });

  it('adds the MM9PDY firmware to the title for an MM9PDY D890', () => {
    renderPage('radio-io-at-d890uv-mm9pdy');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Radio settings — AT-D890UV (MM9PDY firmware)',
    );
  });
});
