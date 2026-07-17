import { Alert, Button, Group } from '@mantine/core';

export interface ExportOrderOverrideBannerProps {
  /** When false, renders nothing. */
  visible: boolean;
  disabled?: boolean;
  onReset: () => void;
  /** Optional override for the alert body (default: list-level copy). */
  message?: string;
}

const DEFAULT_MESSAGE =
  'Export order on this build differs from the library default. Reset clears build order overrides.';

/**
 * List-level / section indicator that build export order is overridden,
 * with confirmed reset (caller runs `window.confirm` before mutating).
 */
export default function ExportOrderOverrideBanner({
  visible,
  disabled = false,
  onReset,
  message = DEFAULT_MESSAGE,
}: ExportOrderOverrideBannerProps) {
  if (!visible) return null;

  return (
    <Alert color="yellow" title="Build order overridden">
      <Group justify="space-between" align="flex-start" gap="md" wrap="wrap">
        <span>{message}</span>
        <Button size="compact-sm" variant="light" color="yellow" disabled={disabled} onClick={onReset}>
          Reset to library order
        </Button>
      </Group>
    </Alert>
  );
}
