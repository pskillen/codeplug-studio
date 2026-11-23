import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { defaultModeProfile } from '@core/domain/modeProfiles.ts';
import type { ChannelModeProfile } from '@core/models/library.ts';
import { DesignSystemV2Provider } from '../../v2/index.ts';
import ModePanel from './ModePanel.tsx';
import { testModePanelContext } from './testContext.ts';

function renderPanel(profile: ChannelModeProfile, onPatch = vi.fn()) {
  render(
    <MemoryRouter>
      <DesignSystemV2Provider>
        <ModePanel profile={profile} onPatch={onPatch} context={testModePanelContext()} />
      </DesignSystemV2Provider>
    </MemoryRouter>,
  );
  return onPatch;
}

describe('AnalogModePanel bandwidth', () => {
  it('shows the FM bandwidth select and writes the chosen value to the profile', () => {
    const onPatch = renderPanel({
      ...defaultModeProfile('fm'),
      bandwidthKHz: 12.5,
    } as ChannelModeProfile);
    const select = screen.getByLabelText('Bandwidth (kHz)', { selector: 'input' });
    expect(select).toHaveValue('12.5 kHz');
    fireEvent.click(select);
    fireEvent.click(screen.getByRole('option', { name: '25 kHz' }));
    expect(onPatch).toHaveBeenCalledWith(expect.objectContaining({ bandwidthKHz: 25 }));
  });

  it('shows the bandwidth select for AM', () => {
    renderPanel(defaultModeProfile('am'));
    expect(screen.getByLabelText('Bandwidth (kHz)', { selector: 'input' })).toBeInTheDocument();
  });

  it('does not show a bandwidth select for DMR (fixed 12.5 kHz TDMA)', () => {
    renderPanel(defaultModeProfile('dmr'));
    expect(screen.queryByLabelText('Bandwidth (kHz)', { selector: 'input' })).toBeNull();
  });
});