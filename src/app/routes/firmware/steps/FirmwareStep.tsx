import { useEffect, useState } from 'react';

import { FirmwareError } from '@core/firmware/errors.ts';
import { loadedLayouts } from '@core/firmware/releases/layouts.ts';
import { publishedReleaseSummary } from '@core/firmware/releases/publishedSource.ts';
import { loadedFirmwarePatchTitle, stockFirmwareTitle } from '@core/firmware/releases/projects.ts';
import type { FirmwareReleaseSummary, LoadedFirmwarePatch } from '@core/firmware/releases/types.ts';
import { toStockVariantFor } from '@core/firmware/stockVariants.ts';

import {
  Button,
  FileDropzone,
  Panel,
  Pill,
  StatusBanner,
  ToggleSwitch,
} from '../../../components/v2/index.ts';
import {
  filesToNamedBytes,
  listPublishedReleases,
  loadChosenPatch,
} from '../../../services/firmwareFlash.ts';
import classes from '../FirmwareFlasherPage.module.css';
import ReleaseNotesDisclosure from '../ReleaseNotesDisclosure.tsx';
import DeveloperOnly from './DeveloperOnly.tsx';
import LabeledCheck from './LabeledCheck.tsx';
import { shortHash, type WizardStepProps } from './stepTypes.ts';

const UNREVIEWED_PATCH_RISK_STATEMENT = (
  <>
    This patch is not one of the firmware project&apos;s published releases. Studio checks that it
    matches your stock firmware and that the result matches the hash inside the patch, but it{' '}
    <strong>cannot tell whether the firmware it produces is safe</strong>. A bad patch can leave
    your radio unable to boot. Only use patch files you built yourself or got from the firmware
    project&apos;s own release page.
  </>
);

function messageOf(err: unknown, fallback: string): string {
  return err instanceof FirmwareError ? err.message : fallback;
}

function summaryForLoaded(loaded: LoadedFirmwarePatch): FirmwareReleaseSummary | null {
  return loaded.release ? publishedReleaseSummary(loaded.release) : null;
}

