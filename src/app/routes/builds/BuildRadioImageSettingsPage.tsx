/**
 * Legacy route — per-build Radio Info replaced persisted bag inspection (#876).
 */

import { Navigate } from 'react-router-dom';
import { useBuildLayout } from './BuildLayoutContext.tsx';

export default function BuildRadioImageSettingsPage() {
  const { build } = useBuildLayout();
  return <Navigate to={`/builds/${build.id}/radio-info`} replace />;
}
