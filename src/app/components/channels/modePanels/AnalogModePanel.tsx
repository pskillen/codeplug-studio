import { Group, Input, SegmentedControl, Select } from '@mantine/core';
import type { ProfileFor } from './types.ts';
import type { ModePanelProps } from './types.ts';
import { BANDWIDTH_KHZ_OPTIONS } from '../../../lib/channelFields/index.ts';
import { PercentLevelSlider } from '../../v2/index.ts';
import AnalogSquelchModeSegment from '../AnalogSquelchModeSegment.tsx';
import ChannelToneField from '../ChannelToneField.tsx';

const bandwidthSelectData = [
  { value: '', label: '—' },
  ...BANDWIDTH_KHZ_OPTIONS.map((bw) => ({ value: String(bw), label: `${bw} kHz` })),
];

export default function AnalogModePanel({
  profile,
  onPatch,
}: ModePanelProps<ProfileFor<'fm' | 'am' | 'ssb'>>) {
  return (
    <>
      {profile.mode === 'ssb' ? (
        <Input.Wrapper label="Sideband">
          <SegmentedControl
            data={[
              { value: 'usb', label: 'USB' },
              { value: 'lsb', label: 'LSB' },
            ]}
            value={profile.ssbSideband ?? 'usb'}
            onChange={(value) => onPatch({ ssbSideband: value as 'usb' | 'lsb' })}
          />
        </Input.Wrapper>
      ) : null}
      <Select
        label="Bandwidth (kHz)"
        data={bandwidthSelectData}
        value={profile.bandwidthKHz != null ? String(profile.bandwidthKHz) : ''}
        onChange={(v) => onPatch({ bandwidthKHz: v && v !== '' ? parseFloat(v) : null })}
        clearable
      />
      <Group grow>
        <ChannelToneField
          label="RX tone"
          value={profile.rxTone}
          onChange={(rxTone) => onPatch({ rxTone })}
        />
        <ChannelToneField
          label="TX tone"
          value={profile.txTone}
          onChange={(txTone) => onPatch({ txTone })}
        />
      </Group>
      <PercentLevelSlider
        label="Squelch"
        value={profile.squelch}
        onChange={(v) => onPatch({ squelch: v })}
        zeroLabel="Open (0%)"
      />
      <AnalogSquelchModeSegment
        value={profile.analogSquelchMode ?? 'default'}
        onChange={(analogSquelchMode) => onPatch({ analogSquelchMode })}
        layout="row"
      />
    </>
  );
}