/** What to flash: a published release, stock (always: also the recovery path), or a patch file under Advanced. */
export default function FirmwareStep({ state, dispatch, updater }: WizardStepProps) {
  const radioId = updater.radioId;
  const listKey = `${radioId}:${state.includeRc}`;
  const [releases, setReleases] = useState<{
    key: string;
    list: readonly FirmwareReleaseSummary[];
    error?: string;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userFile, setUserFile] = useState<{
    name: string;
    loaded: LoadedFirmwarePatch | null;
    error: string | null;
  } | null>(null);
  const [stockReturnFile, setStockReturnFile] = useState<{
    name: string;
    loaded: LoadedFirmwarePatch | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    listPublishedReleases(radioId, state.includeRc)
      .then((list) => {
        if (!cancelled) setReleases({ key: listKey, list });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setReleases({
            key: listKey,
            list: [],
            error: messageOf(err, 'The firmware release list could not be downloaded.'),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [radioId, state.includeRc, listKey, attempt]);

  const current = releases?.key === listKey ? releases : null;
  const list = current ? current.list : null;
  const { choice } = state;

  async function chooseRelease(summary: FirmwareReleaseSummary) {
    setBusyKey(summary.key);
    setError(null);
    try {
      const loaded = await loadChosenPatch(radioId, {
        kind: 'release',
        source: 'published',
        summary,
      });
      dispatch({
        type: 'chooseFirmware',
        choice: { kind: 'release', source: 'published', summary },
        loadedPatch: loaded,
      });
    } catch (err) {
      setError(messageOf(err, 'This release could not be loaded.'));
    } finally {
      setBusyKey(null);
    }
  }

  async function onPatchFile(files: File[]) {
    if (files.length === 0) return;
    const name = files.map((f) => f.name).join(', ');
    setUserFile({ name, loaded: null, error: null });
    try {
      const [named, ...otherFiles] = await filesToNamedBytes(files);
      const picked = {
        kind: 'user-patch' as const,
        file: named!,
        ...(otherFiles.length ? { otherFiles } : {}),
      };
      const loaded = await loadChosenPatch(radioId, picked);
      setUserFile({ name, loaded, error: null });
      const published = summaryForLoaded(loaded);
      if (published) {
        dispatch({
          type: 'chooseFirmware',
          choice: { kind: 'release', source: 'published', summary: published },
          loadedPatch: loaded,
        });
      } else {
        dispatch({ type: 'chooseFirmware', choice: picked, loadedPatch: loaded });
      }
    } catch (err) {
      setUserFile({
        name,
        loaded: null,
        error: messageOf(err, 'This file is not a readable firmware patch.'),
      });
      if (choice?.kind === 'user-patch')
        dispatch({
          type: 'chooseFirmware',
          choice: updater.stock.stockFlashOffered === false ? null : { kind: 'stock' },
        });
    }
  }

  async function onToStockFile(files: File[]) {
    const file = files[0];
    if (!file) return;
    setStockReturnFile({ name: file.name, loaded: null, error: null });
    try {
      const [named] = await filesToNamedBytes([file]);
      const loaded = await loadChosenPatch(radioId, { kind: 'back-to-stock', file: named! });
      setStockReturnFile({ name: file.name, loaded, error: null });
      dispatch({
        type: 'chooseFirmware',
        choice: { kind: 'back-to-stock', file: named! },
        loadedPatch: loaded,
      });
    } catch (err) {
      setStockReturnFile({
        name: file.name,
        loaded: null,
        error: messageOf(err, 'This file is not a readable firmware patch.'),
      });
      if (choice?.kind === 'back-to-stock') dispatch({ type: 'chooseFirmware', choice: null });
    }
  }

  const stockReturn = updater.stock.stockReturn;
  const releaseLayouts = updater.stock.releaseLayouts;
  const toStockVersion = stockReturnFile?.loaded
    ? toStockVariantFor(updater.stock, stockReturnFile.loaded.parsed.description)?.version
    : undefined;

  const unreviewed =
    choice?.kind === 'user-patch' && state.loadedPatch?.provenance === 'unreviewed'
      ? state.loadedPatch
      : null;

  return (
    <div className={classes.stack}>
      <Panel title="Firmware" sub="Choose what to put on the radio.">
        <div className={classes.stack}>
          <ToggleSwitch
            label="Show release candidates"
            checked={state.includeRc}
            onChange={(value) => dispatch({ type: 'setIncludeRc', value })}
          />
          <div className={classes.stack} role="radiogroup" aria-label="Firmware">
            {list === null ? <p className={classes.muted}>Loading releases…</p> : null}
            {current?.error ? (
              <>
                <StatusBanner tone="warning">
                  {current.error}{' '}
                  {updater.stock.stockFlashOffered === false
                    ? 'A patch file from disk still works.'
                    : 'Stock firmware and a patch file from disk still work.'}
                </StatusBanner>
                <div>
                  <Button variant="secondary" size="sm" onClick={() => setAttempt((n) => n + 1)}>
                    Try again
                  </Button>
                </div>
              </>
            ) : null}
            {list && list.length === 0 && !current?.error ? (
              <p className={classes.muted}>
                No firmware release is published for the {updater.label} yet.{' '}
                {updater.stock.stockFlashOffered === false
                  ? 'Use a patch file from disk, under Advanced below.'
                  : 'You can flash stock firmware, or use a patch file from disk under Advanced below.'}
              </p>
            ) : null}
            {list?.map((summary) => {
              const release = summary.release!;
              const selected = choice?.kind === 'release' && choice.summary.key === summary.key;
              return (
                <div
                  key={summary.key}
                  className={`${classes.card} ${selected ? classes.cardSelected : ''}`}
                >
                  <label className={classes.cardTitle}>
                    <input
                      type="radio"
                      name="firmware-choice"
                      checked={selected}
                      disabled={busyKey !== null}
                      onChange={() => void chooseRelease(summary)}
                    />
                    {summary.title}
                    {summary.channel === 'rc' ? <Pill tone="warning">Pre-release</Pill> : null}
                  </label>
                  <span className={classes.cardMeta}>Published {release.publishedOn}</span>
                  <span className={classes.copy}>{release.summary}</span>
                  <ReleaseNotesDisclosure summary={summary} />
                </div>
              );
            })}
            {updater.stock.stockFlashOffered !== false && (
              <div
                className={`${classes.card} ${choice?.kind === 'stock' ? classes.cardSelected : ''}`}
              >
                <label className={classes.cardTitle}>
                  <input
                    type="radio"
                    name="firmware-choice"
                    checked={choice?.kind === 'stock'}
                    onChange={() => dispatch({ type: 'chooseFirmware', choice: { kind: 'stock' } })}
                  />
                  Stock firmware ({updater.stock.version})
                </label>
                <span className={classes.cardMeta}>
                  The vendor&apos;s own firmware. Also the way back if a flash goes wrong.
                </span>
              </div>
            )}
            {stockReturn ? (
              <div
                className={`${classes.card} ${choice?.kind === 'back-to-stock' ? classes.cardSelected : ''}`}
              >
                <span className={classes.cardTitle}>Back to stock</span>
                <span className={classes.cardMeta}>{stockReturn.help}</span>
                <FileDropzone
                  label="To-stock patch (.patch.json)"
                  accept=".json"
                  fileName={stockReturnFile?.name}
                  onFilesSelected={(files) => void onToStockFile(files)}
                  onClear={() => {
                    setStockReturnFile(null);
                    if (choice?.kind === 'back-to-stock') {
                      dispatch({ type: 'chooseFirmware', choice: null });
                    }
                  }}
                />
                {stockReturnFile?.error ? (
                  <StatusBanner tone="warning">{stockReturnFile.error}</StatusBanner>
                ) : null}
                {toStockVersion && choice?.kind === 'back-to-stock' ? (
                  <StatusBanner tone="success">
                    This file puts back the {stockFirmwareTitle(toStockVersion)}.
                  </StatusBanner>
                ) : null}
              </div>
            ) : null}
          </div>
          {error ? <StatusBanner tone="warning">{error}</StatusBanner> : null}
        </div>
      </Panel>

      <details className={classes.disclosure} open={choice?.kind === 'user-patch' || undefined}>
        <summary>Advanced: use a patch file from disk</summary>
        <Panel title="Patch file">
          <div className={classes.stack}>
            <FileDropzone
              label={
                releaseLayouts
                  ? 'Firmware patch files (.patch.json)'
                  : 'Firmware patch (.patch.json)'
              }
              hint={
                releaseLayouts
                  ? "A release has a file for each radio firmware it supports. Pick them all: Studio uses the one for your radio's firmware. One file works too."
                  : undefined
              }
              multiple={releaseLayouts ? true : undefined}
              accept=".json"
              fileName={userFile?.name}
              onFilesSelected={(files) => void onPatchFile(files)}
              onClear={() => {
                setUserFile(null);
                if (choice?.kind === 'user-patch') {
                  dispatch({
                    type: 'chooseFirmware',
                    choice: updater.stock.stockFlashOffered === false ? null : { kind: 'stock' },
                  });
                }
              }}
            />
            {userFile?.error ? <StatusBanner tone="warning">{userFile.error}</StatusBanner> : null}
            {userFile?.loaded?.release ? (
              <StatusBanner tone="success">
                This is the {loadedFirmwarePatchTitle(userFile.loaded)} (published).
              </StatusBanner>
            ) : null}
            {userFile?.loaded && loadedLayouts(userFile.loaded).length ? (
              <DeveloperOnly>
                <p className={classes.muted}>
                  Flash layouts: {loadedLayouts(userFile.loaded).join(', ')}.
                </p>
              </DeveloperOnly>
            ) : null}
            {unreviewed ? (
              <>
                <p className={classes.copy}>
                  Patch <strong>{loadedFirmwarePatchTitle(unreviewed)}</strong>, sha256{' '}
                  <span className={classes.mono}>{shortHash(unreviewed.sha256)}</span>
                </p>
                <StatusBanner tone="warning">{UNREVIEWED_PATCH_RISK_STATEMENT}</StatusBanner>
                <LabeledCheck
                  label="I understand"
                  checked={state.riskAccepted}
                  onChange={(value) => dispatch({ type: 'setRiskAccepted', value })}
                />
              </>
            ) : null}
          </div>
        </Panel>
      </details>
    </div>
  );
}
