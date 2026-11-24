import { useCallback, useRef, useState } from 'react';
import type { StorageClaimManifest } from '@core/radios/radiofoundry/storageClaim.ts';
import type { RadioSession } from '@integrations/radio-io/types.ts';
import type { RadioEgressProfile } from '../../../../services/radioIoSession.ts';
import { StorageClaimSessionError } from '@integrations/radio-io/radios/radiofoundry/storageClaim/index.ts';
import {
  acknowledgeStorageBackupSaved,
  openStorageClaimState,
  pollStorageClaimForOurs,
  recheckStorageClaim,
  runStorageClaimBackupDownload,
  runStorageClaimCheck,
  runStorageClaimUnlock,
} from '../../../../services/dangerZone/radioFoundryStorageClaimService.ts';
import {
  closeRadioSession,
  openRadioSessionForEgress,
} from '../../../../services/radioIoSession.ts';
import { COPY } from './storageClaimCopy.ts';
import type { StorageClaimActions, StorageClaimStep, StorageClaimView } from './types.ts';

function downloadZip(fileName: string, bytes: Uint8Array): void {
  const copy = bytes.slice();
  const blob = new Blob([copy], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export interface UseStorageClaimFlowOptions {
  buildId: string;
  egress: RadioEgressProfile;
  navigateInBuild: (path: string) => void;
}

export function useStorageClaimFlow(opts: UseStorageClaimFlowOptions): {
  view: StorageClaimView;
  actions: StorageClaimActions;
} {
  const { buildId, egress, navigateInBuild } = opts;
  const [step, setStep] = useState<StorageClaimStep>('check');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [check, setCheck] = useState<StorageClaimView['check']>(null);
  const [tokenHex, setTokenHex] = useState<string | null>(null);
  const [backupFileName, setBackupFileName] = useState<string | null>(null);
  const [backupSaved, setBackupSaved] = useState(false);
  const [confirmTick, setConfirmTick] = useState(false);
  const [pollPending, setPollPending] = useState(false);
  const [layout, setLayout] = useState<StorageClaimView['layout']>(null);
  const manifestRef = useRef<StorageClaimManifest | null>(null);

  const refuse = useCallback((err: unknown) => {
    const msg =
      err instanceof StorageClaimSessionError
        ? err.message
        : err instanceof Error
          ? err.message
          : String(err);
    setNotice(`${msg} ${COPY.nothingChanged}`);
  }, []);

  const withClaimSession = useCallback(
    async <T,>(
      fn: (session: RadioSession, signal?: AbortSignal) => Promise<T>,
      signal?: AbortSignal,
    ) => {
      const opened = await openRadioSessionForEgress(egress, { signal });
      try {
        return await fn(opened.session, signal);
      } finally {
        await closeRadioSession(opened.session);
      }
    },
    [egress],
  );

  const onConnectCheck = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    try {
      const result = await withClaimSession(async (session) => {
        const state = openStorageClaimState(session.pipe, egress.profileId);
        return runStorageClaimCheck(state);
      });
      setCheck(result);
      setLayout(result.layout);
      setStep('backup');
    } catch (err) {
      refuse(err);
    }
    setBusy(false);
  }, [egress.profileId, refuse, withClaimSession]);

  const onBackup = useCallback(async () => {
    setBusy(true);
    setNotice(null);
    try {
      const dl = await withClaimSession(async (session) => {
        const state = openStorageClaimState(session.pipe, egress.profileId);
        await runStorageClaimCheck(state);
        return runStorageClaimBackupDownload(state);
      });
      if (check) dl.manifest.firmwareGit = check.firmwareGit;
      manifestRef.current = dl.manifest;
      downloadZip(dl.fileName, dl.zipBytes);
      setTokenHex(dl.tokenHex);
      setBackupFileName(dl.fileName);
    } catch (err) {
      refuse(err);
    }
    setBusy(false);
  }, [check, egress.profileId, refuse, withClaimSession]);

  const onBackupNext = useCallback(() => {
    if (backupSaved) setStep('confirm');
  }, [backupSaved]);

  const onUnlock = useCallback(async () => {
    if (!confirmTick) return;
    setStep('unlock');
    setBusy(true);
    setPollPending(false);
    setNotice(null);
    try {
      await withClaimSession(async (session) => {
        const state = openStorageClaimState(session.pipe, egress.profileId);
        await runStorageClaimCheck(state);
        if (manifestRef.current) {
          state.manifestToken = manifestRef.current.token;
          state.manifestLayout = manifestRef.current.storageInfo;
        }
        acknowledgeStorageBackupSaved(state);
        await runStorageClaimUnlock(state);
        setPollPending(true);
        const poll = await pollStorageClaimForOurs(state);
        setPollPending(false);
        if (poll.kind === 'ours') {
          setLayout(
            manifestRef.current
              ? { ...manifestRef.current.storageInfo, region: 'ours' }
              : {
                  region: 'ours',
                  claimPending: false,
                  settings: { address: 0, size: 0 },
                  journal: { address: 0, size: 0 },
                  calibration: { address: 0, size: 0 },
                },
          );
          setNotice(COPY.oursDone);
        } else {
          setLayout(poll.last);
          setNotice('Not confirmed yet.');
        }
        setStep('done');
      });
    } catch (err) {
      refuse(err);
      setStep('confirm');
    }
    setBusy(false);
  }, [confirmTick, egress.profileId, refuse, withClaimSession]);

  const onCheckAgain = useCallback(async () => {
    setBusy(true);
    try {
      await withClaimSession(async (session) => {
        const state = openStorageClaimState(session.pipe, egress.profileId);
        const next = await recheckStorageClaim(state);
        setLayout(next);
        setNotice(next.region === 'ours' ? COPY.oursDone : 'Storage is still not ours.');
      });
    } catch (err) {
      refuse(err);
    }
    setBusy(false);
  }, [egress.profileId, refuse, withClaimSession]);

  const view: StorageClaimView = {
    step,
    busy,
    notice,
    check,
    tokenHex,
    backupFileName,
    backupSaved,
    confirmTick,
    pollPending,
    layout,
    buildId,
  };

  const actions: StorageClaimActions = {
    onConnectCheck,
    onBackup,
    onSaveTick: setBackupSaved,
    onBackupNext,
    onConfirmTick: setConfirmTick,
    onUnlock,
    onCheckAgain,
    onWriteLink: () => navigateInBuild('export'),
    onBackToExport: () => navigateInBuild('export'),
  };

  return { view, actions };
}
