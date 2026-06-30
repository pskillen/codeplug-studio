import { Link } from 'react-router-dom';
import type { LibraryEntityKind } from '@integrations/persistence/index.ts';
import { useLibrary } from '../state/useLibrary.ts';
import { dangerButtonStyle, primaryButtonStyle } from '../components/fields/styles.ts';
import { LIBRARY_KINDS, describeEntity, entitiesForKind } from './library/registry.ts';

export default function LibraryPage() {
  const { library, loading, projectId, deleteEntity } = useLibrary();

  if (!projectId) {
    return (
      <section>
        <h1 style={{ marginTop: 0 }}>Library</h1>
        <p style={{ color: '#52606d' }}>
          Select or create a project on the <Link to="/">Projects</Link> page first.
        </p>
      </section>
    );
  }

  async function handleDelete(kind: LibraryEntityKind, id: string, name: string) {
    if (!window.confirm(`Delete “${name}”?`)) return;
    const outcome = await deleteEntity(kind, id);
    if (!outcome.ok) {
      const where = outcome.references.map((r) => `• ${r.fromName} (${r.relationship})`).join('\n');
      window.alert(`Cannot delete “${name}” — still referenced by:\n\n${where}`);
    }
  }

  return (
    <section>
      <h1 style={{ marginTop: 0 }}>Library</h1>
      <p style={{ color: '#52606d' }}>Curate the vendor-neutral inventory for this project.</p>
      {loading ? (
        <p>Loading library…</p>
      ) : (
        LIBRARY_KINDS.map((meta) => {
          const rows = entitiesForKind(library, meta.kind);
          return (
            <div key={meta.kind} style={{ margin: '1.5rem 0' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  marginBottom: '0.5rem',
                }}
              >
                <h2 style={{ fontSize: '1.05rem', margin: 0 }}>
                  {meta.plural} <span style={{ color: '#9aa5b1' }}>({rows.length})</span>
                </h2>
                <Link to={`/library/${meta.slug}/new`} style={primaryButtonStyle}>
                  + Add
                </Link>
              </div>
              {rows.length === 0 ? (
                <p style={{ color: '#9aa5b1', margin: 0, fontSize: '0.9rem' }}>None yet.</p>
              ) : (
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    display: 'grid',
                    gap: '0.4rem',
                  }}
                >
                  {rows.map((row) => {
                    const name = row.name;
                    return (
                      <li
                        key={row.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.6rem',
                          padding: '0.5rem 0.75rem',
                          border: '1px solid #e4e7eb',
                          borderRadius: 8,
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <Link
                            to={`/library/${meta.slug}/${row.id}`}
                            style={{ fontWeight: 600, color: '#1f2933' }}
                          >
                            {name}
                          </Link>
                          <div style={{ fontSize: '0.78rem', color: '#7b8794' }}>
                            {describeEntity(library, meta.kind, row.id)}
                          </div>
                        </div>
                        <Link
                          to={`/library/${meta.slug}/${row.id}`}
                          style={{ fontSize: '0.85rem' }}
                        >
                          Edit
                        </Link>
                        <button
                          type="button"
                          onClick={() => handleDelete(meta.kind, row.id, name)}
                          style={dangerButtonStyle}
                        >
                          Delete
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })
      )}
    </section>
  );
}
