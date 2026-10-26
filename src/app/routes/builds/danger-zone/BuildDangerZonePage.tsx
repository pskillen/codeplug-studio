/**
 * Danger zone area (#1369): rare jobs that change the radio itself, one card per tool offered for this build's
 * radio. Nothing on this page touches the radio. Redirects to Export when no tool is offered (a radio
 * with no tools, no Web Serial egress, or the native app).
 */

import { Navigate, useNavigate } from 'react-router-dom';
import DangerZoneToolCard from '../../../components/dangerZone/DangerZoneToolCard.tsx';
import RangeChangeBanner from '../../../components/dangerZone/RangeChangeBanner.tsx';
import { Button } from '../../../components/v2/index.ts';
import {
  lastDoneRangeChange,
  useRangeChangeJournal,
} from '../../../state/atD890RangeChangeJournal.ts';
import { COPY, dayAndClock, rangeCaption, tail4 } from './rangeChange/rangeChangeCopy.ts';
import { findRadioIoEgress } from '../../../lib/buildEgressUi.ts';
import { DANGER_ZONE_DECISIONS } from '../../../services/dangerZone/decisions.ts';
import { listOfferedDangerZoneTools } from '../../../services/dangerZone/gate.ts';
import { useBuildLayout } from '../BuildLayoutContext.tsx';
import classes from './BuildDangerZonePage.module.css';

export default function BuildDangerZonePage() {
  const { build, egressPaths } = useBuildLayout();
  const navigate = useNavigate();
  const last = lastDoneRangeChange(useRangeChangeJournal());
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
      <RangeChangeBanner buildId={build.id} />
      <div className={classes.cards}>
        {tools.map((tool) => (
          <DangerZoneToolCard
            key={tool.id}
            tool={tool}
            onStart={tool.route ? () => navigate(`/builds/${build.id}/${tool.route}`) : undefined}
          />
        ))}
      </div>
      <div className={classes.footer}>
        <Button
          variant="ghost"
          size="sm"
          onClick={() =>
            navigate(`/builds/${build.id}/export/danger-zone/frequency-range/resume?file=1`)
          }
        >
          {COPY.footer.fromFile}
        </Button>
        {last ? (
          <p className={classes.last} data-testid="range-last-change">
            {COPY.footer.last(
              tail4(last.serial),
              rangeCaption(last.fromCode),
              rangeCaption(last.toCode),
              dayAndClock(last.updatedAt),
            )}{' '}
            ·{' '}
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                navigate(
                  `/builds/${build.id}/export/danger-zone/frequency-range?target=${last.fromCode}`,
                )
              }
            >
              {COPY.footer.changeBack}
            </Button>
          </p>
        ) : null}
      </div>
    </div>
  );
}
