import type { PassResult } from '@core/domain/satelliteTracking/types.ts';
import {
  formatLocalClockTime,
  formatNextPassCountdown,
  formatUtcClockTime,
  isPassActive,
} from '../../routes/tracking/passTime.ts';
import { hzToMhzString, optionalNumberToString } from '../../lib/units.ts';
import classes from './NextPassCard.module.css';

export interface NextPassCardTransmitter {
  id: string;
  label: string;
  mode: string | null;
  uplinkHz: number | null;
  downlinkHz: number | null;
  uplinkToneHz: number | null;
  downlinkToneHz: number | null;
  /** Doppler-corrected values — undefined/null when not applicable (pass not active, or this transmitter has no frequency). */
  dopplerUplinkHz?: number | null;
  dopplerDownlinkHz?: number | null;
}

export interface NextPassCardProps {
  satelliteName: string;
  /** Earliest upcoming pass, or `null` if none in the current look-ahead window. */
  nextPass: PassResult | null;
  /** Caller-supplied clock tick (e.g. `useNowTick`) — keeps this component a pure function of props. */
  nowMs: number;
  /** Whether an observer location is configured at all, distinct from "no pass in this window". */
  hasObserver: boolean;
  /** One block per transmitter — empty array renders a "no transmitter data" message. */
  transmitters: NextPassCardTransmitter[];
  /**
   * Anchor id of the page's "Upcoming passes" table — when set, renders a mobile-only "Jump to
   * upcoming passes" link so the countdown/AOS/LOS above stays reachable without scrolling past
   * the rest of the page first. Hidden above the desktop breakpoint, where the table is already
   * close by.
   */
  upcomingPassesAnchorId?: string;
}

function formatOptionalMhz(hz: number | null | undefined): string {
  if (hz === null || hz === undefined) return '—';
  return `${hzToMhzString(hz)} MHz`;
}

function formatOptionalHz(hz: number | null | undefined): string {
  const value = optionalNumberToString(hz);
  return value === '' ? '—' : `${value} Hz`;
}

/**
 * Highlighted "next pass" summary card — AOS/LOS/max-elevation, then one block per transmitter
 * with its static uplink/downlink/tone/mode, and (while the pass is active) Doppler-corrected
 * uplink/downlink shown alongside the static values. Presentational: takes fully-resolved data
 * as props, does no fetching or propagation itself — same shape as `BuildListCard`, the pattern
 * this is modeled on.
 */
export default function NextPassCard({
  satelliteName,
  nextPass,
  nowMs,
  hasObserver,
  transmitters,
  upcomingPassesAnchorId,
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
              <span className={classes.value}>{formatLocalClockTime(nextPass.aosAt)} local</span>
              <span className={classes.utcValue}>{formatUtcClockTime(nextPass.aosAt)} UTC</span>
            </div>
            <div className={classes.field}>
              <span className={classes.label}>LOS</span>
              <span className={classes.value}>{formatLocalClockTime(nextPass.losAt)} local</span>
              <span className={classes.utcValue}>{formatUtcClockTime(nextPass.losAt)} UTC</span>
            </div>
            <div className={classes.field}>
              <span className={classes.label}>Max elevation</span>
              <span className={classes.value}>{nextPass.maxElevationDeg.toFixed(1)}°</span>
            </div>
          </div>

          {transmitters.length === 0 ? (
            <p className={classes.empty}>No transmitter data for this satellite.</p>
          ) : (
            transmitters.map((transmitter) => (
              <div key={transmitter.id} className={classes.transmitterBlock}>
                <div className={classes.transmitterLabel}>{transmitter.label}</div>
                <div className={classes.grid}>
                  <div className={classes.field}>
                    <span className={classes.label}>Mode</span>
                    <span className={classes.value}>{transmitter.mode ?? '—'}</span>
                  </div>
                  <div className={classes.field}>
                    <span className={classes.label}>Uplink</span>
                    <span className={classes.value}>{formatOptionalMhz(transmitter.uplinkHz)}</span>
                    {active && transmitter.dopplerUplinkHz != null ? (
                      <span className={classes.dopplerValue}>
                        {formatOptionalMhz(transmitter.dopplerUplinkHz)}
                      </span>
                    ) : null}
                  </div>
                  <div className={classes.field}>
                    <span className={classes.label}>Downlink</span>
                    <span className={classes.value}>
                      {formatOptionalMhz(transmitter.downlinkHz)}
                    </span>
                    {active && transmitter.dopplerDownlinkHz != null ? (
                      <span className={classes.dopplerValue}>
                        {formatOptionalMhz(transmitter.dopplerDownlinkHz)}
                      </span>
                    ) : null}
                  </div>
                  <div className={classes.field}>
                    <span className={classes.label}>Uplink tone</span>
                    <span className={classes.value}>
                      {formatOptionalHz(transmitter.uplinkToneHz)}
                    </span>
                  </div>
                  <div className={classes.field}>
                    <span className={classes.label}>Downlink tone</span>
                    <span className={classes.value}>
                      {formatOptionalHz(transmitter.downlinkToneHz)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </>
      )}

      {upcomingPassesAnchorId ? (
        <a href={`#${upcomingPassesAnchorId}`} className={classes.jumpLink}>
          Jump to upcoming passes ↓
        </a>
      ) : null}
    </div>
  );
}
