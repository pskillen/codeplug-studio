import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { defaultModeProfile } from '@core/domain/modeProfiles.ts';
import { emptyLibrary } from '@core/domain/factories.ts';
import type { ChannelModeProfile } from '@core/models/library.ts';
import { DesignSystemV2Provider } from '../v2/index.ts';
import ChannelModeProfilesEditor from './ChannelModeProfilesEditor.tsx';

function renderEditor(profile: ChannelModeProfile, onChange = vi.fn()) {
  render(
    <MemoryRouter>
      <DesignSystemV2Provider>
        <ChannelModeProfilesEditor
          profiles={[profile]}
          library={emptyLibrary()}
          rxFrequency={null}
          txFrequency={null}
          onChange={onChange}
        />
      </DesignSystemV2Provider>
    </MemoryRouter>,
  );
  return onChange;
}

describe('ChannelModeProfilesEditor bandwidth', () => {
  it('shows the FM bandwidth select and writes the chosen value to the profile', () => {
    const onChange = renderEditor({
      ...defaultModeProfile('fm'),
      bandwidthKHz: 12.5,
    } as ChannelModeProfile);
    const select = screen.getByLabelText('Bandwidth (kHz)', { selector: 'input' });
    expect(select).toHaveValue('12.5 kHz');
    fireEvent.click(select);
    fireEvent.click(screen.getByRole('option', { name: '25 kHz' }));
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ mode: 'fm', bandwidthKHz: 25 }),
    ]);
  });

  it('shows the bandwidth select for AM', () => {
    renderEditor(defaultModeProfile('am'));
    expect(screen.getByLabelText('Bandwidth (kHz)', { selector: 'input' })).toBeInTheDocument();
  });

  it('explains where bandwidth lives when no mode is selected yet', () => {
    render(
      <MemoryRouter>
        <DesignSystemV2Provider>
          <ChannelModeProfilesEditor
            profiles={[]}
            library={emptyLibrary()}
            rxFrequency={null}
            txFrequency={null}
            onChange={vi.fn()}
          />
        </DesignSystemV2Provider>
      </MemoryRouter>,
    );
    expect(
      screen.getByText(/Bandwidth, tones and squelch appear for analogue modes/),
    ).toBeVisible();
    expect(screen.queryByLabelText('Bandwidth (kHz)', { selector: 'input' })).toBeNull();
  });

  it('does not show a bandwidth select for DMR (fixed 12.5 kHz TDMA)', () => {
    renderEditor(defaultModeProfile('dmr'));
    expect(screen.queryByLabelText('Bandwidth (kHz)', { selector: 'input' })).toBeNull();
  });
});
