import { Navigate, useLocation } from 'react-router-dom';
import { DEFAULT_ZONE_PIVOT, zonePivotPath } from '../zonePivotQuery.ts';

/** Legacy `/library/channels` → unified zone-pivoted screen. */
export default function ChannelsListRedirect() {
  const location = useLocation();
  const target = zonePivotPath(DEFAULT_ZONE_PIVOT);
  if (location.pathname === '/library/channels' && location.search) {
    return <Navigate to={`${target}${location.search}`} replace />;
  }
  return <Navigate to={target} replace />;
}
