import { useEffect, useRef, useState } from 'react';

import { fileBase, partnerFor } from '@core/firmware/releases/layouts.ts';
import type { PreparedFirmwareImage } from '@core/services/firmware/prepareFirmwareImage.ts';
import {
  isoTimestampForFilename,
  downloadTextFile,
} from '@integrations/download/browserDownload.ts';
import type {
  FirmwareBootloaderIdent,
  FirmwareFlashPhase,
  FirmwareFlashProgress,
} from '@integrations/radio-io';

import {
  Button,
  ConfirmModal,
  Panel,
  ProgressModal,
  StatusBanner,
  UnsavedChangesModal,
  type ProgressModalStep,
} from '../../../components/v2/index.ts';
import { useScreenWakeLock } from '../../../hooks/useScreenWakeLock.ts';
import { githubDocUrl } from '../../../lib/githubLinks.ts';
import { useUnsavedNavigationGuard } from '../../../hooks/useUnsavedNavigationGuard.ts';
import {
  formatFirmwareFlashSummary,
  grantFirmwarePort,
  prepareFlash,
  runFirmwareFlash,
  type FirmwareFlashOutcome,
} from '../../../services/firmwareFlash.ts';
import classes from '../FirmwareFlasherPage.module.css';
import { isPreflightComplete } from '../firmwareWizardState.ts';
import {
  createFlashProgressThrottle,
  transferDetail,
  visibleFlashPhases,
} from '../flashProgressThrottle.ts';
import LabeledCheck from './LabeledCheck.tsx';
import type { WizardStepProps } from './stepTypes.ts';

/** The firmware-flashing hub's Recovery section. The steps are also on the recovery screen, for offline use. */
const FIRMWARE_RECOVERY_DOC_URL = githubDocUrl(
  'docs/features/firmware-flashing/README.md#recovery',
);

function modalSteps(
  progress: FirmwareFlashProgress | null,
  seen: ReadonlySet<FirmwareFlashPhase>,
  outcome: FirmwareFlashOutcome | null,
): ProgressModalStep[] {
  const phases = visibleFlashPhases(seen, progress?.phase ?? 'handshake');
  const current = phases.findIndex((p) => p.phase === (progress?.phase ?? 'handshake'));
  return phases.map(({ phase, label }, i) => {
    let status: ProgressModalStep['status'];
    if (outcome?.ok) status = 'success';
    else if (i < current) status = 'success';
    else if (i > current) status = 'pending';
    else status = outcome ? 'error' : 'active';
    const detail =
      phase === 'transfer' && progress?.phase === 'transfer' ? transferDetail(progress) : undefined;
    return { id: phase, label, detail, status };
  });
}

export interface FlashStepProps extends WizardStepProps {
  readonly image: PreparedFirmwareImage;
  /** Back to "Enter update mode". Never resends automatically. */
  readonly onReenterUpdateMode: () => void;
  /** Back to the firmware choice, to flash stock. */
  readonly onChooseFirmware: () => void;
  readonly onRunningChange: (running: boolean) => void;
}

