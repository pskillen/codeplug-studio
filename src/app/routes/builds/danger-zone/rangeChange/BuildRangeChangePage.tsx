/**
 * Danger zone: Change frequency range (#1369). `/builds/:id/export/danger-zone/frequency-range`, and
 * `.../frequency-range/resume` to finish an unfinished change. A page wizard of eight steps and a Done screen;
 * `useRangeChangeFlow` owns the sessions, `RangeChangeScreen` lays them out.
 */

import { useCallback, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ConfirmModal } from '../../../../components/v2/index.ts';
import { findRadioIoEgress } from '../../../../lib/buildEgressUi.ts';
import { useScreenWakeLock } from '../../../../hooks/useScreenWakeLock.ts';
import { useUnsavedNavigationGuard } from '../../../../hooks/useUnsavedNavigationGuard.ts';
import { descriptorsForEgress } from '../../../../services/radioIoSession.ts';
import { listOfferedDangerZoneTools } from '../../../../services/dangerZone/gate.ts';
import { useBuildLayout } from '../../BuildLayoutContext.tsx';
import classes from './RangeChange.module.css';
import { COPY } from './rangeChangeCopy.ts';
import RangeChangeScreen from './RangeChangeScreen.tsx';
import { useRangeChangeFlow } from './useRangeChangeFlow.tsx';

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

  return (
    <RangeChangeScreen view={view} actions={actions}>
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
    </RangeChangeScreen>
  );
}
