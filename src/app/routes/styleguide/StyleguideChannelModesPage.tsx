import { Button, Group, SimpleGrid, Stack, Text } from '@mantine/core';
import DesignSystemV2Provider from '../../components/v2/DesignSystemV2Provider.tsx';
import { ChannelTalkCard, ChannelTalkRow } from '../library/channelView/ChannelTalkCard.tsx';
import { useMemo, useState } from 'react';
import type { ChannelModeProfile } from '@core/models/library.ts';
import {
  addChannelMode,
  defaultModeProfile,
  removeChannelMode,
  switchChannelMode,
  type ChannelModeEdit,
} from '@core/domain/modeProfiles.ts';
import { emptyLibrary, newChannel, newOwnDigitalId, newTalkGroup } from '@core/domain/factories.ts';
import type { ChannelMode } from '@core/models/libraryTypes.ts';
import ChannelModePicker, { AddModeMenu } from '../../components/channels/ChannelModePicker.tsx';
import ChannelModeSummaries from '../../components/channels/ChannelModeSummaries.tsx';
import ModeSummaryChip from '../../components/channels/ModeSummaryChip.tsx';
import { channelModeSummaries } from '../../lib/channelModeSummary.ts';
import ModePanel from '../../components/channels/modePanels/ModePanel.tsx';
import ModeSection from '../../components/channels/ModeSection.tsx';
import { modeSectionStartsFolded } from '../../lib/channelModes.ts';
import { modeProfileSummary } from '../../lib/channelModeSummary.ts';
import { modeLabel, type ModePreset } from '../../lib/channelModes.ts';
import type { ModePanelContext } from '../../components/channels/modePanels/types.ts';
import { SegmentedControl } from '../../components/v2/index.ts';
import { StyleguidePageShell, StyleguideSection } from './StyleguidePageShell.tsx';

const DEMO_MODES: ChannelMode[] = ['fm', 'dmr', 'dstar', 'p25', 'm17'];

