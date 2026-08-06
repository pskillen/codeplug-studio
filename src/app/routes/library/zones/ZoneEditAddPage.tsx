import { Navigate } from 'react-router-dom';

/** Legacy route — opens add overlay on the main zone workspace. */
export default function ZoneEditAddPage() {
  return <Navigate to="?add=members" replace />;
}
