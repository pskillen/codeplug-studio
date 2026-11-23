import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { defaultModeProfile } from '@core/domain/modeProfiles.ts';
import { emptyLibrary, newChannel, newTalkGroup } from '@core/domain/factories.ts';
import { DesignSystemV2Provider } from '../v2/index.ts';
import ChannelModeSummaries from './ChannelModeSummaries.tsx';

const projectId = 'test';
const lookup = {
  ...emptyLibrary(),
  talkGroups: [newTalkGroup(projectId, 'Scotland', 2351, 'dmr')],
};

describe('ChannelModeSummaries', () => {
  it('returns null when the channel has no modes', () => {
    render(
      <DesignSystemV2Provider>
        <ChannelModeSummaries
          channel={newChannel(projectId, 'Bare')}
          lookup={lookup}
          layout="wrap"
        />
      </DesignSystemV2Provider>,
    );
    expect(screen.queryByTitle(/DMR|FM|AM/)).toBeNull();
  });

  it('renders summaries in main-first order', () => {
    const channel = newChannel(projectId, 'Demo');
    channel.primaryMode = 'dmr';
    channel.modeProfiles = [
      defaultModeProfile('fm'),
      {
        ...defaultModeProfile('dmr'),
        colourCode: 1,
        timeslot: 2,
        contactRef: { kind: 'talkGroup', id: lookup.talkGroups[0]!.id },
      },
    ];
    render(
      <DesignSystemV2Provider>
        <ChannelModeSummaries channel={channel} lookup={lookup} layout="wrap" />
      </DesignSystemV2Provider>,
    );
    const labels = screen.getAllByText(/^(DMR|FM)$/);
    expect(labels.map((el) => el.textContent)).toEqual(['DMR', 'FM']);
  });

  it('shows +N overflow in line layout', () => {
    const channel = newChannel(projectId, 'Many modes');
    channel.modeProfiles = ['fm', 'dmr', 'dstar', 'ysf', 'nxdn'].map((mode) =>
      defaultModeProfile(mode as 'fm'),
    );
    render(
      <DesignSystemV2Provider>
        <ChannelModeSummaries channel={channel} lookup={lookup} layout="line" maxVisible={2} />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByText('+3')).toBeInTheDocument();
  });
});
