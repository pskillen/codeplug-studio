import { useCallback } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { findRadioIoEgress } from '../../../../lib/buildEgressUi.ts';
import { listOfferedDangerZoneTools } from '../../../../services/dangerZone/gate.ts';
import { RADIOFOUNDRY_STORAGE_CLAIM_TOOL_ID } from '../../../../services/dangerZone/registry.ts';
import { useBuildLayout } from '../../BuildLayoutContext.tsx';
import StorageClaimScreen from './StorageClaimScreen.tsx';
import { useStorageClaimFlow } from './useStorageClaimFlow.tsx';

export default function BuildStorageClaimPage() {
  const { build, egressPaths } = useBuildLayout();
  const navigate = useNavigate();
  const egress = findRadioIoEgress(egressPaths);
  const offered = listOfferedDangerZoneTools(build.radioTargetId).some(
    (t) => t.id === RADIOFOUNDRY_STORAGE_CLAIM_TOOL_ID,
  );

  const navigateInBuild = useCallback(
    (path: string) => navigate(`/builds/${build.id}/${path}`),
    [navigate, build.id],
  );

  const { view, actions } = useStorageClaimFlow({
    buildId: build.id,
    egress: egress!,
    navigateInBuild,
  });

  if (!egress || !offered) {
    return <Navigate to={`/builds/${build.id}/export`} replace />;
  }

  return <StorageClaimScreen view={view} actions={actions} />;
}
