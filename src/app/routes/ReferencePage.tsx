import { useState } from 'react';
import { coordsToLocator, isValidLocator, locatorToCoords } from '@core/domain/maidenhead.ts';
import { BAND_PLAN, bandLabelForFrequencyHz } from '@core/domain/bandPlan.ts';
import { mhzStringToHz } from '../lib/units.ts';
import { controlStyle } from '../components/fields/styles.ts';
import { FieldRow } from '../components/fields/Fields.tsx';

export default function ReferencePage() {
  return (
    <section>
      <h1 style={{ marginTop: 0 }}>Reference</h1>
      <p style={{ color: '#52606d' }}>
        Amateur radio helpers for programming convenience — not authoritative for on-air operation.
      </p>
      <MaidenheadConverter />
      <FrequencyLookup />
      <BandPlanTable />
    </section>
  );
}

function MaidenheadConverter() {
  const [locator, setLocator] = useState('IO91');
  const [lat, setLat] = useState('51.5');
  const [lon, setLon] = useState('-0.1');

  const coords = isValidLocator(locator) ? locatorToCoords(locator) : null;
  const latNum = Number(lat);
  const lonNum = Number(lon);
  const derivedLocator =
    Number.isFinite(latNum) && Number.isFinite(lonNum) ? coordsToLocator(latNum, lonNum, 6) : null;

  return (
    <div style={{ margin: '1.5rem 0' }}>
      <h2 style={{ fontSize: '1.05rem' }}>Maidenhead locator</h2>
      <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>
        <div>
          <FieldRow label="Locator → coordinates">
            <input
              style={controlStyle}
              value={locator}
              onChange={(e) => setLocator(e.target.value)}
            />
          </FieldRow>
          <p style={{ fontSize: '0.85rem', color: coords ? '#1f2933' : '#b91c1c' }}>
            {coords
              ? `Lat ${coords.lat.toFixed(4)}, Lon ${coords.lon.toFixed(4)}`
              : 'Enter a valid locator (e.g. IO91, IO91wm).'}
          </p>
        </div>
        <div>
          <FieldRow label="Coordinates → locator">
            <div style={{ display: 'flex', gap: '0.4rem' }}>
              <input
                style={{ ...controlStyle, minWidth: 100 }}
                aria-label="Latitude"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
              />
              <input
                style={{ ...controlStyle, minWidth: 100 }}
                aria-label="Longitude"
                value={lon}
                onChange={(e) => setLon(e.target.value)}
              />
            </div>
          </FieldRow>
          <p style={{ fontSize: '0.85rem' }}>
            {derivedLocator ? `Locator ${derivedLocator}` : '—'}
          </p>
        </div>
      </div>
    </div>
  );
}

function FrequencyLookup() {
  const [mhz, setMhz] = useState('145.5');
  const hz = mhzStringToHz(mhz);
  const band = bandLabelForFrequencyHz(hz);
  return (
    <div style={{ margin: '1.5rem 0' }}>
      <h2 style={{ fontSize: '1.05rem' }}>Frequency → band</h2>
      <FieldRow label="Frequency (MHz)">
        <input style={controlStyle} value={mhz} onChange={(e) => setMhz(e.target.value)} />
      </FieldRow>
      <p style={{ fontSize: '0.85rem' }}>
        Band: <strong>{band}</strong>
      </p>
    </div>
  );
}

function BandPlanTable() {
  return (
    <div style={{ margin: '1.5rem 0' }}>
      <h2 style={{ fontSize: '1.05rem' }}>Band plan</h2>
      <table style={{ borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '1px solid #cbd2d9' }}>
            <th style={{ padding: '0.3rem 1rem 0.3rem 0' }}>Band</th>
            <th style={{ padding: '0.3rem 1rem 0.3rem 0' }}>Name</th>
            <th style={{ padding: '0.3rem 1rem 0.3rem 0' }}>Range (MHz)</th>
            <th style={{ padding: '0.3rem 0' }}>Service</th>
          </tr>
        </thead>
        <tbody>
          {BAND_PLAN.map((b) => (
            <tr key={b.label} style={{ borderBottom: '1px solid #eef1f4' }}>
              <td style={{ padding: '0.3rem 1rem 0.3rem 0', fontWeight: 600 }}>{b.label}</td>
              <td style={{ padding: '0.3rem 1rem 0.3rem 0' }}>{b.name}</td>
              <td style={{ padding: '0.3rem 1rem 0.3rem 0' }}>
                {(b.startHz / 1_000_000).toFixed(3)}–{(b.endHz / 1_000_000).toFixed(3)}
              </td>
              <td style={{ padding: '0.3rem 0' }}>{b.service}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: '0.75rem', color: '#9aa5b1' }}>
        For programming convenience only. Not authoritative for on-air operation.
      </p>
    </div>
  );
}