function DemoModePanel({ mode, compact }: { mode: ChannelMode; compact: boolean }) {
  const [profile, setProfile] = useState<ChannelModeProfile>(() => defaultModeProfile(mode));
  const demoLibrary = {
    ...emptyLibrary(),
    talkGroups: [newTalkGroup('styleguide-demo', 'Scotland', 2351, 'dmr')],
    ownDigitalIds: [
      { ...newOwnDigitalId('styleguide-demo', 'm17', 'Demo', 'AB1CD/P'), isDefault: true },
    ],
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

  const fmRepeater = newChannel('styleguide-demo', 'FM repeater', 'GB3XX');
  fmRepeater.rxFrequency = 145_600_000;
  fmRepeater.txFrequency = 145_000_000;
  fmRepeater.modeProfiles = [
    { ...defaultModeProfile('fm'), rxTone: 'none', txTone: '94.8' } as ChannelModeProfile,
  ];

  const fmOnly = newChannel('styleguide-demo', 'FM simplex', 'GB3XX');
  fmOnly.modeProfiles = [
    { ...defaultModeProfile('fm'), rxTone: 'none', txTone: '94.8' } as ChannelModeProfile,
  ];

  const dmrTalkCard = newChannel('styleguide-demo', 'Scotland TG', 'GB7YY');
  dmrTalkCard.modeProfiles = [
    {
      ...defaultModeProfile('dmr'),
      colourCode: 1,
      timeslot: 2,
      contactRef: { kind: 'talkGroup', id: tgId },
    } as ChannelModeProfile,
  ];

  const fmDmr = newChannel('styleguide-demo', 'Wales link', 'GB7YY');
  fmDmr.primaryMode = 'dmr';
  fmDmr.modeProfiles = [
    {
      ...defaultModeProfile('dmr'),
      colourCode: 1,
      timeslot: 2,
      contactRef: { kind: 'talkGroup', id: tgId },
    } as ChannelModeProfile,
    { ...defaultModeProfile('fm'), rxTone: 'none', txTone: '103.5' } as ChannelModeProfile,
  ];

  const fiveMode = newChannel('styleguide-demo', 'Kitchen sink');
  fiveMode.modeProfiles = (['fm', 'dmr', 'dstar', 'ysf', 'nxdn'] as ChannelMode[]).map(
    (mode) =>
      (mode === 'dmr'
        ? {
            ...defaultModeProfile('dmr'),
            colourCode: 1,
            contactRef: { kind: 'talkGroup', id: tgId },
          }
        : defaultModeProfile(mode)) as ChannelModeProfile,
  );

  const threeModeDemo = newChannel('styleguide-demo', 'Three modes');
  threeModeDemo.modeProfiles = [
    fmRepeater.modeProfiles[0]!,
    dmrTalkCard.modeProfiles[0]!,
    { ...defaultModeProfile('dstar'), urCall: 'CQCQCQ', rpt1Call: 'GB7XX B' } as ChannelModeProfile,
  ];

  return { fmOnly, fmDmr, fiveMode, fmRepeater, dmrTalkCard, threeModeDemo };
}

const EMPTY_MODE_EDIT: ChannelModeEdit = {
  modeProfiles: [],
  primaryMode: null,
  parked: [],
};

function applyPreset(edit: ChannelModeEdit, preset: ModePreset): ChannelModeEdit {
  let next = edit;
  const [first, ...rest] = preset.modes;
  if (first == null) return next;
  next = switchChannelMode(next, first);
  for (const mode of rest) {
    next = addChannelMode(next, mode);
  }
  return next;
}

function DemoModeSections() {
  const lookup = useSummaryDemoLibrary();
  const tgId = lookup.talkGroups[0]!.id;
  const [profiles, setProfiles] = useState<ChannelModeProfile[]>(() => [
    {
      ...defaultModeProfile('fm'),
      rxTone: 'none',
      txTone: '94.8',
    } as ChannelModeProfile,
    {
      ...defaultModeProfile('dmr'),
      colourCode: 1,
      timeslot: 2,
      contactRef: { kind: 'talkGroup', id: tgId },
    } as ChannelModeProfile,
    defaultModeProfile('nxdn'),
  ]);
  const [primaryMode, setPrimaryMode] = useState<ChannelMode>('dmr');

  const context: ModePanelContext = {
    library: lookup,
    savedChannel: null,
    rxFrequency: null,
    txFrequency: null,
    compact: false,
  };

  return (
    <Stack gap="md">
      {profiles.map((profile, index) => {
        const mode = profile.mode as ChannelMode;
        const isMain = mode === primaryMode;
        return (
          <ModeSection
            key={mode}
            mode={mode}
            isMain={isMain}
            onMakeMain={() => setPrimaryMode(mode)}
            summary={modeProfileSummary(profile, lookup)}
            defaultCollapsed={modeSectionStartsFolded({
              modeCount: profiles.length,
              compact: false,
              isMain,
              addedThisEdit: false,
            })}
          >
            <ModePanel
              profile={profile}
              onPatch={(patch) =>
                setProfiles((prev) =>
                  prev.map((p, i) =>
                    i === index ? ({ ...p, ...patch } as ChannelModeProfile) : p,
                  ),
                )
              }
              context={context}
            />
          </ModeSection>
        );
      })}
    </Stack>
  );
}

export default function StyleguideChannelModesPage() {
  const [compact, setCompact] = useState(false);
  const lookup = useSummaryDemoLibrary();
  const { fmOnly, fmDmr, fiveMode, fmRepeater, dmrTalkCard, threeModeDemo } = useMemo(
    () => buildSummaryDemos(lookup),
    [lookup],
  );
  const threeSummaries = channelModeSummaries(threeModeDemo, lookup);
  const loneSummaries = channelModeSummaries(fmOnly, lookup);

  const [modeEdit, setModeEdit] = useState<ChannelModeEdit>(EMPTY_MODE_EDIT);

  const pickerModes = modeEdit.modeProfiles.map((p) => p.mode);

  return (
    <StyleguidePageShell
      title="Channel modes"
      description="How the library presents a channel's modes."
    >
      <StyleguideSection
        title="Mode sections"
        description="Main mode badge, Make main, folding with three or more modes."
      >
        <DemoModeSections />
      </StyleguideSection>

      <StyleguideSection
        title="Mode picker"
        description="No mode (placeholder with presets), one mode (switch), two or more (chips). Interactive: the demo applies the same transitions the editor uses."
      >
        <Stack gap="sm">
          <ChannelModePicker
            modes={pickerModes}
            compact={compact}
            onSwitch={(mode) => setModeEdit((edit) => switchChannelMode(edit, mode))}
            onAdd={(mode) => setModeEdit((edit) => addChannelMode(edit, mode))}
            onRemove={(mode) => setModeEdit((edit) => removeChannelMode(edit, mode))}
            onPreset={(preset) => setModeEdit((edit) => applyPreset(edit, preset))}
          />
          <Text size="sm" c="dimmed">
            Modes: {pickerModes.length === 0 ? 'none' : pickerModes.map(modeLabel).join(', ')}
            {' · '}
            Main: {modeEdit.primaryMode ? modeLabel(modeEdit.primaryMode) : 'none'}
          </Text>
          <Group gap="sm">
            <Button
              variant="default"
              size="compact-sm"
              onClick={() => setModeEdit(EMPTY_MODE_EDIT)}
            >
              Reset
            </Button>
            {pickerModes.length === 1 ? (
              <AddModeMenu
                modes={pickerModes}
                variant="link"
                onAdd={(mode) => setModeEdit((edit) => addChannelMode(edit, mode))}
              />
            ) : null}
          </Group>
        </Stack>
      </StyleguideSection>

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
              Five modes, line, maxVisible 2
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
            <Stack gap="xs" align="flex-start">
              {loneSummaries[0] ? <ModeSummaryChip summary={loneSummaries[0]} size="xs" /> : null}
              {loneSummaries[0] ? <ModeSummaryChip summary={loneSummaries[0]} size="sm" /> : null}
            </Stack>
          </Stack>
        </Stack>
      </StyleguideSection>

      <StyleguideSection
        title="Talk cards"
        description="One sentence per mode on how to talk on it; main mode first."
      >
        <DesignSystemV2Provider>
          <Stack gap="md">
            <Stack gap="xs">
              <Text size="sm" fw={600}>
                FM repeater
              </Text>
              <ChannelTalkCard
                profile={fmRepeater.modeProfiles[0]!}
                channel={fmRepeater}
                library={lookup}
                isMain={false}
                editPath="#"
                modeCount={1}
              />
            </Stack>
            <Stack gap="xs">
              <Text size="sm" fw={600}>
                DMR talk group
              </Text>
              <ChannelTalkCard
                profile={dmrTalkCard.modeProfiles[0]!}
                channel={dmrTalkCard}
                library={lookup}
                isMain={false}
                editPath="#"
                modeCount={1}
              />
            </Stack>
            <Stack gap="xs">
              <Text size="sm" fw={600}>
                Three modes (compact rows)
              </Text>
              <Stack gap="sm">
                {threeSummaries.map((summary) => {
                  const profile = threeModeDemo.modeProfiles.find((p) => p.mode === summary.mode);
                  if (!profile) return null;
                  return (
                    <ChannelTalkRow
                      key={profile.mode}
                      profile={profile}
                      channel={threeModeDemo}
                      library={lookup}
                      isMain={summary.isMain}
                      editPath="#"
                      modeCount={3}
                      summary={summary}
                    />
                  );
                })}
              </Stack>
            </Stack>
          </Stack>
        </DesignSystemV2Provider>
      </StyleguideSection>
    </StyleguidePageShell>
  );
}
