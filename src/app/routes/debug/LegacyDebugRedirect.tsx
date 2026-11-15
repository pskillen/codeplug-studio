import { Navigate, useLocation } from 'react-router-dom';

/** Preserve encoded path segments, query and hash during legacy redirects. */
export default function LegacyDebugRedirect() {
  const { pathname, search, hash } = useLocation();
  const next = pathname
    .replace(/^\/debug\/(indexed-db|local-storage)/, '/debug/storage/$1')
    .replace(/^\/debug\/serial-reopen/, '/debug/transport/serial-reopen');
  return <Navigate to={`${next}${search}${hash}`} replace />;
}
