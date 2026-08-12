import { Navigate, useLocation } from 'react-router-dom';

/** Redirect legacy `/styleguide/*` URLs to `/styleguide/*` after v1 retirement. */
export default function StyleguideLegacyRedirect() {
  const { pathname } = useLocation();
  const suffix = pathname.replace(/^\/styleguide\/v2\/?/, '');
  const target = suffix ? `/styleguide/${suffix}` : '/styleguide';
  return <Navigate to={target} replace />;
}
