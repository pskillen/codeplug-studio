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

/** Fold rule: 3+ modes, or 2+ on a phone; the main mode and modes added during this edit start open. */
export function modeSectionStartsFolded(opts: {
  modeCount: number;
  compact: boolean;
  isMain: boolean;
  addedThisEdit: boolean;
}): boolean {
  if (opts.addedThisEdit) return false;
  if (opts.isMain) return false;
  if (opts.modeCount >= 3) return true;
  if (opts.compact && opts.modeCount >= 2) return true;
  return false;
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
      variant="ghost"
      size="sm"
      aria-label={`Make ${label} the main mode`}
      onClick={(e) => {
        e.stopPropagation();
        onMakeMain();
      }}
    >
      Make main
    </Button>
  );

  return (
    <Tooltip label={MAIN_MODE_HELP} multiline w={280}>
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
        defaultCollapsed={defaultCollapsed}
        summary={foldedSummary}
        actions={<ModeSectionAction isMain={isMain} mode={mode} onMakeMain={onMakeMain} />}
      >
        {children}
      </Panel>
    </div>
  );
}
