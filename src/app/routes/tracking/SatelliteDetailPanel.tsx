import { useMediaQuery } from '@mantine/hooks';
import type { Satellite } from '@core/models/satellite.ts';
import type {
  SatelliteEnrichment,
  SatelliteTransmitterInfo,
} from '@core/models/satelliteEnrichment.ts';
import { Panel } from '../../components/v2/index.ts';
import { MOBILE_MAX_WIDTH_MEDIA_QUERY } from '../../lib/breakpoints.ts';
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

function formatTransmitterFrequency(hz: number | null): string {
  if (hz === null) return '—';
  return `${hzToMhzString(hz)} MHz`;
}

function TransmitterCard({ transmitter }: { transmitter: SatelliteTransmitterInfo }) {
  return (
    <div className={classes.transmitter}>
      <div className={classes.transmitterTitle}>{transmitter.description || 'Transmitter'}</div>
      <div className={classes.grid}>
        <Field label="Mode" value={transmitter.mode ?? '—'} />
        <Field label="Downlink" value={formatTransmitterFrequency(transmitter.downlinkHz)} />
        <Field label="Uplink" value={formatTransmitterFrequency(transmitter.uplinkHz)} />
        <Field label="Alive" value={transmitter.alive ? 'Yes' : 'No'} />
        <Field label="Status" value={transmitter.status ?? '—'} />
      </div>
    </div>
  );
}

/**
 * Static Keplerian + uplink/downlink detail panel for a single satellite. Read-only — editing
 * uplink/downlink/tone metadata happens on the Satellite Keps editor
 * (`src/app/routes/library/SatelliteEditor.tsx`); orbital elements are only ever refreshed from
 * CelesTrak/AMSAT, never edited by hand.
 */
export default function SatelliteDetailPanel({
  satellite,
  enrichment,
}: {
  satellite: Satellite;
  enrichment: SatelliteEnrichment | null;
}) {
  // Read synchronously on the first render (`getInitialValueInEffect: false`) — Panel's
  // `defaultCollapsed` is only consumed once, at its own mount, so the default async
  // (post-mount-effect) resolution would arrive one render too late to matter.
  const isMobile = useMediaQuery(MOBILE_MAX_WIDTH_MEDIA_QUERY, false, {
    getInitialValueInEffect: false,
  });

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

        <h3 className={classes.subheading}>Uplink / downlink</h3>
        <div className={classes.grid}>
          {/* Minimal single-transmitter fix — full multi-transmitter panel lands in phase 4. */}
          <Field
            label="Uplink frequency"
            value={formatOptionalMhz(satellite.transmitters[0]?.uplinkHz ?? null)}
          />
          <Field
            label="Downlink frequency"
            value={formatOptionalMhz(satellite.transmitters[0]?.downlinkHz ?? null)}
          />
          <Field
            label="Uplink tone"
            value={formatOptionalHz(satellite.transmitters[0]?.uplinkToneHz ?? null)}
          />
          <Field
            label="Downlink tone"
            value={formatOptionalHz(satellite.transmitters[0]?.downlinkToneHz ?? null)}
          />
        </div>
      </Panel>

      <Panel
        title="SatNOGS transmitters"
        sub={
          enrichment
            ? `Last fetched ${new Date(enrichment.fetchedAt).toLocaleString()}`
            : 'Session-scoped enrichment — not persisted to the library'
        }
      >
        {!enrichment || enrichment.transmitters.length === 0 ? (
          <p className={classes.emptyEnrichment}>
            No SatNOGS transmitter data yet. Use “Refresh SatNOGS” to fetch mode and frequency
            details for this satellite.
          </p>
        ) : (
          <div className={classes.transmitterList}>
            {enrichment.transmitters.map((transmitter) => (
              <TransmitterCard key={transmitter.uuid} transmitter={transmitter} />
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
