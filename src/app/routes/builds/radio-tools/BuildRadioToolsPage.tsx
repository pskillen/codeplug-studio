/**
 * Radio tools area (#1369): rare jobs that change the radio itself, one card per tool offered for this build's
 * radio. Nothing on this page touches the radio. Redirects to Export when no tool is offered (prod site, a radio
 * with no tools, no Web Serial egress, or the native app).
 */

import { Navigate, useNavigate } from 'react-router-dom';
import RadioToolCard from '../../../components/radioTools/RadioToolCard.tsx';
import { findRadioIoEgress } from '../../../lib/buildEgressUi.ts';
import { RADIO_TOOLS_DECISIONS } from '../../../services/radioTools/decisions.ts';
import { listOfferedRadioTools } from '../../../services/radioTools/gate.ts';
import { useBuildLayout } from '../BuildLayoutContext.tsx';
import classes from './BuildRadioToolsPage.module.css';

export default function BuildRadioToolsPage() {
  const { build, egressPaths } = useBuildLayout();
  const navigate = useNavigate();
  const tools = findRadioIoEgress(egressPaths) ? listOfferedRadioTools(build.radioTargetId) : [];

  if (tools.length === 0) {
    return <Navigate to={`/builds/${build.id}/export`} replace />;
  }

  return (
    <div className={classes.page}>
      <div className={classes.header}>
        <h1 className={classes.title}>{RADIO_TOOLS_DECISIONS.areaName}</h1>
        <p className={classes.strap} role="note">
          {RADIO_TOOLS_DECISIONS.strap}
        </p>
      </div>
      <div className={classes.cards}>
        {tools.map((tool) => (
          <RadioToolCard
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
