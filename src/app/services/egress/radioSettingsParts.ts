/**
 * Per-radio Radio settings parts for the Write stepper (#1963). Radios register from
 * `RadioWriteStepper/<radio>/`; the hook resolves by profile id and never names a radio.
 */

import type { EgressPath } from '@core/models/egressPath.ts';
import type { PlannedStage, ProgressFn, RadioSession } from '@integrations/radio-io/types.ts';
import type {
  AtD890PreTransmitContext,
  AtD890PreTransmitResult,
  BeforeTransmitContext,
  Rt95PreTransmitContext,
  Rt95PreTransmitResult,
} from '../radioIoSession.ts';
import type { WriteParts } from '../../components/builds/RadioWriteStepper/writeParts.ts';

/** A per-radio Review controller as the hook uses it (D890 and RT95 controllers fit). */
export interface SettingsReviewController {
  canWrite(): boolean;
  subscribe(listener: () => void): () => void;
  getState(): { settingsTicked: boolean; choice: 'apply' | 'keep' | string };
}

export interface RadioSettingsPartDeps {
  buildId: string;
  egress: EgressPath;
  now: () => number;
  getParts: () => WriteParts;
  setParts: (next: WriteParts) => void;
  /** Reject the pause with "Review its settings" (opens the settings page). */
  requestReviewSettings: () => void;
  getSession: () => RadioSession | null;
  getSignal: () => AbortSignal | undefined;
  getDescriptor: () => import('@integrations/radio-io/types.ts').RadioDescriptor | undefined;
  /** Settings-only write: stage list is ready (RT95 sets the write track here). */
  onSettingsPlan?: (plan: PlannedStage[] | undefined) => void;
}

export type SettingsOnlyReviewContext =
  | { atD890: AtD890PreTransmitContext; settingsPlan?: PlannedStage[] }
  | { rt95Settings: Rt95PreTransmitContext; settingsPlan?: PlannedStage[] };

export interface RadioSettingsPart {
  matches(profileId: string): boolean;
  /** Overrides set this session (the hook ticks Radio settings by default when > 0). */
  pendingChangeCount(buildId: string): number;
  /** Ticks saved when the user went to Edit settings; returned once, then cleared. */
  takeRestoredTicks(buildId: string): Partial<WriteParts> | undefined;
  saveTicks(buildId: string, parts: WriteParts): void;
  /** Extra options for uploadPreparedRadioWrite when Radio settings is ticked. */
  uploadOptions(buildId: string): Record<string, unknown>;
  /** Settings alone: read, pause through `beforeTransmit`, write the settings unit. */
  writeSettingsOnly(
    session: RadioSession,
    deps: RadioSettingsPartDeps,
    run: {
      onProgress: ProgressFn;
      signal: AbortSignal;
      beforeTransmit: (ctx: SettingsOnlyReviewContext) => Promise<unknown>;
    },
  ): Promise<{ writeVerifyPending?: unknown }>;
  /** Build the Review controller from the pause context, or null when this radio has none for it. */
  createReviewController(
    txCtx: BeforeTransmitContext,
    channels: readonly unknown[],
    deps: RadioSettingsPartDeps,
  ): SettingsReviewController | null;
  /** Spread into `ReviewContext` for section providers (`atD890` / `rt95.settings`). */
  reviewSectionBindings(
    controller: SettingsReviewController,
    txCtx: BeforeTransmitContext,
    rt95ModData?: { zones: number; descriptions: number; zoneKey?: { group: number; key: number } },
  ): Record<string, unknown>;
  /** What the pause resolves with: 'keep' or { decision: 'apply', overrides }. */
  pauseResult(
    controller: SettingsReviewController,
    buildId: string,
    willWrite: boolean,
  ): AtD890PreTransmitResult | Rt95PreTransmitResult;
  /** Overrides and choice say settings will be written on transmit. */
  settingsWillBeWritten(controller: SettingsReviewController, buildId: string): boolean;
  /** How many fields the applied settings changed (Done). */
  changedCount(controller: SettingsReviewController, buildId: string): number;
}

export interface RadioWriteExtras {
  matches(profileId: string): boolean;
  /** Serial of the radio on this session, for the interrupted-write notice ('' when unknown). */
  failedWriteSerial?(session: RadioSession): string;
  /** Review's "Save backup now", when the radio offers it. */
  saveBackupFromSession?(
    session: RadioSession,
    txCtx: unknown,
    deps: RadioSettingsPartDeps,
    controller: () => SettingsReviewController,
  ): Promise<void>;
}

const parts: RadioSettingsPart[] = [];
const extras: RadioWriteExtras[] = [];

export function registerRadioSettingsPart(part: RadioSettingsPart): () => void {
  parts.push(part);
  return () => {
    const i = parts.indexOf(part);
    if (i >= 0) parts.splice(i, 1);
  };
}

export function radioSettingsPartFor(profileId: string): RadioSettingsPart | undefined {
  return parts.find((p) => p.matches(profileId));
}

export function registerRadioWriteExtras(entry: RadioWriteExtras): () => void {
  extras.push(entry);
  return () => {
    const i = extras.indexOf(entry);
    if (i >= 0) extras.splice(i, 1);
  };
}

export function radioWriteExtrasFor(profileId: string): RadioWriteExtras | undefined {
  return extras.find((e) => e.matches(profileId));
}

/** Test hook: clear all registrations. */
export function clearRadioSettingsRegistrations(): void {
  parts.length = 0;
  extras.length = 0;
}
