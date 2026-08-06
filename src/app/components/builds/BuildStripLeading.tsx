import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { radioTargetFor } from '@core/radio-targets/index.ts';
import { useOptionalBuildLayout } from '../../routes/builds/BuildLayoutContext.tsx';
import { pathForSwitchedBuild } from '../../routes/builds/nav.ts';
import { useFormatBuild, useFormatBuilds } from '../../state/useFormatBuilds.ts';
import ProjectChip from '../v2/ProjectChip.tsx';
import QuickBuildSwitcher from './QuickBuildSwitcher.tsx';

export interface BuildStripLeadingProps {
  buildId: string;
  /** Use bottom-sheet switcher on narrow layouts (chip label stays visible). */
  mobile?: boolean;
}

/**
 * mk2 B2 — build identity chip in the contextual strip trailing slot.
 */
export default function BuildStripLeading({ buildId, mobile }: BuildStripLeadingProps) {
  const layout = useOptionalBuildLayout();
  const location = useLocation();
  const navigate = useNavigate();
  const { build: hookBuild } = useFormatBuild(buildId);
  const { builds } = useFormatBuilds();
  const build = layout?.build ?? hookBuild;
  const [switcherOpen, setSwitcherOpen] = useState(false);

  if (!build) return null;

  const radioLabel = radioTargetFor(build.radioTargetId)?.label ?? build.radioTargetId;
  const showRadioSub = radioLabel.trim().toLowerCase() !== build.name.trim().toLowerCase();

  const chip = (
    <ProjectChip
      name={build.name}
      statusLabel={showRadioSub ? radioLabel : null}
      statusTone="neutral"
      onClick={() => setSwitcherOpen((open) => !open)}
      aria-expanded={switcherOpen}
      aria-haspopup="dialog"
    />
  );

  if (builds.length <= 1) {
    return chip;
  }

  return (
    <QuickBuildSwitcher
      opened={switcherOpen}
      onClose={() => setSwitcherOpen(false)}
      onOpen={() => setSwitcherOpen(true)}
      mobile={mobile}
      builds={builds}
      activeBuildId={build.id}
      onSwitchBuild={(nextId) => {
        const target = builds.find((candidate) => candidate.id === nextId);
        if (!target) return;
        navigate(
          pathForSwitchedBuild(location.pathname, build.id, target, {
            egressPaths: layout?.egressPaths,
            activeEgress: layout?.activeEgress,
          }),
        );
      }}
      onNewBuild={() => {
        setSwitcherOpen(false);
        navigate('/builds/new');
      }}
    >
      {chip}
    </QuickBuildSwitcher>
  );
}
