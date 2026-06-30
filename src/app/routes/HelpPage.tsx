export default function HelpPage() {
  return (
    <section>
      <h1 style={{ marginTop: 0 }}>Help</h1>
      <p style={{ color: '#52606d' }}>
        Codeplug Studio is a browser-based designer for amateur radio codeplug layouts. Curate one
        vendor-neutral library, then assemble format-specific builds per radio.
      </p>
      <ul style={{ color: '#52606d', lineHeight: 1.7 }}>
        <li>
          <strong>Projects</strong> — create, switch, rename, and delete projects.
        </li>
        <li>
          <strong>Library</strong> — channels, talk groups, contacts, RX group lists, zones (coming
          soon).
        </li>
        <li>
          <strong>Map &amp; Reports</strong> — visualise and summarise your library (coming soon).
        </li>
      </ul>
      <p style={{ fontSize: '0.85rem' }}>
        <a href="https://github.com/pskillen/codeplug-studio">Project repository &amp; docs</a>
      </p>
    </section>
  );
}
