import { Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { radioTargetFor, compatibleEgressForProfile } from '@core/radio-targets/index.ts';
import { useOptionalBuildLayout } from '../../routes/builds/BuildLayoutContext.tsx';
import { useFormatBuild } from '../../state/useFormatBuilds.ts';
import BuildSwitcher from './BuildSwitcher/BuildSwitcher.tsx';
import classes from './BuildIdentityBar.module.css';

export interface BuildIdentityBarProps {
  buildId: string;
  compact?: boolean;
}

/**
 * mk2 B2 slim identity row — build switcher, radio target, active pathway cue.
 */
export default function BuildIdentityBar({ buildId, compact }: BuildIdentityBarProps) {
  const layout = useOptionalBuildLayout();
  const { build: hookBuild } = useFormatBuild(buildId);
  const build = layout?.build ?? hookBuild;
  const activeEgress = layout?.activeEgress;

  if (!build) return null;

  const radioLabel = radioTargetFor(build.radioTargetId)?.label ?? build.radioTargetId;
  const pathwayLabel = activeEgress
    ? (compatibleEgressForProfile(build.radioTargetId, activeEgress.profileId)?.label ??
      activeEgress.profileId)
    : 'No pathway selected';

  return (
    <div className={[classes.root, compact ? classes.compact : ''].filter(Boolean).join(' ')}>
      <Link to="/builds" className={classes.backLink}>
        Export for radio
      </Link>
      <div className={classes.identity}>
        <BuildSwitcher compact />
        <Text size="xs" c="dimmed" className={classes.meta}>
          {radioLabel}
          <span className={classes.dot} aria-hidden>
            ·
          </span>
          {pathwayLabel}
        </Text>
      </div>
    </div>
  );
}