export default function FlashStep({
  state,
  dispatch,
  updater,
  image,
  onReenterUpdateMode,
  onChooseFirmware,
  onRunningChange,
}: FlashStepProps) {
  const [running, setRunning] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [progress, setProgress] = useState<FirmwareFlashProgress | null>(null);
  const [seenPhases, setSeenPhases] = useState<ReadonlySet<FirmwareFlashPhase>>(new Set());
  const [ident, setIdent] = useState<FirmwareBootloaderIdent | null>(null);
  const [outcome, setOutcome] = useState<FirmwareFlashOutcome | null>(null);
  const [portError, setPortError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [copied, setCopied] = useState(false);
  // Local to this step, so it resets whenever the step is entered.
  const [updateModeConfirmed, setUpdateModeConfirmed] = useState(false);
  const updateModeConfirm = updater.preflight?.updateModeConfirm;
  const abortRef = useRef<AbortController | null>(null);
  const [retryPrep, setRetryPrep] = useState<{ busy: boolean; error: string | null }>({
    busy: false,
    error: null,
  });

  // The release's file for the radio's other layout, offered once after a refusal before anything was installed. Only a
  // file of the same variant (UV-5R Mini: NRF or NRFB) is a partner; with today's two bases there is none.
  const refusedLayout = image.radioLayout;
  const partner =
    refusedLayout && state.loadedPatch
      ? partnerFor(state.loadedPatch, refusedLayout, {
          refusedBase: image.baseName,
          variantOfBase: updater.stock.releaseLayouts?.variantOfBase,
        })
      : undefined;
  const retry: LayoutRetryOffer =
    state.layoutRetry !== null
      ? { kind: 'used', from: state.layoutRetry.from, to: state.layoutRetry.to }
      : partner?.layout && refusedLayout
        ? { kind: 'offer', to: partner.layout, ...retryPrep }
        : { kind: 'none' };

  /** Prepare the partner file for its layout (the interlocks run again), then go back to update mode. Sends nothing. */
  async function retryOtherLayout() {
    if (!partner?.layout || !refusedLayout || !state.stock || !state.choice || !state.loadedPatch)
      return;
    setRetryPrep({ busy: true, error: null });
    try {
      const next = await prepareFlash(
        updater.radioId,
        state.stock,
        state.choice,
        state.loadedPatch,
        partner.layout,
        image.radioBuild,
        false,
        image.radioReported === true,
        // A reported base stands (the interlocks then refuse a change); otherwise the partner's own base, so it is
        // picked and prepared on its own stock.
        image.radioReported ? image.radioCodeBase : fileBase(partner),
      );
      dispatch({ type: 'retryOtherLayout', from: refusedLayout, image: next });
    } catch (err) {
      setRetryPrep({
        busy: false,
        error:
          err instanceof Error ? err.message : `The ${partner.layout} file could not be prepared.`,
      });
    }
  }

  useScreenWakeLock(running);
  const guard = useUnsavedNavigationGuard(running);

  useEffect(() => {
    onRunningChange(running);
  }, [running, onRunningChange]);

  async function connectAndFlash() {
    setPortError(null);
    setOutcome(null);
    setProgress(null);
    setSeenPhases(new Set());
    setIdent(null);
    setCopied(false);
    let port;
    try {
      port = await grantFirmwarePort(updater.radioId);
    } catch {
      setPortError('No port was chosen. Click "Connect and flash" again and pick the cable.');
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setRunning(true);
    setModalOpen(true);
    // A long transfer reports tens of thousands of frames: render at most every ~100 ms.
    const throttle = createFlashProgressThrottle((p) => {
      setProgress(p);
      setSeenPhases((prev) => (prev.has(p.phase) ? prev : new Set(prev).add(p.phase)));
    });
    const result = await runFirmwareFlash({
      radioId: updater.radioId,
      image,
      port,
      onIdent: setIdent,
      onProgress: throttle.push,
      signal: controller.signal,
    });
    throttle.flush();
    abortRef.current = null;
    setOutcome(result);
    setRunning(false);
  }

  function requestCancel() {
    if (progress?.radioTouched) setConfirmCancel(true);
    else abortRef.current?.abort();
  }

  const summary = outcome ? formatFirmwareFlashSummary(outcome) : '';
  const percent = progress && progress.max > 0 ? (progress.cur / progress.max) * 100 : 0;

  async function copySummary() {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function downloadSummary() {
    downloadTextFile(
      summary,
      `firmware-flash-${updater.radioId}-${isoTimestampForFilename()}.txt`,
      'text/plain;charset=utf-8',
    );
  }

  return (
    <div className={classes.stack}>
      <Panel
        title="Connect and flash"
        sub={`Flashing the ${image.title} to the ${updater.label}. This takes ${updater.expectedDuration}.`}
      >
        <div className={classes.stack}>
          <p className={classes.copy}>
            With the radio in update mode and the cable plugged in, click the button and pick the
            cable&apos;s port. Keep this tab in front and don&apos;t let the computer sleep.
          </p>
          {updater.stock.bootloaderEntry.warnings.map((w) => (
            <StatusBanner key={w} tone="warning">
              {w}
            </StatusBanner>
          ))}
          {updateModeConfirm ? (
            <LabeledCheck
              label={updateModeConfirm}
              checked={updateModeConfirmed}
              onChange={setUpdateModeConfirmed}
            />
          ) : null}
          <div>
            <Button
              variant="primary"
              onClick={() => void connectAndFlash()}
              disabled={
                running ||
                !isPreflightComplete(state) ||
                (!!updateModeConfirm && !updateModeConfirmed)
              }
            >
              Connect and flash
            </Button>
          </div>
          {portError ? <StatusBanner tone="warning">{portError}</StatusBanner> : null}
          {ident ? (
            <p className={classes.muted}>
              Bootloader: <span className={classes.mono}>{ident.model}</span>
            </p>
          ) : null}
          {ident?.notice ? <StatusBanner tone="info">{ident.notice}</StatusBanner> : null}
        </div>
      </Panel>

      {outcome && !running ? (
        <FlashResult
          outcome={outcome}
          summary={summary}
          copied={copied}
          onCopy={() => void copySummary()}
          onDownload={downloadSummary}
          onReenterUpdateMode={onReenterUpdateMode}
          onChooseFirmware={onChooseFirmware}
          retry={retry}
          onRetryOtherLayout={() => void retryOtherLayout()}
        />
      ) : null}

      <ProgressModal
        open={modalOpen}
        title={`Flashing the ${image.title}`}
        phase={running ? 'running' : 'finished'}
        steps={modalSteps(progress, seenPhases, outcome)}
        progress={outcome?.ok ? 100 : percent}
        note={`Keep this tab in front; don't let the computer sleep. This takes ${updater.expectedDuration}.`}
        summary={
          outcome
            ? outcome.ok
              ? `The ${image.title} is on the ${updater.label}.`
              : `Flash failed: ${outcome.message}`
            : null
        }
        onClose={() => setModalOpen(false)}
        footer={
          running ? (
            <Button variant="secondary" size="sm" onClick={requestCancel}>
              Cancel
            </Button>
          ) : (
            <>
              {outcome && !outcome.ok && outcome.code !== NOTHING_INSTALLED ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    setModalOpen(false);
                    onReenterUpdateMode();
                  }}
                >
                  Retry
                </Button>
              ) : null}
              <Button variant="primary" size="sm" onClick={() => setModalOpen(false)}>
                Close
              </Button>
            </>
          )
        }
      />

      <ConfirmModal
        open={confirmCancel}
        title="Stop the flash?"
        tone="destructive"
        confirmLabel="Stop"
        cancelLabel="Keep going"
        onClose={() => setConfirmCancel(false)}
        onConfirm={() => {
          setConfirmCancel(false);
          abortRef.current?.abort();
        }}
      >
        Stopping now leaves the radio needing a re-flash.
      </ConfirmModal>

      <UnsavedChangesModal
        opened={guard.modalOpen}
        title="A flash is running"
        message="Leaving now stops the flash and can leave the radio needing a re-flash."
        onStay={guard.stay}
        onLeave={() => {
          abortRef.current?.abort();
          guard.leave();
        }}
      />
    </div>
  );
}

