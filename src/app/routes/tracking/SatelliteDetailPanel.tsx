import { useMediaQuery } from '@mantine/hooks';
import type { Satellite } from '@core/models/satellite.ts';
import type { SatelliteTransmitter } from '@core/models/satelliteTransmitter.ts';
import { Checkbox, Panel } from '../../components/v2/index.ts';
import { MOBILE_MAX_WIDTH_MEDIA_QUERY } from '../../lib/breakpoints.ts';
import { hzToMhzString, optionalNumberToString } from '../../lib/units.ts';
import { transmitterSourceLabel, visibleTransmitters } from '../library/satelliteEditorHelpers.ts';
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

function TransmitterCard({
  transmitter,
  onToggleIncludeInWrite,
}: {
  transmitter: SatelliteTransmitter;
  onToggleIncludeInWrite?: (transmitterId: string, includeInWrite: boolean) => void;
}) {
  return (
    <div className={classes.transmitter}>
      <div className={classes.transmitterTitle}>
        {transmitter.label || 'Transmitter'}
        <span className={classes.sourceBadge}>{transmitterSourceLabel(transmitter)}</span>
        {onToggleIncludeInWrite ? (
          <label className={classes.includeInWriteLabel}>
            <Checkbox
              checked={transmitter.includeInWrite}
              onCheckedChange={(checked) => onToggleIncludeInWrite(transmitter.id, checked)}
              aria-label={`Include ${transmitter.label || 'transmitter'} in radio write`}
            />
            Include in radio write
          </label>
        ) : null}
      </div>
      <div className={classes.grid}>
        <Field label="Mode" value={transmitter.mode ?? '—'} />
        <Field label="Uplink frequency" value={formatOptionalMhz(transmitter.uplinkHz)} />
        <Field label="Downlink frequency" value={formatOptionalMhz(transmitter.downlinkHz)} />
        <Field label="Uplink tone" value={formatOptionalHz(transmitter.uplinkToneHz)} />
        <Field label="Downlink tone" value={formatOptionalHz(transmitter.downlinkToneHz)} />
      </div>
    </div>
  );
}

/**
 * Static Keplerian + transmitters detail panel for a single satellite. Mostly read-only:
 * editing transmitter label/mode/frequency/tone metadata still happens only on the Satellite
 * Keps editor (`src/app/routes/library/SatelliteEditor.tsx`), and orbital elements are only
 * ever refreshed from CelesTrak/AMSAT, never edited by hand. The one interactive control here
 * is the per-transmitter "Include in radio write" toggle (#1067), shown when the caller passes
 * `onToggleIncludeInWrite` — it mirrors `SatelliteTransmitter.includeInWrite`, the same field
 * `SatelliteEditor.tsx` toggles, so edits made from either surface stay consistent.
 */
export default function SatelliteDetailPanel({
  satellite,
  onToggleIncludeInWrite,
}: {
  satellite: Satellite;
  onToggleIncludeInWrite?: (transmitterId: string, includeInWrite: boolean) => void;
}) {
  // Read synchronously on the first render (`getInitialValueInEffect: false`) — Panel's
  // `defaultCollapsed` is only consumed once, at its own mount, so the default async
  // (post-mount-effect) resolution would arrive one render too late to matter.
  const isMobile = useMediaQuery(MOBILE_MAX_WIDTH_MEDIA_QUERY, false, {
    getInitialValueInEffect: false,
  });

  const transmitters = visibleTransmitters(satellite.transmitters);

  return (
    <>
      <Panel
        title="Orbital elements"
        sub={`Epoch ${new Date(satellite.epoch).toLocaleString()}`}
        collapsible
        defaultCollapsed={isMobile}
      >
        <div className={classes.grid}>
          <Field label="NORAD ID" value={String(satellite.noradId)} />
          <Field label="Source" value={satellite.source === 'celestrak' ? 'CelesTrak' : 'AMSAT'} />
          <Field label="Classification" value={satellite.classification || '—'} />
          <Field label="Inclination" value={`${satellite.inclinationDeg.toFixed(4)}°`} />
          <Field label="RAAN" value={`${satellite.raanDeg.toFixed(4)}°`} />
          <Field label="Eccentricity" value={satellite.eccentricity.toFixed(7)} />
          <Field label="Argument of perigee" value={`${satellite.argPerigeeDeg.toFixed(4)}°`} />
          <Field label="Mean anomaly" value={`${satellite.meanAnomalyDeg.toFixed(4)}°`} />
          <Field
            label="Mean motion"
            value={`${satellite.meanMotionRevPerDay.toFixed(8)} rev/day`}
          />
          <Field label="BSTAR" value={satellite.bstar.toExponential(4)} />
          <Field label="Element set number" value={String(satellite.elementSetNumber)} />
          <Field label="Revolution number" value={String(satellite.revolutionNumber)} />
        </div>
      </Panel>

      <Panel title="Transmitters">
        {transmitters.length === 0 ? (
          <p className={classes.emptyTransmitters}>
            No transmitter data yet. Add one on the Satellite Keps editor, or refresh from SatNOGS.
          </p>
        ) : (
          <div className={classes.transmitterList}>
            {transmitters.map((transmitter) => (
              <TransmitterCard
                key={transmitter.id}
                transmitter={transmitter}
                onToggleIncludeInWrite={onToggleIncludeInWrite}
              />
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
