import type { FirmwareFlashPhase, FirmwareFlashProgress } from '@integrations/radio-io';

/** Longest gap between progress renders while frames stream. */
export const FLASH_PROGRESS_INTERVAL_MS = 100;

export interface FlashProgressThrottle {
  /** Feed every progress event from the updater. */
  push(p: FirmwareFlashProgress): void;
  /** Deliver any held update now (call when the flash ends). */
  flush(): void;
  /** Drop any held update and stop the timer. */
  cancel(): void;
}

/**
 * Coalesces flash progress so a long transfer (tens of thousands of frames) renders at most every `intervalMs`.
 * A phase change, or the radio becoming touched, is delivered at once.
 */
export function createFlashProgressThrottle(
  deliver: (p: FirmwareFlashProgress) => void,
  intervalMs = FLASH_PROGRESS_INTERVAL_MS,
): FlashProgressThrottle {
  let last: FirmwareFlashProgress | null = null;
  let pending: FirmwareFlashProgress | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const send = (p: FirmwareFlashProgress) => {
    last = p;
    pending = null;
    deliver(p);
  };
  const clearTimer = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  return {
    push(p) {
      const urgent =
        last === null || p.phase !== last.phase || (p.radioTouched && !last.radioTouched);
      if (urgent) {
        clearTimer();
        send(p);
        return;
      }
      pending = p;
      timer ??= setTimeout(() => {
        timer = null;
        if (pending) send(pending);
      }, intervalMs);
    },
    flush() {
      clearTimer();
      if (pending) send(pending);
    },
    cancel() {
      clearTimer();
      pending = null;
    },
  };
}

/** The wizard's flash phases, in order. */
export const FLASH_PHASES: readonly { phase: FirmwareFlashPhase; label: string }[] = [
  { phase: 'handshake', label: 'Handshake' },
  { phase: 'erase', label: 'Erase' },
  { phase: 'transfer', label: 'Transfer' },
  { phase: 'finish', label: 'Finish' },
];

/**
 * The phases to show: every phase from the current one on, plus earlier phases the updater actually reported.
 * An updater that never reports a phase (one that erases as part of the transfer) doesn't show it as a step.
 * Handshake always shows: identifying the bootloader is the handshake.
 */
export function visibleFlashPhases(
  seen: ReadonlySet<FirmwareFlashPhase>,
  current: FirmwareFlashPhase,
): readonly { phase: FirmwareFlashPhase; label: string }[] {
  const currentIndex = FLASH_PHASES.findIndex((p) => p.phase === current);
  return FLASH_PHASES.filter(
    (p, i) => i >= currentIndex || p.phase === 'handshake' || seen.has(p.phase),
  );
}

/** Shown while the first data frame waits for its reply. */
export const FLASH_WAITING_FOR_RADIO = 'Waiting for the radio (it may be erasing)…';

/** Transfer detail: the waiting message before the first frame is acknowledged, else the updater's text. */
export function transferDetail(p: FirmwareFlashProgress): string {
  return p.phase === 'transfer' && p.cur === 0 ? FLASH_WAITING_FOR_RADIO : p.msg;
}
