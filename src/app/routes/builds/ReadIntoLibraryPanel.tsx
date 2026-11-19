import { Alert, Group, Stack, Text } from '@mantine/core';
import { FormSection } from '../../components/ui/index.ts';
import { Button } from '../../components/v2/index.ts';
import type { RadioReadOutcome } from '../../services/radioReadIntoLibrary.ts';
import ReadIntoLibrarySummary from './ReadIntoLibrarySummary.tsx';

interface ReadIntoLibraryPanelProps {
  busy: boolean;
  serialOk: boolean;
  outcome: RadioReadOutcome | null;
  onRead: () => void;
  onClear: () => void;
}

export default function ReadIntoLibraryPanel({
  busy,
  serialOk,
  outcome,
  onRead,
  onClear,
}: ReadIntoLibraryPanelProps) {
  return (
    <FormSection title="Read into library">
      <Stack gap="sm">
        <Text size="sm">
          Read the connected radio into your library: its channels (and zones on MM9PDY firmware)
          are added or updated, and this radio's build is created or updated. Library channels and
          zones the radio does not have stay in your library but are left out of the build. Nothing
          is sent to the radio. This does not save a backup zip; use Backup radio for that.
        </Text>
        <Group>
          <Button disabled={busy || !serialOk} onClick={onRead}>
            Read into library
          </Button>
        </Group>
        {outcome ? (
          <>
            {outcome.ok ? (
              <ReadIntoLibrarySummary summary={outcome.summary} />
            ) : (
              <Alert color="red">{outcome.message}</Alert>
            )}
            <Group>
              <Button variant="secondary" size="sm" onClick={onClear}>
                Dismiss
              </Button>
            </Group>
          </>
        ) : null}
      </Stack>
    </FormSection>
  );
}
