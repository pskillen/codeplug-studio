import { Link } from 'react-router-dom';
import { useProjects } from '../state/useProjects.ts';

interface FeaturePlaceholderProps {
  title: string;
  ticket: string;
  description: string;
  requiresProject?: boolean;
}

export default function FeaturePlaceholder({
  title,
  ticket,
  description,
  requiresProject = true,
}: FeaturePlaceholderProps) {
  const { activeProject } = useProjects();

  return (
    <section>
      <h1 style={{ marginTop: 0 }}>{title}</h1>
      {requiresProject && !activeProject ? (
        <p style={{ color: '#52606d' }}>
          Select or create a project on the <Link to="/">Projects</Link> page first.
        </p>
      ) : (
        <>
          <p style={{ color: '#52606d' }}>{description}</p>
          {activeProject && (
            <p style={{ fontSize: '0.85rem', color: '#7b8794' }}>
              Active project: <strong>{activeProject.name}</strong>
            </p>
          )}
        </>
      )}
      <p
        style={{
          marginTop: '1.5rem',
          padding: '0.6rem 0.9rem',
          background: '#f5f7fa',
          border: '1px solid #e4e7eb',
          borderRadius: 8,
          fontSize: '0.85rem',
          color: '#52606d',
        }}
      >
        Planned for Phase 2 {ticket}.
      </p>
    </section>
  );
}
