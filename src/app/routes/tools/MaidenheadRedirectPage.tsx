import { Navigate, useSearchParams } from 'react-router-dom';
import { wantsBearing } from './wantsBearing.ts';

/**
 * `/reference/maidenhead` was one page with Convert and Bearing tabs; it is now two Field tools.
 * Bearing links go to Distance & bearing, everything else to My locator.
 */
export default function MaidenheadRedirectPage() {
  const [params] = useSearchParams();
  return <Navigate to={wantsBearing(params) ? '/tools/bearing' : '/tools/locator'} replace />;
}
