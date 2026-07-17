import { Stack, Text } from '@mantine/core';
import { useState } from 'react';
import type { ForbidTransmitOverride } from '@core/models/channelBehaviourDefaults.ts';
import type { ChannelMode } from '../../lib/channelModes.ts';
import { ModePill } from '../../components/pills/index.ts';
import {
  GradientSegmentedControl,
  ImageCheckboxGroup,
  PercentLevelSlider,
  PillTabs,
  SplitButton,
} from '../../components/ui/index.ts';
import ForbidTransmitSegment from '../../components/channels/ForbidTransmitSegment.tsx';
import ScanInclusionSegment from '../../components/channels/ScanInclusionSegment.tsx';

export function PercentLevelSliderDemo({
  label,
  initial,
  zeroLabel,
}: {
  label: string;
  initial: number | null;
  zeroLabel?: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <PercentLevelSlider label={label} value={value} onChange={setValue} zeroLabel={zeroLabel} />
  );
}

export function ForbidTransmitSegmentDemo() {
  const [forbidTransmit, setForbidTransmit] = useState<ForbidTransmitOverride>('default');
  return <ForbidTransmitSegment value={forbidTransmit} onChange={setForbidTransmit} />;
}

export function ScanInclusionSegmentDemo() {
  const [scanInclusion, setScanInclusion] = useState<'default' | 'skip' | 'alwaysScan'>('default');
  return <ScanInclusionSegment value={scanInclusion} onChange={setScanInclusion} />;
}

export function SplitButtonDemo() {
  const [last, setLast] = useState('None');
  return (
    <Stack gap="sm" maw={320}>
      <SplitButton
        label="Add channels"
        onClick={() => setLast('Add channels')}
        menuItems={[{ label: 'Add as zone', onClick: () => setLast('Add as zone') }]}
      />
      <Text size="sm" c="dimmed">
        Last action: {last}
      </Text>
    </Stack>
  );
}

export function GradientSegmentedControlDemo({
  label,
  scheme,
  options,
  initial,
}: {
  label: string;
  scheme: 'onOff' | 'allowForbid' | 'three' | 'four' | 'five';
  options: { value: string; label: string }[];
  initial: string;
}) {
  const [value, setValue] = useState(initial);
  return (
    <GradientSegmentedControl
      label={label}
      value={value}
      onChange={setValue}
      scheme={scheme}
      data={options}
      fullWidth
    />
  );
}

function vacationIcon(emoji: string, fill: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" rx="6" fill="${fill}"/><text x="20" y="27" font-size="20" text-anchor="middle">${emoji}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

export function ImageCheckboxDemo() {
  const [vacation, setVacation] = useState<string[]>(['beach']);
  const [modes, setModes] = useState<ChannelMode[]>(['fm', 'dmr']);

  return (
    <Stack gap="xl" maw={640}>
      <ImageCheckboxGroup
        label="With images"
        description="Mantine UI vacation cards — image optional on each option."
        value={vacation}
        onChange={setVacation}
        cols={{ base: 2, sm: 3 }}
        options={[
          {
            value: 'beach',
            title: 'Beach vacation',
            description: 'Sun and sea',
            imageSrc: vacationIcon('🏖', '#fff3bf'),
          },
          {
            value: 'city',
            title: 'City trips',
            description: 'Sightseeing',
            imageSrc: vacationIcon('🏙', '#d0ebff'),
          },
          {
            value: 'hike',
            title: 'Hiking vacation',
            description: 'Mountains',
            imageSrc: vacationIcon('⛰', '#d3f9d8'),
          },
          {
            value: 'winter',
            title: 'Winter vacation',
            description: 'Snow and ice',
            imageSrc: vacationIcon('❄', '#e7f5ff'),
          },
        ]}
      />

      <ImageCheckboxGroup
        label="Media slot (no image)"
        description="Channel mode picker uses `ModePill` in the media slot."
        value={modes}
        onChange={setModes}
        cols={{ base: 2, sm: 3 }}
        options={[
          {
            value: 'fm',
            title: 'FM',
            description: 'Analog',
            media: <ModePill mode="fm" size="xs" />,
          },
          {
            value: 'dmr',
            title: 'DMR',
            description: 'Digital',
            media: <ModePill mode="dmr" size="xs" />,
          },
          {
            value: 'dstar',
            title: 'D-STAR',
            description: 'Digital',
            media: <ModePill mode="dstar" size="xs" />,
          },
          {
            value: 'ysf',
            title: 'YSF',
            description: 'Digital',
            media: <ModePill mode="ysf" size="xs" />,
          },
        ]}
      />
    </Stack>
  );
}

export function PillTabsDemo() {
  const [active, setActive] = useState('fm');
  return (
    <PillTabs
      value={active}
      onChange={setActive}
      items={[
        {
          value: 'fm',
          leading: <ModePill mode="fm" size="xs" />,
          label: 'FM',
          panel: (
            <Text size="sm" c="dimmed">
              Analog panel body — bandwidth, tones, squelch.
            </Text>
          ),
        },
        {
          value: 'dmr',
          leading: <ModePill mode="dmr" size="xs" />,
          label: 'DMR',
          panel: (
            <Text size="sm" c="dimmed">
              Digital panel body — colour code, contact, RX group list.
            </Text>
          ),
        },
        {
          value: 'dstar',
          leading: <ModePill mode="dstar" size="xs" />,
          label: 'D-STAR',
          panel: (
            <Text size="sm" c="dimmed">
              Stub panel — swap tab panels for mode-specific form sections.
            </Text>
          ),
        },
      ]}
    />
  );
}
