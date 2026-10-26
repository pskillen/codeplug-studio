/**
 * Danger zone: Change frequency range (#1369). `/builds/:id/export/danger-zone/frequency-range`, and
 * `.../frequency-range/resume` to finish an unfinished change. A page wizard of eight steps and a Done screen;
 * `useRangeChangeFlow` owns the sessions, this page lays them out.
 */

import { useCallback, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ConfirmModal, Stepper, type StepperStep } from '../../../../components/v2/index.ts';
import { findRadioIoEgress } from '../../../../lib/buildEgressUi.ts';
import { useScreenWakeLock } from '../../../../hooks/useScreenWakeLock.ts';
import { useUnsavedNavigationGuard } from '../../../../hooks/useUnsavedNavigationGuard.ts';
import { descriptorsForEgress } from '../../../../services/radioIoSession.ts';
import { listOfferedDangerZoneTools } from '../../../../services/dangerZone/gate.ts';
import { useBuildLayout } from '../../BuildLayoutContext.tsx';
import classes from './RangeChange.module.css';
import { COPY, STEP_LABELS } from './rangeChangeCopy.ts';
import BackUpStep from './steps/BackUpStep.tsx';
import ChangeStep from './steps/ChangeStep.tsx';
import CheckStep from './steps/CheckStep.tsx';
import ConfirmStep from './steps/ConfirmStep.tsx';
import DoneStep from './steps/DoneStep.tsx';
import NewRangeStep from './steps/NewRangeStep.tsx';
import ReadStep from './steps/ReadStep.tsx';
import RestartStep from './steps/RestartStep.tsx';
import ResumeStep from './steps/ResumeStep.tsx';
import RestoreStep from './steps/RestoreStep.tsx';
import { RANGE_CHANGE_STEPS, type RangeChangeStep } from './types.ts';
import { useRangeChangeFlow } from './useRangeChangeFlow.tsx';

function stepStatuses(current: RangeChangeStep): StepperStep[] {
  const index = RANGE_CHANGE_STEPS.indexOf(current as (typeof RANGE_CHANGE_STEPS)[number]);
  return RANGE_CHANGE_STEPS.map((id, i) => ({
    id,
    label: STEP_LABELS[id],
    status: current === 'done' ? 'done' : i < index ? 'done' : i === index ? 'current' : 'pending',
  }));
}

export interface BuildRangeChangePageProps {
  /** The resume path: finish an unfinished change from its journal record or a backup file. */
  mode?: 'wizard' | 'resume';
}

export default function BuildRangeChangePage({ mode = 'wizard' }: BuildRangeChangePageProps) {
  const { build, egressPaths } = useBuildLayout();
  const navigate = useNavigate();
  const location = useLocation();
  const [search] = useSearchParams();
  const egress = findRadioIoEgress(egressPaths);
  const descriptor = egress ? descriptorsForEgress(egress)[0] : undefined;
  const offered = egress ? listOfferedDangerZoneTools(build.radioTargetId).length > 0 : false;

  const [guardActive, setGuardActive] = useState(false);
  const permitRef = useRef(false);
  const { modalOpen, stay, leave } = useUnsavedNavigationGuard(guardActive, permitRef);

  const navigateInBuild = useCallback(
    (path: string, state?: unknown) => {
      // Leaving on purpose (a button on a finished or refused step): the guard must not stop it.
      permitRef.current = true;
      navigate(`/builds/${build.id}/${path}`, { state });
    },
    [navigate, build.id],
  );

  const stateSerial = (location.state as { serial?: string } | null)?.serial;
  const targetParam = Number.parseInt(search.get('target') ?? '', 10);
  const resume =
    mode === 'resume' ? { serial: search.get('file') === '1' ? 'file' : stateSerial } : undefined;

  const { view, actions } = useRangeChangeFlow({
    buildId: build.id,
    egress,
    descriptor,
    resume,
    initialTarget: Number.isInteger(targetParam) ? targetParam : undefined,
    navigateInBuild,
    leaveOpen: modalOpen,
    onLeaveStay: stay,
    onLeaveConfirm: leave,
    onGuardChange: setGuardActive,
  });

  useScreenWakeLock(view.busy || view.wiped);

  if (!egress || !offered) {
    return <Navigate to={`/builds/${build.id}/export`} replace />;
  }

  const numbered = RANGE_CHANGE_STEPS.includes(view.step as (typeof RANGE_CHANGE_STEPS)[number]);
  const index = RANGE_CHANGE_STEPS.indexOf(view.step as (typeof RANGE_CHANGE_STEPS)[number]);
  const showSteps = view.step !== 'resume';

  let body;
  switch (view.step) {
    case 'read':
      body = <ReadStep view={view} actions={actions} />;
      break;
    case 'newRange':
      body = <NewRangeStep view={view} actions={actions} />;
      break;
    case 'backUp':
      body = <BackUpStep view={view} actions={actions} />;
      break;
    case 'confirm':
      body = <ConfirmStep view={view} actions={actions} />;
      break;
    case 'change':
      body = <ChangeStep view={view} actions={actions} />;
      break;
    case 'restart':
      body = <RestartStep view={view} actions={actions} />;
      break;
    case 'restore':
      body = <RestoreStep view={view} actions={actions} />;
      break;
    case 'check':
      body = <CheckStep view={view} actions={actions} />;
      break;
    case 'done':
      body = <DoneStep view={view} actions={actions} />;
      break;
    case 'resume':
      body = <ResumeStep view={view} actions={actions} />;
      break;
  }

  return (
    <div className={classes.page} data-testid="range-change-page">
      <div className={classes.header}>
        <h1 className={classes.title}>{COPY.title}</h1>
        <p className={classes.strap} role="note">
          {COPY.strap}
        </p>
      </div>
      <div className={classes.shell}>
        {showSteps ? (
          <>
            <div className={classes.rail}>
              <Stepper
                steps={stepStatuses(view.step)}
                orientation="vertical"
                ariaLabel="Change frequency range steps"
              />
            </div>
            {numbered ? (
              <div className={classes.compact} data-testid="range-compact-steps">
                <p className={classes.compactLabel}>
                  {index + 1} of {RANGE_CHANGE_STEPS.length} ·{' '}
                  {STEP_LABELS[view.step as keyof typeof STEP_LABELS]}
                </p>
                <div className={classes.compactBar} aria-hidden>
                  <div
                    className={classes.compactFill}
                    style={{ width: `${((index + 1) / RANGE_CHANGE_STEPS.length) * 100}%` }}
                  />
                </div>
              </div>
            ) : null}
          </>
        ) : null}
        <div className={classes.body}>{body}</div>
      </div>
      <ConfirmModal
        open={modalOpen}
        onClose={actions.onLeaveStay}
        onConfirm={actions.onLeaveConfirm}
        title={COPY.restore.leaveTitle}
        confirmLabel={COPY.restore.leaveConfirm}
        cancelLabel={COPY.restore.stay}
        tone="destructive"
      >
        <p className={classes.text}>
          {view.wiped ? COPY.restore.leave : 'A transfer is running. Leave anyway?'}
        </p>
      </ConfirmModal>
    </div>
  );
}
