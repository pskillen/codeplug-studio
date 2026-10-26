import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import * as featureDetect from '@integrations/radio-io/transport/featureDetect.ts';
import { setRead, clearAllOverrides } from '../../state/atD890RadioSettingsSession.ts';
import { DesignSystemV2Provider } from '../../components/v2/index.ts';
import { BuildLayoutProvider } from './BuildLayoutContext.tsx';
import BuildRadioSettingsPage, {
  RADIO_SETTINGS_ONLY_D890_MESSAGE,
} from './BuildRadioSettingsPage.tsx';

vi.mock('../../services/radioIoSession.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../services/radioIoSession.ts')>();
  return { ...actual, isRadioSerialSupported: () => true };
});

vi.mock('@integrations/radio-io/transport/featureDetect.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof featureDetect>();
  return { ...actual, isCapacitorSerialSupported: vi.fn(() => false) };
});

const READ = {
  serial: 'ABCD1234567',
  masterIdName: 'DEMO-1',
  readAt: new Date(2026, 9, 26, 14, 2).getTime(),
  bandCode: 3,
  languageLock: 0 as const,
  decoded: {},
};

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

  describe('Danger zone Change… link', () => {
    afterEach(() => {
      clearAllOverrides('page-radio-io-at-d890uv');
      clearAllOverrides('page-radio-io-at-d890uv-mm9pdy');
      vi.mocked(featureDetect.isCapacitorSerialSupported).mockReturnValue(false);
    });

    it('is wired from the page for both D890 targets', () => {
      for (const profile of ['radio-io-at-d890uv', 'radio-io-at-d890uv-mm9pdy']) {
        act(() => setRead(`page-${profile}`, READ));
        const { unmount } = renderPage(profile);
        expect(screen.getByRole('link', { name: 'Change…' })).toHaveAttribute(
          'href',
          `/builds/page-${profile}/export/danger-zone`,
        );
        unmount();
      }
    });

    it('is absent in the native app (Capacitor)', () => {
      vi.mocked(featureDetect.isCapacitorSerialSupported).mockReturnValue(true);
      act(() => setRead('page-radio-io-at-d890uv', READ));
      renderPage('radio-io-at-d890uv');
      expect(screen.getByText('Frequency range')).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: 'Change…' })).toBeNull();
    });
  });
});
