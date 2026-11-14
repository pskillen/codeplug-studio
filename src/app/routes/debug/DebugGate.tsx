import { Navigate, Outlet } from 'react-router-dom';
import { useDeveloperMode } from '../../hooks/useDeveloperMode.ts';
import { resolveDebugPagesGate } from '../../services/prodFeatureGate.ts';

/**
 * Layout route over every `/debug/*` page (#1650). On prod the Debug pages are hidden unless developer mode is on for
 * this device; a hidden page redirects home. Every debug route is a child of this one: add new pages to
 * `debugRoutes` in `./debugRoutes.tsx`, never directly to the app router.
 */
export default function DebugGate() {
  const [developerMode] = useDeveloperMode();
  if (resolveDebugPagesGate({ developerMode }) === 'hidden') return <Navigate to="/" replace />;
  return <Outlet />;
}
