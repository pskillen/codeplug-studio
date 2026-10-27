/**
 * Danger zone area (#1369): rare jobs that change the radio itself, one card per tool offered for this build's
 * radio. Nothing on this page touches the radio. Redirects to Export when no tool is offered (a radio
 * with no tools, no Web Serial egress, or the native app).
 */

import { Navigate, useNavigate } from 'react-router-dom';
import DangerZoneToolCard from '../../../components/dangerZone/DangerZoneToolCard.tsx';
import { findRadioIoEgress } from '../../../lib/buildEgressUi.ts';
import { DANGER_ZONE_DECISIONS } from '../../../services/dangerZone/decisions.ts';
import { listOfferedDangerZoneTools } from '../../../services/dangerZone/gate.ts';
import { useBuildLayout } from '../BuildLayoutContext.tsx';
import classes from './BuildDangerZonePage.module.css';

export default function BuildDangerZonePage() {
  const { build, egressPaths } = useBuildLayout();
  const navigate = useNavigate();
  const tools = findRadioIoEgress(egressPaths)
    ? listOfferedDangerZoneTools(build.radioTargetId)
    : [];

  if (tools.length === 0) {
    return <Navigate to={`/builds/${build.id}/export`} replace />;
  }

  return (
    <div className={classes.page}>
      <div className={classes.header}>
        <h1 className={classes.title}>{DANGER_ZONE_DECISIONS.areaName}</h1>
        <p className={classes.strap} role="note">
          {DANGER_ZONE_DECISIONS.strap}
        </p>
      </div>
      <div className={classes.cards}>
        {tools.map((tool) => (
          <DangerZoneToolCard
            key={tool.id}
            tool={tool}
            onStart={tool.route ? () => navigate(`/builds/${build.id}/${tool.route}`) : undefined}
          />
        ))}
      </div>
      {/* Footer slot (PR 4): "Finish a range change from a backup file", "Last change: …". */}
    </div>
  );
}
