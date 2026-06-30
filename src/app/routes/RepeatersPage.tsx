import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  RepeaterDirectoryError,
  repeaterListingToChannel,
  searchBrandmeisterByCallsign,
  searchUkRepeatersByCallsign,
  searchUkRepeatersByLocator,
  type RepeaterListing,
  type RepeaterSource,
} from '@integrations/repeaters/index.ts';
import { useProjects } from '../state/useProjects.ts';
import { persistence } from '../state/persistence.ts';
import { hzToMhzString } from '../lib/units.ts';
import { controlStyle } from '../components/fields/styles.ts';
import { primaryButtonStyle, secondaryButtonStyle } from '../components/fields/styles.ts';

type SearchBy = 'callsign' | 'locator';

export default function RepeatersPage() {
  const { activeProjectId } = useProjects();
  const [source, setSource] = useState<RepeaterSource>('ukrepeater');
  const [searchBy, setSearchBy] = useState<SearchBy>('callsign');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<RepeaterListing[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());

  if (!activeProjectId) {
    return (
      <section>
        <h1 style={{ marginTop: 0 }}>Repeaters</h1>
        <p style={{ color: '#52606d' }}>
          Select or create a project on the <Link to="/">Projects</Link> page first.
        </p>
      </section>
    );
  }

  const canLocator = source === 'ukrepeater' && searchBy === 'locator';

  async function handleSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResults(null);
    setAdded(new Set());
    try {
      let listings: RepeaterListing[];
      if (source === 'brandmeister') {
        listings = await searchBrandmeisterByCallsign(query);
      } else if (canLocator) {
        listings = await searchUkRepeatersByLocator(query);
      } else {
        listings = await searchUkRepeatersByCallsign(query);
      }
      setResults(listings);
    } catch (err) {
      setError(
        err instanceof RepeaterDirectoryError ? err.message : 'Search failed. Please try again.',
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(listing: RepeaterListing) {
    const channel = repeaterListingToChannel(listing, activeProjectId!);
    const result = await persistence.putChannel(channel, null);
    if (result.ok) {
      setAdded((prev) => new Set(prev).add(listing.remoteId));
    }
  }

  return (
    <section>
      <h1 style={{ marginTop: 0 }}>Repeaters</h1>
      <p style={{ color: '#52606d' }}>
        Look up repeaters from public directories and add them to your library as vendor-neutral
        channels.
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          aria-label="Directory"
          style={controlStyle}
          value={source}
          onChange={(e) => setSource(e.target.value as RepeaterSource)}
        >
          <option value="ukrepeater">UK repeater (RSGB)</option>
          <option value="brandmeister">BrandMeister (DMR)</option>
        </select>
        {source === 'ukrepeater' && (
          <select
            aria-label="Search by"
            style={controlStyle}
            value={searchBy}
            onChange={(e) => setSearchBy(e.target.value as SearchBy)}
          >
            <option value="callsign">By callsign</option>
            <option value="locator">By locator</option>
          </select>
        )}
        <input
          aria-label="Search query"
          style={{ ...controlStyle, minWidth: 200 }}
          placeholder={canLocator ? 'e.g. IO91' : 'e.g. GB3DA'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void handleSearch();
          }}
        />
        <button type="button" onClick={() => void handleSearch()} style={primaryButtonStyle}>
          Search
        </button>
      </div>

      {loading && <p style={{ marginTop: '1rem' }}>Searching…</p>}
      {error && <p style={{ marginTop: '1rem', color: '#b91c1c' }}>{error}</p>}
      {results && results.length === 0 && !loading && (
        <p style={{ marginTop: '1rem', color: '#7b8794' }}>No repeaters found.</p>
      )}

      {results && results.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            marginTop: '1rem',
            display: 'grid',
            gap: '0.5rem',
          }}
        >
          {results.map((r) => {
            const isAdded = added.has(r.remoteId);
            return (
              <li
                key={`${r.source}:${r.remoteId}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.6rem 0.8rem',
                  border: '1px solid #e4e7eb',
                  borderRadius: 8,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>
                    {r.callsign} {r.name && <span style={{ color: '#52606d' }}>· {r.name}</span>}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#7b8794' }}>
                    {r.mode.toUpperCase()} · RX {hzToMhzString(r.rxFrequencyHz) || '—'} / TX{' '}
                    {hzToMhzString(r.txFrequencyHz) || '—'} MHz
                    {r.band ? ` · ${r.band}` : ''}
                    {r.location ? ' · 📍' : ''}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void handleAdd(r)}
                  disabled={isAdded}
                  style={isAdded ? secondaryButtonStyle : primaryButtonStyle}
                >
                  {isAdded ? 'Added ✓' : 'Add to library'}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
