import { Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { radioTargetFor, compatibleEgressForProfile } from '@core/radio-targets/index.ts';
import { useOptionalBuildLayout } from '../../routes/builds/BuildLayoutContext.tsx';
import { useFormatBuild } from '../../state/useFormatBuilds.ts';
import BuildSwitcher from './BuildSwitcher/BuildSwitcher.tsx';
import classes from './BuildStripLeading.module.css';

export interface BuildStripLeadingProps {
  buildId: string;
  compact?: boolean;
}

/**
 * mk2 B2 — build switcher + radio/pathway meta in the contextual strip leading slot.
 */
export default function BuildStripLeading({ buildId, compact }: BuildStripLeadingProps) {
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
      <BuildSwitcher compact />
      <Text size="xs" c="dimmed" className={classes.meta}>
        {radioLabel}
        <span className={classes.dot} aria-hidden>
          ·
        </span>
        {pathwayLabel}
      </Text>
    </div>
  );
}
