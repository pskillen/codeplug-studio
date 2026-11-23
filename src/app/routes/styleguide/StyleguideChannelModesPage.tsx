import { SimpleGrid, Stack, Text } from '@mantine/core';
import { useState } from 'react';
import type { ChannelModeProfile } from '@core/models/library.ts';
import { defaultModeProfile } from '@core/domain/modeProfiles.ts';
import { emptyLibrary, newTalkGroup } from '@core/domain/factories.ts';
import type { ChannelMode } from '@core/models/libraryTypes.ts';
import ModePanel from '../../components/channels/modePanels/ModePanel.tsx';
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
        {mode.toUpperCase()}
      </Text>
      <ModePanel
        profile={profile}
        onPatch={(patch) => setProfile((prev) => ({ ...prev, ...patch }) as ChannelModeProfile)}
        context={context}
      />
    </Stack>
  );
}

export default function StyleguideChannelModesPage() {
  const [compact, setCompact] = useState(false);

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
    </StyleguidePageShell>
  );
}
