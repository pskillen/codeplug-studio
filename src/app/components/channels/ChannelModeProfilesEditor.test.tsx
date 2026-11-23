import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { defaultModeProfile } from '@core/domain/modeProfiles.ts';
import { emptyLibrary } from '@core/domain/factories.ts';
import { DesignSystemV2Provider } from '../v2/index.ts';
import ChannelModeProfilesEditor from './ChannelModeProfilesEditor.tsx';

describe('ChannelModeProfilesEditor', () => {
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

  it('renders a header per profile and merges patches into onChange', () => {
    const onChange = vi.fn();
    render(
      <MemoryRouter>
        <DesignSystemV2Provider>
          <ChannelModeProfilesEditor
            profiles={[defaultModeProfile('fm'), defaultModeProfile('dmr')]}
            library={emptyLibrary()}
            rxFrequency={null}
            txFrequency={null}
            onChange={onChange}
          />
        </DesignSystemV2Provider>
      </MemoryRouter>,
    );
    expect(screen.getByText('FM settings')).toBeInTheDocument();
    expect(screen.getByText('DMR settings')).toBeInTheDocument();
    fireEvent.click(screen.getAllByLabelText('Bandwidth (kHz)', { selector: 'input' })[0]!);
    fireEvent.click(screen.getByRole('option', { name: '25 kHz' }));
    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ mode: 'fm', bandwidthKHz: 25 }),
      expect.objectContaining({ mode: 'dmr' }),
    ]);
  });
});
