import { Link } from 'react-router-dom';

export default function HomePage() {
  return (
    <section>
      <h1>Codeplug Studio</h1>
      <p>Phase 1 scaffold — library and format builds land in Phase 2.</p>
      <p>
        <a href="https://github.com/pskillen/codeplug-studio">GitHub repository</a>
      </p>
      <p style={{ fontSize: '0.9rem', color: '#555' }}>
        Design your channel library once, then build format-specific codeplugs per radio.
      </p>
      <p style={{ fontSize: '0.85rem' }}>
        <Link to="/">Home</Link>
      </p>
    </section>
  );
}
