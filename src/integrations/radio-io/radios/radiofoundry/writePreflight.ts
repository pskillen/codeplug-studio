/**
 * RadioFoundry Connect pre-flight: firmware row and STORAGE INFO before the pre-write read.
 */

import { pushGeneralInfoWarning, type ExportWarning } from '@core/import-export/exportWarning.ts';
import { summariseRadioFoundryBuild } from '@core/radios/radiofoundry/firmware.ts';
import { adviseRadioError, RadioInterlockError } from '../../kit/errors.ts';
import type { RadioPreflightResult, RadioPreflightRow, RadioSession } from '../../types.ts';
import {
  isRadioFoundryCableRadio,
  RF_STORAGE_NO_MAP,
  RF_STORAGE_NOT_READY,
  RF_STORAGE_NOT_STARTED,
  RF_STORAGE_FOREIGN_INTERLOCK,
  STORAGE_FOREIGN_REFUSAL,
  type RadioFoundryStorageInfoReply,
} from './protocol.ts';
import type { RadioFoundryStorageRegion } from './storageInfo.ts';

function regionName(region: RadioFoundryStorageRegion): string {
  switch (region) {
    case 'none':
      return 'none';
    case 'ours':
      return 'ours';
    case 'foreign':
      return 'foreign';
    default:
      return 'unknown';
  }
}

function storageDebugLines(
  boardLabel: string,
  reply: RadioFoundryStorageInfoReply,
  firmwareLine: string,
): string[] {
  const buildLine = firmwareLine;
  if (reply.kind === 'no-map') {
    return [
      'op: STORAGE INFO (read-only)',
      'STORAGE INFO: status 4 (no map)',
      `board: ${boardLabel}`,
      buildLine,
    ];
  }
  if (reply.kind === 'unknown-command') {
    return [
      'op: STORAGE INFO (read-only)',
      'STORAGE INFO: status 1 (unknown command)',
      `board: ${boardLabel}`,
      buildLine,
    ];
  }
  if (reply.kind === 'no-reply') {
    return [
      'op: STORAGE INFO (read-only)',
      'STORAGE INFO: no reply',
      `board: ${boardLabel}`,
      buildLine,
    ];
  }
  const { info } = reply;
  return [
    'op: STORAGE INFO (read-only)',
    `STORAGE INFO: region ${regionName(info.region)}, claim pending ${info.claimPending ? 'yes' : 'no'}`,
    `board: ${boardLabel}`,
    buildLine,
  ];
}

export const RADIOFOUNDRY_M17_PARKED_NOTE =
  "This radio's build doesn't run M17: its M17 channels will be parked (they tune but stay silent).";

function m17Preflight(
  features: readonly string[] | undefined,
  includesM17: boolean,
): { row?: RadioPreflightRow; findings: ExportWarning[] } {
  if (!includesM17) return { findings: [] };
  if (features?.includes('M17')) {
    return { row: { label: 'M17', value: 'runs', status: 'ok' }, findings: [] };
  }
  const findings: ExportWarning[] = [];
  pushGeneralInfoWarning(findings, RADIOFOUNDRY_M17_PARKED_NOTE);
  return {
    row: { label: 'M17', value: 'not in this build', status: 'warn' },
    findings,
  };
}

function refusalForStorage(
  reply: RadioFoundryStorageInfoReply,
  storageReadyFlagClear: boolean,
): { message: string; storageLabel: string; interlockKey?: string } {
  if (reply.kind === 'info') {
    if (reply.info.region === 'foreign') {
      return {
        message: STORAGE_FOREIGN_REFUSAL,
        storageLabel: 'foreign',
        interlockKey: RF_STORAGE_FOREIGN_INTERLOCK,
      };
    }
    if (reply.info.region === 'none') {
      return { message: RF_STORAGE_NOT_STARTED, storageLabel: 'did not start' };
    }
    if (reply.info.region === 'ours' && storageReadyFlagClear) {
      return { message: RF_STORAGE_NOT_READY, storageLabel: 'not ready' };
    }
  }
  if (reply.kind === 'no-map') {
    return { message: RF_STORAGE_NO_MAP, storageLabel: 'no flash map' };
  }
  return { message: RF_STORAGE_NOT_READY, storageLabel: 'not ready' };
}

export async function radioFoundryWritePreflight(
  session: RadioSession,
  ctx: { signal?: AbortSignal; includesM17?: boolean },
): Promise<RadioPreflightResult> {
  const radio = session.radio;
  if (!isRadioFoundryCableRadio(radio)) {
    return { identity: { model: session.descriptor.label }, rows: [] };
  }
  const version = radio.firmwareVersion();
  const summary = summariseRadioFoundryBuild(version);
  const firmwareLabel = summary.label === 'not reported' ? 'not reported' : summary.label;
  const identity = {
    model: radio.board.label,
    firmware: firmwareLabel === 'not reported' ? undefined : firmwareLabel,
    ...(summary.notes.length > 0 ? { firmwareNotes: summary.notes } : {}),
  };
  const m17 = m17Preflight(version?.features, ctx.includesM17 === true);
  const rows = [
    { label: 'Model', value: radio.board.label, status: 'ok' as const },
    {
      label: 'Firmware',
      value: firmwareLabel,
      status: firmwareLabel === 'not reported' ? ('warn' as const) : ('ok' as const),
    },
    ...(m17.row ? [m17.row] : []),
  ];
  const findings = m17.findings.length > 0 ? m17.findings : undefined;
  const writable = radio.storageWritable();
  if (writable === true) {
    return {
      identity,
      rows: [...rows, { label: 'Storage', value: 'writable', status: 'ok' as const }],
      ...(findings ? { findings } : {}),
    };
  }
  const reply = await radio.readStorageInfo(ctx.signal);
  const { message, storageLabel, interlockKey } = refusalForStorage(reply, writable === false);
  const err = adviseRadioError(new RadioInterlockError(message, interlockKey), {
    retry: 'none',
    sent: 'nothing-sent',
  });
  err.debugText = storageDebugLines(
    radio.board.label,
    reply,
    version ? `firmware: ${summary.label}` : 'firmware: not reported',
  ).join('\n');
  return {
    identity,
    rows: [...rows, { label: 'Storage', value: storageLabel, status: 'bad' as const }],
    refusal: err,
    ...(findings ? { findings } : {}),
  };
}
