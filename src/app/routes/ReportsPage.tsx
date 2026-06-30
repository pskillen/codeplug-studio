import { Link } from 'react-router-dom';
import { summariseLibrary } from '@core/domain/summary.ts';
import { useLibrary } from '../state/useLibrary.ts';

export default function ReportsPage() {
  const { library, loading, projectId } = useLibrary();

  if (!projectId) {
    return (
      <section>
        <h1 style={{ marginTop: 0 }}>Reports</h1>
        <p style={{ color: '#52606d' }}>
          Select or create a project on the <Link to="/">Projects</Link> page first.
        </p>
      </section>
    );
  }

  if (loading) {
    return <p>Loading…</p>;
  }

  const summary = summariseLibrary(library);
  const counts: { label: string; value: number }[] = [
    { label: 'Channels', value: summary.counts.channels },
    { label: 'Talk groups', value: summary.counts.talkGroups },
    { label: 'Digital contacts', value: summary.counts.digitalContacts },
    { label: 'Analog contacts', value: summary.counts.analogContacts },
    { label: 'RX group lists', value: summary.counts.rxGroupLists },
    { label: 'Zones', value: summary.counts.zones },
  ];

  return (
    <section>
      <h1 style={{ marginTop: 0 }}>Reports</h1>
      <p style={{ color: '#52606d' }}>Read-only summary of the active project&apos;s library.</p>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
          gap: '0.6rem',
          margin: '1rem 0',
        }}
      >
        {counts.map((c) => (
          <div
            key={c.label}
            style={{ padding: '0.8rem', border: '1px solid #e4e7eb', borderRadius: 8 }}
          >
            <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{c.value}</div>
            <div style={{ fontSize: '0.8rem', color: '#7b8794' }}>{c.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        <Breakdown
          title="Channels by mode"
          rows={summary.channelsByMode.map((r) => ({ label: r.mode, count: r.count }))}
        />
        <Breakdown
          title="Channels by band"
          rows={summary.channelsByBand.map((r) => ({ label: r.band, count: r.count }))}
        />
      </div>

      <p style={{ marginTop: '1rem', color: '#52606d' }}>
        {summary.channelsWithLocation} channel(s) have a location (
        <Link to="/map">view on map</Link>).
      </p>

      <h2 style={{ fontSize: '1.05rem', marginTop: '1.5rem' }}>Integrity warnings</h2>
      {summary.danglingReferences.length === 0 ? (
        <p style={{ color: '#2f6f4f' }}>No dangling references — all relationships resolve.</p>
      ) : (
        <ul style={{ color: '#b91c1c' }}>
          {summary.danglingReferences.map((d, i) => (
            <li key={i}>
              {d.fromKind} “{d.fromName}” references a missing {d.targetKind} ({d.relationship})
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Breakdown({ title, rows }: { title: string; rows: { label: string; count: number }[] }) {
  return (
    <div>
      <h2 style={{ fontSize: '1.05rem' }}>{title}</h2>
      {rows.length === 0 ? (
        <p style={{ color: '#9aa5b1' }}>No channels.</p>
      ) : (
        <table style={{ borderCollapse: 'collapse' }}>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <td style={{ padding: '0.2rem 1rem 0.2rem 0' }}>{r.label}</td>
                <td style={{ padding: '0.2rem 0', fontWeight: 600 }}>{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
