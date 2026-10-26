import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import { DesignSystemV2Provider } from '../../../components/v2/index.ts';
import { BuildLayoutProvider } from '../BuildLayoutContext.tsx';
import BuildRadioToolsPage from './BuildRadioToolsPage.tsx';
import * as gate from '../../../services/radioTools/gate.ts';

afterEach(() => vi.restoreAllMocks());

function renderPage(profileId: string, buildEnv: string) {
  const { build, egressPaths, egress } = newRadioBuildForProfile('proj', profileId);
  const real = gate.listOfferedRadioTools;
  vi.spyOn(gate, 'listOfferedRadioTools').mockImplementation((id) => real(id, buildEnv));
  render(
    <MemoryRouter initialEntries={[`/builds/${build.id}/export/radio-tools`]}>
      <BuildLayoutProvider
        value={{
          build,
          buildId: build.id,
          egressPaths,
          activeEgress: egress,
          setActiveEgressId: () => {},
          reloadEgressPaths: async () => {},
        }}
      >
        <DesignSystemV2Provider>
          <Routes>
            <Route path="/builds/:id/export/radio-tools" element={<BuildRadioToolsPage />} />
            <Route path="/builds/:id/export" element={<p>EXPORT PAGE</p>} />
          </Routes>
        </DesignSystemV2Provider>
      </BuildLayoutProvider>
    </MemoryRouter>,
  );
}

describe('BuildRadioToolsPage', () => {
  it('lists the D890 range tool under the strap, with no Start button', () => {
    renderPage('radio-io-at-d890uv', 'dev');
    expect(screen.getByRole('heading', { level: 1, name: 'Radio tools' })).toBeInTheDocument();
    expect(
      screen.getByText("These change the radio itself. A Write can't undo them."),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Change frequency range' })).toBeInTheDocument();
    expect(screen.getByText(/About 10 minutes/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Start/ })).toBeNull();
    expect(screen.queryByText(/coming soon/i)).toBeNull();
  });

  it('redirects to Export on the prod site', () => {
    renderPage('radio-io-at-d890uv', 'prod');
    expect(screen.getByText('EXPORT PAGE')).toBeInTheDocument();
  });

  it('redirects to Export for a DM-32 build', () => {
    renderPage('radio-io-dm32uv', 'dev');
    expect(screen.getByText('EXPORT PAGE')).toBeInTheDocument();
  });
});
