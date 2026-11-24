import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { ChannelMode } from '@core/models/libraryTypes.ts';
import { defaultModeProfile } from '@core/domain/modeProfiles.ts';
import { emptyLibrary } from '@core/domain/factories.ts';
import { DesignSystemV2Provider } from '../../v2/index.ts';
import ModePanel from './ModePanel.tsx';
import { testModePanelContext } from './testContext.ts';

const DIGITAL_MODES: ChannelMode[] = ['dmr', 'nxdn', 'dstar', 'ysf', 'tetra', 'p25', 'm17'];

function renderMode(mode: ChannelMode) {
  render(
    <MemoryRouter>
      <DesignSystemV2Provider>
        <ModePanel
          profile={defaultModeProfile(mode)}
          onPatch={() => {}}
          context={testModePanelContext()}
        />
      </DesignSystemV2Provider>
    </MemoryRouter>,
  );
}

describe('ModePanel groups and layout', () => {
  it.each(DIGITAL_MODES)('%s shows Access, Call, Listen, You headings', (mode) => {
    renderMode(mode);
    const headings = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(headings).toEqual(['Access', 'Call', 'Listen', 'You']);
  });

  it('DMR uses Talk group or contact label', () => {
    renderMode('dmr');
    expect(
      screen.getByLabelText('Talk group or contact', { selector: 'input' }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('TX contact', { selector: 'input' })).toBeNull();
  });

  it('shows D-STAR, YSF and Tetra listen/you notes', () => {
    renderMode('dstar');
    expect(screen.getByText('Hears every call through the repeater.')).toBeInTheDocument();
    expect(screen.getByText('Your callsign is set on the radio.')).toBeInTheDocument();

    render(
      <MemoryRouter>
        <DesignSystemV2Provider>
          <ModePanel
            profile={defaultModeProfile('ysf')}
            onPatch={() => {}}
            context={testModePanelContext()}
          />
        </DesignSystemV2Provider>
      </MemoryRouter>,
    );
    expect(screen.getByText('Hears calls with the same DG-ID.')).toBeInTheDocument();

    render(
      <MemoryRouter>
        <DesignSystemV2Provider>
          <ModePanel
            profile={defaultModeProfile('tetra')}
            onPatch={() => {}}
            context={testModePanelContext()}
          />
        </DesignSystemV2Provider>
      </MemoryRouter>,
    );
    expect(screen.getByText('Hears its talk group.')).toBeInTheDocument();
    expect(screen.getByText('Your ISSI is set on the radio.')).toBeInTheDocument();
  });

  it('P25 and M17 show pending notes', () => {
    renderMode('p25');
    expect(screen.getByText(/Studio doesn't hold P25 settings yet/)).toBeInTheDocument();

    render(
      <MemoryRouter>
        <DesignSystemV2Provider>
          <ModePanel
            profile={defaultModeProfile('m17')}
            onPatch={() => {}}
            context={testModePanelContext()}
          />
        </DesignSystemV2Provider>
      </MemoryRouter>,
    );
    expect(screen.getByText(/Studio doesn't hold M17 settings yet/)).toBeInTheDocument();
  });

  it('analogue modes render no h3 headings', () => {
    for (const mode of ['fm', 'am', 'ssb'] as const) {
      render(
        <MemoryRouter>
          <DesignSystemV2Provider>
            <ModePanel
              profile={defaultModeProfile(mode)}
              onPatch={() => {}}
              context={testModePanelContext({ library: emptyLibrary() })}
            />
          </DesignSystemV2Provider>
        </MemoryRouter>,
      );
      expect(screen.queryAllByRole('heading', { level: 3 })).toHaveLength(0);
    }
  });

  it('FM lists TX tone before RX tone in the DOM', () => {
    renderMode('fm');
    const tx = screen.getByText('TX tone');
    const rx = screen.getByText('RX tone');
    const txBeforeRx = (tx.compareDocumentPosition(rx) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    expect(txBeforeRx).toBe(true);
  });
});
