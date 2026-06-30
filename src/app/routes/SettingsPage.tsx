export default function SettingsPage() {
  return (
    <section>
      <h1 style={{ marginTop: 0 }}>Settings</h1>
      <p style={{ color: '#52606d' }}>
        Application preferences live here. Projects and operator data stay in browser storage only —
        nothing is sent to a server.
      </p>
      <p style={{ fontSize: '0.85rem', color: '#7b8794' }}>
        Persistence currently runs in-memory for the session; durable browser storage arrives in
        Phase 2 ticket #9.
      </p>
    </section>
  );
}
