import { Button } from '@mantine/core';

/** Show/hide toggle for password bytes; pair with `useSensitiveReveal`. */
export function SensitiveRevealButton({
  revealed,
  onToggle,
}: {
  revealed: boolean;
  onToggle: () => void;
}) {
  return (
    <Button variant="default" size="xs" aria-pressed={revealed} onClick={onToggle}>
      {revealed ? 'Hide password' : 'Show password'}
    </Button>
  );
}
