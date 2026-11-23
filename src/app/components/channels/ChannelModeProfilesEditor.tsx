import { Stack } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
import type { Channel, ChannelModeProfile, Library } from '@core/models/library.ts';
import ModePill from '../pills/ModePill.tsx';
import { MOBILE_MAX_WIDTH_MEDIA_QUERY } from '../../lib/breakpoints.ts';
import { modeLabel } from '../../lib/channelModes.ts';
import ModePanel from './modePanels/ModePanel.tsx';
import type { ModePanelContext } from './modePanels/types.ts';
import classes from './ChannelModeProfilesEditor.module.css';

export interface ChannelModeProfilesEditorProps {
  profiles: ChannelModeProfile[];
  library: Library;
  /** Saved channel for directory verify actions (DMR RX-list sync). */
  channel?: Channel | null;
  rxFrequency: number | null;
  txFrequency: number | null;
  onChange: (profiles: ChannelModeProfile[]) => void;
}

export default function ChannelModeProfilesEditor({
  profiles,
  library,
  channel = null,
  rxFrequency,
  txFrequency,
  onChange,
}: ChannelModeProfilesEditorProps) {
  const compact = useMediaQuery(MOBILE_MAX_WIDTH_MEDIA_QUERY) ?? false;

  const updateProfile = (index: number, patch: Partial<ChannelModeProfile>) => {
    onChange(
      profiles.map((p, i) => (i === index ? ({ ...p, ...patch } as ChannelModeProfile) : p)),
    );
  };

  if (profiles.length === 0) {
    return (
      <p className={classes.empty}>
        Select at least one mode above to configure mode-specific settings. Bandwidth, tones and
        squelch appear for analogue modes (FM, AM, SSB).
      </p>
    );
  }

  const context: ModePanelContext = {
    library,
    savedChannel: channel,
    rxFrequency,
    txFrequency,
    compact,
  };

  return (
    <Stack gap={0}>
      {profiles.map((profile, index) => (
        <div key={profile.mode} className={index > 0 ? classes.stackedBlock : classes.firstBlock}>
          <div className={classes.modeHeader}>
            <ModePill mode={profile.mode} size="xs" />
            <span className={classes.modeTitle}>{modeLabel(profile.mode)} settings</span>
          </div>
          <ModePanel
            profile={profile}
            onPatch={(patch) => updateProfile(index, patch)}
            context={context}
          />
        </div>
      ))}
    </Stack>
  );
}