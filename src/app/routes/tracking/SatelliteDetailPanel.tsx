import type { Satellite } from '@core/models/satellite.ts';
import { Panel } from '../../components/v2/index.ts';
import { hzToMhzString, optionalNumberToString } from '../../lib/units.ts';
import classes from './SatelliteDetailPanel.module.css';

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className={classes.field}>
      <span className={classes.label}>{label}</span>
      <span className={classes.value}>{value}</span>
    </div>
  );
}

function formatOptionalMhz(hz: number | null | undefined): string {
  if (hz === null || hz === undefined) return 'Not set';
  return `${hzToMhzString(hz)} MHz`;
}

function formatOptionalHz(hz: number | null | undefined): string {
  const value = optionalNumberToString(hz);
  return value === '' ? 'Not set' : `${value} Hz`;
}

/**
 * Static Keplerian + uplink/downlink detail panel for a single satellite. Read-only — editing
 * uplink/downlink/tone metadata happens on the Satellite Keps editor
 * (`src/app/routes/library/SatelliteEditor.tsx`); orbital elements are only ever refreshed from
 * CelesTrak/AMSAT, never edited by hand.
 */
export default function SatelliteDetailPanel({ satellite }: { satellite: Satellite }) {
  return (
    <Panel title="Orbital elements" sub={`Epoch ${new Date(satellite.epoch).toLocaleString()}`}>
      <div className={classes.grid}>
        <Field label="NORAD ID" value={String(satellite.noradId)} />
        <Field label="Source" value={satellite.source === 'celestrak' ? 'CelesTrak' : 'AMSAT'} />
        <Field label="Classification" value={satellite.classification || '—'} />
        <Field label="Inclination" value={`${satellite.inclinationDeg.toFixed(4)}°`} />
        <Field label="RAAN" value={`${satellite.raanDeg.toFixed(4)}°`} />
        <Field label="Eccentricity" value={satellite.eccentricity.toFixed(7)} />
        <Field label="Argument of perigee" value={`${satellite.argPerigeeDeg.toFixed(4)}°`} />
        <Field label="Mean anomaly" value={`${satellite.meanAnomalyDeg.toFixed(4)}°`} />
        <Field label="Mean motion" value={`${satellite.meanMotionRevPerDay.toFixed(8)} rev/day`} />
        <Field label="BSTAR" value={satellite.bstar.toExponential(4)} />
        <Field label="Element set number" value={String(satellite.elementSetNumber)} />
        <Field label="Revolution number" value={String(satellite.revolutionNumber)} />
      </div>

      <h3 className={classes.subheading}>Uplink / downlink</h3>
      <div className={classes.grid}>
        <Field label="Uplink frequency" value={formatOptionalMhz(satellite.uplinkHz)} />
        <Field label="Downlink frequency" value={formatOptionalMhz(satellite.downlinkHz)} />
        <Field label="Uplink tone" value={formatOptionalHz(satellite.uplinkToneHz)} />
        <Field label="Downlink tone" value={formatOptionalHz(satellite.downlinkToneHz)} />
      </div>
    </Panel>
  );
}
