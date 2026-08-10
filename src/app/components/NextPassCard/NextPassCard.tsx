import type { PassResult } from '@core/domain/satelliteTracking/types.ts';
import { formatNextPassCountdown, isPassActive } from '../../routes/tracking/passTime.ts';
import { hzToMhzString, optionalNumberToString } from '../../lib/units.ts';
import classes from './NextPassCard.module.css';

export interface NextPassCardProps {
  satelliteName: string;
  /** Earliest upcoming pass, or `null` if none in the current look-ahead window. */
  nextPass: PassResult | null;
  /** Caller-supplied clock tick (e.g. `useNowTick`) — keeps this component a pure function of props. */
  nowMs: number;
  /** Whether an observer location is configured at all, distinct from "no pass in this window". */
  hasObserver: boolean;
  uplinkHz?: number | null;
  downlinkHz?: number | null;
  uplinkToneHz?: number | null;
  downlinkToneHz?: number | null;
  /** Best-effort mode from SatNOGS enrichment — not a persisted `Satellite` field. */
  mode?: string | null;
  /** Doppler-corrected uplink, shown only while a pass is active. */
  dopplerUplinkHz?: number | null;
  /** Doppler-corrected downlink, shown only while a pass is active. */
  dopplerDownlinkHz?: number | null;
}

function formatOptionalMhz(hz: number | null | undefined): string {
  if (hz === null || hz === undefined) return '—';
  return `${hzToMhzString(hz)} MHz`;
}

function formatOptionalHz(hz: number | null | undefined): string {
  const value = optionalNumberToString(hz);
  return value === '' ? '—' : `${value} Hz`;
}

function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

/**
 * Highlighted "next pass" summary card — AOS/LOS/max-elevation, static uplink/downlink/tone/
 * mode, and (while the pass is active) Doppler-corrected uplink/downlink shown alongside the
 * static values. Presentational: takes fully-resolved data as props, does no fetching or
 * propagation itself — same shape as `BuildListCard`, the pattern this is modeled on.
 */
export default function NextPassCard({
  satelliteName,
  nextPass,
  nowMs,
  hasObserver,
  uplinkHz,
  downlinkHz,
  uplinkToneHz,
  downlinkToneHz,
  mode,
  dopplerUplinkHz,
  dopplerDownlinkHz,
}: NextPassCardProps) {
  const active = nextPass ? isPassActive(nowMs, nextPass.aosAt, nextPass.losAt) : false;
  const countdown = nextPass
    ? formatNextPassCountdown(nowMs, nextPass.aosAt, nextPass.losAt)
    : null;

  return (
    <div className={[classes.card, active ? classes.active : ''].filter(Boolean).join(' ')}>
      <div className={classes.topRow}>
        <div>
          <div className={classes.title}>Next pass</div>
          <div className={classes.subtitle}>{satelliteName}</div>
        </div>
        {active ? <span className={classes.activeBadge}>Above horizon</span> : null}
        {countdown ? <span className={classes.countdown}>{countdown}</span> : null}
      </div>

      {!hasObserver ? (
        <p className={classes.empty}>Set an observer location to see pass predictions.</p>
      ) : !nextPass ? (
        <p className={classes.empty}>No upcoming pass in the current look-ahead window.</p>
      ) : (
        <>
          <div className={classes.grid}>
            <div className={classes.field}>
              <span className={classes.label}>AOS</span>
              <span className={classes.value}>{formatClockTime(nextPass.aosAt)}</span>
            </div>
            <div className={classes.field}>
              <span className={classes.label}>LOS</span>
              <span className={classes.value}>{formatClockTime(nextPass.losAt)}</span>
            </div>
            <div className={classes.field}>
              <span className={classes.label}>Max elevation</span>
              <span className={classes.value}>{nextPass.maxElevationDeg.toFixed(1)}°</span>
            </div>
            <div className={classes.field}>
              <span className={classes.label}>Mode</span>
              <span className={classes.value}>{mode ?? '—'}</span>
            </div>
          </div>

          <div className={classes.grid}>
            <div className={classes.field}>
              <span className={classes.label}>Uplink</span>
              <span className={classes.value}>{formatOptionalMhz(uplinkHz)}</span>
              {active && dopplerUplinkHz != null ? (
                <span className={classes.dopplerValue}>{formatOptionalMhz(dopplerUplinkHz)}</span>
              ) : null}
            </div>
            <div className={classes.field}>
              <span className={classes.label}>Downlink</span>
              <span className={classes.value}>{formatOptionalMhz(downlinkHz)}</span>
              {active && dopplerDownlinkHz != null ? (
                <span className={classes.dopplerValue}>{formatOptionalMhz(dopplerDownlinkHz)}</span>
              ) : null}
            </div>
            <div className={classes.field}>
              <span className={classes.label}>Uplink tone</span>
              <span className={classes.value}>{formatOptionalHz(uplinkToneHz)}</span>
            </div>
            <div className={classes.field}>
              <span className={classes.label}>Downlink tone</span>
              <span className={classes.value}>{formatOptionalHz(downlinkToneHz)}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
