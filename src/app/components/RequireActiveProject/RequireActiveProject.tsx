import { Navigate, Outlet } from 'react-router-dom';
import { useProjects } from '../../state/useProjects.ts';

export default function RequireActiveProject() {
  const { activeProjectId } = useProjects();

  if (activeProjectId == null) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
