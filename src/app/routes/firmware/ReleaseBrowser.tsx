import { useEffect, useState } from 'react';

import { FirmwareError } from '@core/firmware/errors.ts';
import type { FirmwareReleaseSummary } from '@core/firmware/releases/types.ts';
import type { FirmwareUpdaterDescriptor } from '@integrations/radio-io';

import { Button, Panel, Pill, StatusBanner, ToggleSwitch } from '../../components/v2/index.ts';
import { listPublishedReleases } from '../../services/firmwareFlash.ts';
import classes from './FirmwareFlasherPage.module.css';
import ReleaseNotesDisclosure from './ReleaseNotesDisclosure.tsx';

export const FIRMWARE_BROWSE_ONLY =
  "This browser can't flash firmware: flashing needs Web Serial, which phones, tablets and some desktop browsers don't have. To flash, open this page in Chrome or Edge on a desktop computer. You can still read about each published release here.";

type Listing =
  | { kind: 'loading' }
  | { kind: 'ready'; list: readonly FirmwareReleaseSummary[] }
  | { kind: 'failed'; message: string };

function RadioReleases({
  updater,
  includeRc,
}: {
  updater: FirmwareUpdaterDescriptor;
  includeRc: boolean;
}) {
  const [listing, setListing] = useState<{ key: string; value: Listing } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const key = `${updater.radioId}:${includeRc}:${attempt}`;

  useEffect(() => {
    let cancelled = false;
    listPublishedReleases(updater.radioId, includeRc)
      .then((list) => {
        if (!cancelled) setListing({ key, value: { kind: 'ready', list } });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setListing({
            key,
            value: {
              kind: 'failed',
              message:
                err instanceof FirmwareError
                  ? err.message
                  : 'The firmware release list could not be downloaded.',
            },
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [updater.radioId, includeRc, key]);

  const value: Listing = listing?.key === key ? listing.value : { kind: 'loading' };

  return (
    <Panel title={updater.stock.label} sub={`Built on stock firmware ${updater.stock.version}`}>
      <div className={classes.stack}>
        {value.kind === 'loading' ? <p className={classes.muted}>Loading releases…</p> : null}
        {value.kind === 'failed' ? (
          <>
            <StatusBanner tone="warning">{value.message}</StatusBanner>
            <div>
              <Button variant="secondary" size="sm" onClick={() => setAttempt((n) => n + 1)}>
                Try again
              </Button>
            </div>
          </>
        ) : null}
        {value.kind === 'ready' && value.list.length === 0 ? (
          <p className={classes.muted}>No releases are published for this radio yet.</p>
        ) : null}
        {value.kind === 'ready'
          ? value.list.map((summary) => (
              <div key={summary.key} className={classes.card}>
                <span className={classes.cardTitle}>
                  {summary.title}
                  {summary.channel === 'rc' ? <Pill tone="warning">Pre-release</Pill> : null}
                </span>
                <span className={classes.cardMeta}>Published {summary.release!.publishedOn}</span>
                <span className={classes.copy}>{summary.release!.summary}</span>
                <ReleaseNotesDisclosure summary={summary} />
              </div>
            ))
          : null}
      </div>
    </Panel>
  );
}

/**
 * Read-only release list for a browser that can't flash (no Web Serial: phones, tablets, Firefox, Safari). Lists the
 * published releases for every offered radio with their notes; nothing here touches a port.
 */
export default function ReleaseBrowser({
  offered,
}: {
  offered: readonly FirmwareUpdaterDescriptor[];
}) {
  const [includeRc, setIncludeRc] = useState(false);
  return (
    <div className={classes.stack}>
      <StatusBanner tone="info">{FIRMWARE_BROWSE_ONLY}</StatusBanner>
      <ToggleSwitch label="Show release candidates" checked={includeRc} onChange={setIncludeRc} />
      {offered.map((updater) => (
        <RadioReleases key={updater.radioId} updater={updater} includeRc={includeRc} />
      ))}
    </div>
  );
}
