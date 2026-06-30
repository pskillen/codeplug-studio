import { useState, type CSSProperties, type FormEvent } from 'react';
import { useProjects } from '../state/useProjects.ts';

export default function HomePage() {
  const {
    projects,
    activeProjectId,
    loading,
    createProject,
    switchProject,
    renameProject,
    deleteProject,
  } = useProjects();
  const [newName, setNewName] = useState('');

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    await createProject(newName);
    setNewName('');
  }

  return (
    <section>
      <h1 style={{ marginTop: 0 }}>Projects</h1>
      <p style={{ color: '#52606d' }}>
        Create a project to start a vendor-neutral channel library, then build format-specific
        codeplugs per radio. Library editing arrives in the next Phase 2 tickets.
      </p>

      <form onSubmit={handleCreate} style={{ display: 'flex', gap: '0.5rem', margin: '1.5rem 0' }}>
        <input
          aria-label="New project name"
          placeholder="New project name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          style={{
            flex: 1,
            maxWidth: 360,
            padding: '0.45rem 0.6rem',
            border: '1px solid #cbd2d9',
            borderRadius: 6,
            fontSize: '0.95rem',
          }}
        />
        <button type="submit" style={primaryButtonStyle}>
          Create project
        </button>
      </form>

      {loading ? (
        <p>Loading projects…</p>
      ) : projects.length === 0 ? (
        <EmptyState />
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.6rem' }}>
          {projects.map((project) => {
            const isActive = project.projectId === activeProjectId;
            return (
              <li
                key={project.projectId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.6rem',
                  padding: '0.7rem 0.9rem',
                  border: `1px solid ${isActive ? '#2f6f4f' : '#e4e7eb'}`,
                  borderRadius: 8,
                  background: isActive ? '#f0f7f2' : '#fff',
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{project.name}</div>
                  <div style={{ fontSize: '0.8rem', color: '#7b8794' }}>
                    Updated {new Date(project.updatedAt).toLocaleString()}
                  </div>
                </div>
                {isActive && <span style={activeBadgeStyle}>Active</span>}
                <button
                  type="button"
                  onClick={() => switchProject(project.projectId)}
                  disabled={isActive}
                  style={secondaryButtonStyle}
                >
                  {isActive ? 'Selected' : 'Open'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = window.prompt('Rename project', project.name);
                    if (next !== null) void renameProject(project.projectId, next);
                  }}
                  style={secondaryButtonStyle}
                >
                  Rename
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(`Delete project “${project.name}”?`)) {
                      void deleteProject(project.projectId);
                    }
                  }}
                  style={dangerButtonStyle}
                >
                  Delete
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function EmptyState() {
  return (
    <div
      style={{
        padding: '2rem',
        border: '1px dashed #cbd2d9',
        borderRadius: 10,
        textAlign: 'center',
        color: '#52606d',
        background: '#fafbfc',
      }}
    >
      <p style={{ margin: 0, fontWeight: 600 }}>No projects yet</p>
      <p style={{ margin: '0.4rem 0 0' }}>Create your first project above to get started.</p>
    </div>
  );
}

const primaryButtonStyle: CSSProperties = {
  padding: '0.45rem 0.9rem',
  border: 'none',
  borderRadius: 6,
  background: '#2f6f4f',
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
};

const secondaryButtonStyle: CSSProperties = {
  padding: '0.35rem 0.7rem',
  border: '1px solid #cbd2d9',
  borderRadius: 6,
  background: '#fff',
  color: '#1f2933',
  cursor: 'pointer',
};

const dangerButtonStyle: CSSProperties = {
  ...secondaryButtonStyle,
  color: '#b91c1c',
  borderColor: '#f1c0c0',
};

const activeBadgeStyle: CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 700,
  color: '#2f6f4f',
  background: '#dcefe3',
  padding: '0.15rem 0.45rem',
  borderRadius: 999,
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
};
