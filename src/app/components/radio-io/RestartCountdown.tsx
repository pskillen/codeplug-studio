import { Text } from '@mantine/core';

export interface RestartCountdownProps {
  /** Seconds left; zero shows `doneText`. */
  secondsLeft: number;
  /** The wait the countdown started from, shown as "about N s". */
  totalSeconds: number;
  /** Shown at zero. */
  doneText?: string;
  /** Shown while counting, before "(about N s)". */
  waitingText?: string;
  'data-testid'?: string;
}

/** "Waiting for the radio to restart (about 20 s): 12 s", then the done line. Used by the Write stepper and the range change. */
export default function RestartCountdown({
  secondsLeft,
  totalSeconds,
  doneText = 'Wait until the radio shows its normal screen, then continue.',
  waitingText = 'Waiting for the radio to restart',
  'data-testid': testId,
}: RestartCountdownProps) {
  if (secondsLeft > 0) {
    return (
      <Text size="sm" data-testid={testId}>
        {waitingText} (about {totalSeconds} s): {secondsLeft} s
      </Text>
    );
  }
  return <Text size="sm">{doneText}</Text>;
}
