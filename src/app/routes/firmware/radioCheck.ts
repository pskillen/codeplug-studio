/**
 * What the wizard knows about the radio itself, for a radio whose firmware comes in more than one flash layout (UV-5R
 * Mini): its own report, or the operator's Radio Info answers. Pure: the "Your radio" step, `canAdvance` and Prepare
 * all compute the answer here, so they never disagree. Prepare still runs every interlock on top.
 */
import type { LoadedFirmwarePatch } from '@core/firmware/releases/types.ts';
import type {
  FirmwareRadioLayoutQuestion,
  RadioInfoAnswers,
  RadioLayoutAnswer,
} from '@core/firmware/types.ts';
import type { FirmwareUpdaterDescriptor } from '@integrations/radio-io';

import { noFileForRadioMessage, releaseHasFileForLayout } from '../../services/firmwareFlash.ts';

/** The radio check a descriptor asks for: its Radio Info question, and its report when the radio is read first. */
export interface RadioCheckSetup {
  readonly question: FirmwareRadioLayoutQuestion;
  /** Set when the descriptor's question has a report and the updater can read it: the radio is read first. */
  readonly report?: NonNullable<FirmwareRadioLayoutQuestion['report']>;
}

/** The check for `updater`'s radio, or null when the radio has one flash layout (nothing to check). */
export function radioCheckSetup(
  updater: Pick<FirmwareUpdaterDescriptor, 'stock' | 'radioReport'>,
): RadioCheckSetup | null {
  const question = updater.stock.radioLayout;
  if (!question) return null;
  return question.report && updater.radioReport
    ? { question, report: question.report }
    : { question };
}

/**
 * The radio report read: a report and what it decides; no report (the Radio Info question is asked); or the read
 * failed (the question is asked, with the reason shown).
 */
export type RadioReadStatus =
  | { readonly kind: 'report'; readonly answer: RadioLayoutAnswer }
  | { readonly kind: 'none' }
  | { readonly kind: 'failed'; readonly message: string };

/** The parts of the wizard state the answer depends on. */
export interface RadioCheckInputs {
  readonly radioInfo: RadioInfoAnswers;
  readonly radioRead: RadioReadStatus | null;
  readonly loadedPatch: LoadedFirmwarePatch | null;
  readonly layoutRetry: { readonly to: string; readonly toBase?: string } | null;
}

export interface RadioCheckAnswer {
  /** The answer; null when the radio has one layout. */
  readonly answer: RadioLayoutAnswer | null;
  /** The Radio Info question is asked: no report is read, or the read found none or failed. */
  readonly asksQuestion: boolean;
  /** Undefined when the radio has one layout; null while the answer gives none. A retry's layout wins. */
  readonly radioLayout: string | null | undefined;
  /** The build the radio says it runs, where it says so; it decides "already installed". */
  readonly radioBuild: string | undefined;
  /** A radio that reported about itself runs a modded build, even when it named none. */
  readonly radioReported: boolean;
  /**
   * The code base the radio runs: what its report says, or what the answers name. After a retry, a radio that didn't
   * report is taken to run the base of the file prepared for the other layout (its answers were wrong); a reported
   * base stands, so the interlocks refuse a retry that would change it.
   */
  readonly radioCodeBase: string | undefined;
  /** The chosen release has files by layout but none for this radio: the refusal, else null. */
  readonly unavailable: string | null;
}

/** The answer for `setup`'s radio from the wizard state. */
export function radioCheckAnswer(
  state: RadioCheckInputs,
  setup: RadioCheckSetup | null,
): RadioCheckAnswer {
  const { radioInfo, radioRead, loadedPatch, layoutRetry } = state;
  const report = setup?.report;
  // The radio is read first when it may report about itself; the question is asked only without a report.
  const asksQuestion = !!setup && (!report || (radioRead !== null && radioRead.kind !== 'report'));
  const answer: RadioLayoutAnswer | null = !setup
    ? null
    : radioRead?.kind === 'report' && report
      ? radioRead.answer
      : asksQuestion
        ? setup.question.resolve(radioInfo)
        : { kind: 'incomplete' };
  // After the radio refused one layout's file before installing anything, its layout is taken to be the other one.
  const radioLayout: string | null | undefined = !answer
    ? undefined
    : answer.kind === 'layout'
      ? (layoutRetry?.to ?? answer.layout)
      : null;
  const radioBuild = answer?.kind === 'layout' ? answer.build : undefined;
  const radioReported = answer?.kind === 'layout' && answer.reported === true;
  const radioCodeBase =
    answer?.kind !== 'layout'
      ? undefined
      : layoutRetry && !answer.reported
        ? layoutRetry.toBase
        : answer.codeBase;
  // The release has files by layout but none for this radio (its layout, and its base where known): never the
  // nearest build instead.
  const unavailable =
    !!loadedPatch &&
    typeof radioLayout === 'string' &&
    !releaseHasFileForLayout(loadedPatch, radioLayout, radioCodeBase)
      ? noFileForRadioMessage(loadedPatch, radioLayout, radioCodeBase)
      : null;
  return {
    answer,
    asksQuestion,
    radioLayout,
    radioBuild,
    radioReported,
    radioCodeBase,
    unavailable,
  };
}

/**
 * The check passes: the answer names the radio's firmware, and the chosen release has a file for it (or no release is
 * chosen yet). A radio with one layout always passes.
 */
export function isRadioCheckDone(answer: RadioCheckAnswer): boolean {
  if (answer.answer === null) return true;
  return answer.answer.kind === 'layout' && answer.unavailable === null;
}
