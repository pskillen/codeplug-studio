import { Navigate } from 'react-router-dom';

/** Legacy route — scrolls to Scanning behaviour on the main zone workspace. */
export default function ZoneEditScanningPage() {
  return <Navigate to="../#scanning" replace />;
}