/** The error code of a refusal before anything was installed (`RadioNothingInstalledError`). */
const NOTHING_INSTALLED = 'nothingInstalled';

/** After a refusal before anything was installed: the other layout's file on offer, already tried, or none. */
type LayoutRetryOffer =
  | { kind: 'offer'; to: string; busy: boolean; error: string | null }
  | { kind: 'used'; from: string; to: string }
  | { kind: 'none' };

function FlashResult({
  outcome,
  summary,
  copied,
  onCopy,
  onDownload,
  onReenterUpdateMode,
  onChooseFirmware,
  retry,
  onRetryOtherLayout,
}: {
  outcome: FirmwareFlashOutcome;
  summary: string;
  copied: boolean;
  onCopy: () => void;
  onDownload: () => void;
  onReenterUpdateMode: () => void;
  onChooseFirmware: () => void;
  retry: LayoutRetryOffer;
  onRetryOtherLayout: () => void;
}) {
  const summaryBlock = (
    <>
      <pre className={classes.summary} data-testid="firmware-flash-summary">
        {summary}
      </pre>
      <div className={classes.actionsRight}>
        <Button variant="secondary" size="sm" onClick={onCopy}>
          {copied ? 'Copied' : 'Copy'}
        </Button>
        <Button variant="secondary" size="sm" onClick={onDownload}>
          Download .txt
        </Button>
      </div>
    </>
  );

  if (outcome.ok) {
    const { title, verifyHint } = outcome.image;
    let banner;
    switch (outcome.result.end) {
      case 'port-closed-by-radio':
        banner = (
          <StatusBanner tone="success">
            The radio restarted into the new firmware. The {title} is on the radio. Check:{' '}
            {verifyHint}
          </StatusBanner>
        );
        break;
      case 'no-reply':
        banner = (
          <>
            <StatusBanner tone="success">The {title} was sent to the radio.</StatusBanner>
            <StatusBanner tone="warning">
              Every block was accepted, but the radio didn&apos;t confirm the end. Power-cycle it,
              then check: {verifyHint}
            </StatusBanner>
          </>
        );
        break;
      default:
        banner = outcome.result.note ? (
          <StatusBanner tone="success">
            The {title} is on the radio. {outcome.result.note}
          </StatusBanner>
        ) : (
          <StatusBanner tone="success">
            The {title} is on the radio. Power-cycle the radio if it hasn&apos;t restarted, then
            check: {verifyHint}
          </StatusBanner>
        );
    }
    return (
      <Panel title="Done">
        <div className={classes.stack}>
          {banner}
          {summaryBlock}
        </div>
      </Panel>
    );
  }

  if (outcome.code === NOTHING_INSTALLED) {
    // Before "Recover the radio": the loader may have run, but it installed nothing.
    return (
      <Panel title="Nothing was installed">
        <div className={classes.stack}>
          <StatusBanner tone="warning">
            The radio refused this file before installing anything. Its installed firmware is
            unchanged.
          </StatusBanner>
          <p className={classes.copy}>{outcome.message}</p>
          {retry.kind === 'offer' ? (
            <>
              <p className={classes.copy}>
                The refusal means this radio has the other flash layout. This release has a{' '}
                {retry.to} file: Studio prepares and checks it, then you put the radio into update
                mode again and press Connect. Nothing is sent until you do.
              </p>
              {retry.error ? (
                <StatusBanner tone="warning">
                  {retry.error} Nothing was sent to the radio.
                </StatusBanner>
              ) : null}
              <div className={classes.actionsRight}>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={onRetryOtherLayout}
                  disabled={retry.busy}
                >
                  {retry.busy ? 'Preparing…' : `Enter update mode again with the ${retry.to} file`}
                </Button>
              </div>
            </>
          ) : retry.kind === 'used' ? (
            <p className={classes.copy}>
              The radio refused the {retry.from} file and then the {retry.to} file. Studio offers no
              further file. Switch the radio off and on, and keep the summary below for a report.
            </p>
          ) : (
            <>
              <p className={classes.copy}>
                This release has no other file for this radio (the other flash layout, same suffix),
                so Studio has nothing else to send. Check the answers on Prepare match the radio.
                Switch the radio off and on; it boots its installed firmware.
              </p>
              <div>
                <Button variant="secondary" size="sm" onClick={onChooseFirmware}>
                  Choose other firmware
                </Button>
              </div>
            </>
          )}
          {summaryBlock}
        </div>
      </Panel>
    );
  }

  if (!outcome.radioTouched) {
    return (
      <Panel title="Flash failed">
        <div className={classes.stack}>
          <StatusBanner tone="warning">
            Nothing was written. Power the radio off and on, then try again.
          </StatusBanner>
          <p className={classes.copy}>{outcome.message}</p>
          <div>
            <Button variant="secondary" size="sm" onClick={onReenterUpdateMode}>
              Enter update mode again
            </Button>
          </div>
          {summaryBlock}
        </div>
      </Panel>
    );
  }

  return (
    <Panel title="Recover the radio" variant="danger">
      <div className={classes.stack}>
        <StatusBanner tone="warning">
          The flash stopped part-way. Don&apos;t keep power-cycling the radio.
        </StatusBanner>
        <p className={classes.copy}>{outcome.message}</p>
        <ol className={classes.list}>
          <li>Put the radio back into update mode.</li>
          <li>Flash the same firmware again, or flash stock firmware.</li>
          <li>
            If that doesn&apos;t work, the vendor&apos;s own programming software can restore it.
          </li>
        </ol>
        <div className={classes.actionsRight}>
          <Button variant="primary" size="sm" onClick={onReenterUpdateMode}>
            Enter update mode again
          </Button>
          <Button variant="secondary" size="sm" onClick={onChooseFirmware}>
            Flash stock instead
          </Button>
        </div>
        <p className={classes.muted}>
          More help:{' '}
          <a href={FIRMWARE_RECOVERY_DOC_URL} target="_blank" rel="noopener noreferrer">
            recovering a radio after a failed flash
          </a>
        </p>
        {summaryBlock}
      </div>
    </Panel>
  );
}
