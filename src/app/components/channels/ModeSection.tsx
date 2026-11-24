import type { ReactNode } from 'react';
import { Tooltip } from '@mantine/core';
import type { ChannelMode } from '@core/models/libraryTypes.ts';
import { Button, Panel, Pill } from '../v2/index.ts';
import { modeColor, modeLabel } from '../../lib/channelModes.ts';
import classes from './ModeSection.module.css';

const MAIN_MODE_HELP =
  'A radio that can use only one of these modes uses this one; a radio that listens to both transmits in it.';

export interface ModeSectionProps {
  mode: ChannelMode;
  isMain: boolean;
  onMakeMain: () => void;
  /** One-line summary shown while folded (modeProfileSummary); empty → "Nothing set yet". */
  summary: string;
  defaultCollapsed: boolean;
  children: ReactNode;
}

function initialCollapsed(mode: ChannelMode, defaultCollapsed: boolean): boolean {
  if (typeof window !== 'undefined' && window.location.hash === `#mode-${mode}`) {
    return false;
  }
  return defaultCollapsed;
}

function ModeSectionAction({
  isMain,
  mode,
  onMakeMain,
}: Pick<ModeSectionProps, 'isMain' | 'mode' | 'onMakeMain'>) {
  const label = modeLabel(mode);
  const control = isMain ? (
    <span className={classes.actionFocus} tabIndex={0}>
      <Pill tone="accent">Main mode</Pill>
    </span>
  ) : (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      aria-label={`Make main, ${label}`}
      onClick={() => onMakeMain()}
    >
      Make main
    </Button>
  );

  return (
    <Tooltip
      label={MAIN_MODE_HELP}
      multiline
      w={280}
      events={{ hover: true, focus: true, touch: true }}
    >
      {control}
    </Tooltip>
  );
}

export default function ModeSection({
  mode,
  isMain,
  onMakeMain,
  summary,
  defaultCollapsed,
  children,
}: ModeSectionProps) {
  const foldedSummary = summary.trim() ? summary : 'Nothing set yet';

  return (
    <div className={classes.stripe} style={{ ['--mode-color' as string]: modeColor(mode) }}>
      <Panel
        id={`mode-${mode}`}
        title={modeLabel(mode)}
        collapsible
        defaultCollapsed={initialCollapsed(mode, defaultCollapsed)}
        summary={foldedSummary}
        actions={<ModeSectionAction isMain={isMain} mode={mode} onMakeMain={onMakeMain} />}
      >
        {children}
      </Panel>
    </div>
  );
}
