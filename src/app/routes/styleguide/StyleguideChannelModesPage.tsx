import { SimpleGrid, Stack, Text } from '@mantine/core';
import { useMemo, useState } from 'react';
import type { ChannelModeProfile } from '@core/models/library.ts';
import { defaultModeProfile } from '@core/domain/modeProfiles.ts';
import { emptyLibrary, newChannel, newTalkGroup } from '@core/domain/factories.ts';
import type { ChannelMode } from '@core/models/libraryTypes.ts';
import ChannelModeSummaries from '../../components/channels/ChannelModeSummaries.tsx';
import ModeSummaryChip from '../../components/channels/ModeSummaryChip.tsx';
import { channelModeSummaries } from '../../lib/channelModeSummary.ts';
import ModePanel from '../../components/channels/modePanels/ModePanel.tsx';
import { modeLabel } from '../../lib/channelModes.ts';
import type { ModePanelContext } from '../../components/channels/modePanels/types.ts';
import { SegmentedControl } from '../../components/v2/index.ts';
import { StyleguidePageShell, StyleguideSection } from './StyleguidePageShell.tsx';

const DEMO_MODES: ChannelMode[] = ['fm', 'dmr', 'dstar', 'p25'];

function DemoModePanel({ mode, compact }: { mode: ChannelMode; compact: boolean }) {
  const [profile, setProfile] = useState<ChannelModeProfile>(() => defaultModeProfile(mode));
  const demoLibrary = {
    ...emptyLibrary(),
    talkGroups: [newTalkGroup('styleguide-demo', 'Scotland', 2351, 'dmr')],
  };
  const context: ModePanelContext = {
    library: demoLibrary,
    savedChannel: null,
    rxFrequency: null,
    txFrequency: null,
    compact,
  };

  return (
    <Stack gap="xs">
      <Text size="sm" fw={600}>
        {modeLabel(mode)}
      </Text>
      <ModePanel
        profile={profile}
        onPatch={(patch) => setProfile((prev) => ({ ...prev, ...patch }) as ChannelModeProfile)}
        context={context}
      />
    </Stack>
  );
}

function useSummaryDemoLibrary() {
  return useMemo(() => {
    const talkGroups = [newTalkGroup('styleguide-demo', 'Scotland', 2351, 'dmr')];
    return { ...emptyLibrary(), talkGroups };
  }, []);
}

function buildSummaryDemos(lookup: ReturnType<typeof useSummaryDemoLibrary>) {
  const tgId = lookup.talkGroups[0]!.id;

  const fmOnly = newChannel('styleguide-demo', 'FM simplex', 'GB3XX');
  fmOnly.modeProfiles = [{ ...defaultModeProfile('fm'), rxTone: 'none', txTone: '94.8' }];

  const fmDmr = newChannel('styleguide-demo', 'Wales link', 'GB7YY');
  fmDmr.primaryMode = 'dmr';
  fmDmr.modeProfiles = [
    {
      ...defaultModeProfile('dmr'),
      colourCode: 1,
      timeslot: 2,
      contactRef: { kind: 'talkGroup', id: tgId },
    },
    { ...defaultModeProfile('fm'), rxTone: 'none', txTone: '103.5' },
  ];

  const fiveMode = newChannel('styleguide-demo', 'Kitchen sink');
  fiveMode.modeProfiles = (['fm', 'dmr', 'dstar', 'ysf', 'nxdn'] as ChannelMode[]).map((mode) =>
    mode === 'dmr'
      ? {
          ...defaultModeProfile('dmr'),
          colourCode: 1,
          contactRef: { kind: 'talkGroup', id: tgId },
        }
      : defaultModeProfile(mode),
  );

  return { fmOnly, fmDmr, fiveMode };
}

export default function StyleguideChannelModesPage() {
  const [compact, setCompact] = useState(false);
  const lookup = useSummaryDemoLibrary();
  const { fmOnly, fmDmr, fiveMode } = useMemo(() => buildSummaryDemos(lookup), [lookup]);
  const loneSummaries = channelModeSummaries(fmOnly, lookup);

  return (
    <StyleguidePageShell
      title="Channel modes"
      description="How the library presents a channel's modes."
    >
      <StyleguideSection
        title="Mode panels"
        description="Every digital mode lays out its fields in Access, Call, Listen, You. Analogue has no headings and puts tones first. A mode Studio holds no settings for yet shows the headings and a note."
      >
        <Stack gap="md">
          <SegmentedControl
            value={compact ? 'phone' : 'desktop'}
            onChange={(v) => setCompact(v === 'phone')}
            options={[
              { value: 'desktop', label: 'Desktop' },
              { value: 'phone', label: 'Phone' },
            ]}
            aria-label="Viewport width"
          />
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
            {DEMO_MODES.map((mode) => (
              <DemoModePanel key={mode} mode={mode} compact={compact} />
            ))}
          </SimpleGrid>
        </Stack>
      </StyleguideSection>

      <StyleguideSection
        title="Mode summaries"
        description="One chip per mode after the channel's identity; main mode first and bordered."
      >
        <Stack gap="lg">
          <Stack gap="xs">
            <Text size="sm" fw={600}>
              Single FM
            </Text>
            <ChannelModeSummaries channel={fmOnly} lookup={lookup} layout="wrap" size="sm" />
          </Stack>
          <Stack gap="xs">
            <Text size="sm" fw={600}>
              FM + DMR (DMR main)
            </Text>
            <ChannelModeSummaries channel={fmDmr} lookup={lookup} layout="wrap" size="sm" />
          </Stack>
          <Stack gap="xs">
            <Text size="sm" fw={600}>
              Five modes, line +2 overflow
            </Text>
            <ChannelModeSummaries
              channel={fiveMode}
              lookup={lookup}
              layout="line"
              maxVisible={2}
              size="sm"
            />
          </Stack>
          <Stack gap="xs">
            <Text size="sm" fw={600}>
              Chip sizes
            </Text>
            <Stack gap="xs">
              {loneSummaries[0] ? <ModeSummaryChip summary={loneSummaries[0]} size="xs" /> : null}
              {loneSummaries[0] ? <ModeSummaryChip summary={loneSummaries[0]} size="sm" /> : null}
            </Stack>
          </Stack>
        </Stack>
      </StyleguideSection>
    </StyleguidePageShell>
  );
}
