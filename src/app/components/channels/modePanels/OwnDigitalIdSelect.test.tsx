import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { defaultModeProfile } from '@core/domain/modeProfiles.ts';
import { emptyLibrary } from '@core/domain/factories.ts';
import type {
  ChannelModeProfile,
  ChannelModeProfileDMR,
  ChannelModeProfileNxdn,
  OwnDigitalId,
} from '@core/models/library.ts';
import { DesignSystemV2Provider } from '../../v2/index.ts';
import ModePanel from './ModePanel.tsx';
import { testModePanelContextWithLibrary } from './testContext.ts';

function ownId(over: Partial<OwnDigitalId> & Pick<OwnDigitalId, 'id' | 'protocol' | 'number'>) {
  return {
    projectId: 'p1',
    revision: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
    name: '',
    isDefault: false,
    ...over,
  } as OwnDigitalId;
}

const library = {
  ...emptyLibrary(),
  ownDigitalIds: [
    ownId({ id: 'd-home', protocol: 'dmr', number: 1234567, name: 'Home', isDefault: true }),
    ownId({ id: 'd-club', protocol: 'dmr', number: 7654321, name: 'Club' }),
    ownId({ id: 'n-home', protocol: 'nxdn', number: 1234, name: 'Home NXDN', isDefault: true }),
  ],
};

function renderPanel(profile: ChannelModeProfile, onPatch = vi.fn()) {
  render(
    <MemoryRouter>
      <DesignSystemV2Provider>
        <ModePanel
          profile={profile}
          onPatch={onPatch}
          context={testModePanelContextWithLibrary(library)}
        />
      </DesignSystemV2Provider>
    </MemoryRouter>,
  );
  return onPatch;
}

describe('OwnDigitalIdSelect via mode panels', () => {
  it('DMR ID select shows the default, and lists Default plus DMR IDs only', () => {
    renderPanel(defaultModeProfile('dmr') as ChannelModeProfileDMR);
    const select = screen.getByLabelText('DMR ID', { selector: 'input' });
    expect(select).toHaveValue('Default (Home (1234567))');
    fireEvent.click(select);
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toContain('Home (1234567)');
    expect(options).toContain('Club (7654321)');
    expect(options).not.toContain('Home NXDN (1234)');
    expect(screen.getByRole('link', { name: 'Manage Digital IDs' })).toHaveAttribute(
      'href',
      '/library/digital-ids',
    );
  });

  it('choosing a DMR ID patches ownDigitalIdId', () => {
    const onPatch = renderPanel(defaultModeProfile('dmr') as ChannelModeProfileDMR);
    fireEvent.click(screen.getByLabelText('DMR ID', { selector: 'input' }));
    fireEvent.click(screen.getByRole('option', { name: 'Club (7654321)' }));
    expect(onPatch).toHaveBeenLastCalledWith(expect.objectContaining({ ownDigitalIdId: 'd-club' }));
  });

  it('NXDN Unit ID select lists NXDN IDs only and Default goes back to null', () => {
    const profile: ChannelModeProfileNxdn = {
      ...(defaultModeProfile('nxdn') as ChannelModeProfileNxdn),
      ownDigitalIdId: 'n-home',
    };
    const onPatch = renderPanel(profile);
    const select = screen.getByLabelText('Unit ID', { selector: 'input' });
    expect(select).toHaveValue('Home NXDN (1234)');
    fireEvent.click(select);
    const options = screen.getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['Default (Home NXDN (1234))', 'Home NXDN (1234)']);
    fireEvent.click(screen.getByRole('option', { name: 'Default (Home NXDN (1234))' }));
    expect(onPatch).toHaveBeenLastCalledWith(expect.objectContaining({ ownDigitalIdId: null }));
  });

  it('shows (missing) for a choice that is not in Digital IDs', () => {
    renderPanel({
      ...(defaultModeProfile('dmr') as ChannelModeProfileDMR),
      ownDigitalIdId: 'gone',
    });
    expect(screen.getByLabelText('DMR ID', { selector: 'input' })).toHaveValue('(missing)');
  });
});