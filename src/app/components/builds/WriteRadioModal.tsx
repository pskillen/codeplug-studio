/**
 * Write radio popup (#1121) — Write codeplug plus optional digital-contacts / keps extras.
 */

import { Link } from 'react-router-dom';
import { Anchor, Group, Stack, Text } from '@mantine/core';
import type { DigitalContactsWriteSource } from '@core/domain/digitalIdDirectoryProjection.ts';
import { Button, Checkbox, FormField, ModalShell, SegmentedControl } from '../v2/index.ts';

export interface WriteRadioModalProps {
  open: boolean;
  onClose: () => void;
  buildId: string;
  serialOk: boolean;
  busy: boolean;
  writeHidden: boolean;
  supportsDigitalContacts: boolean;
  /** OpenGD77 shared Contacts bank — talk groups still rewrite the bank when contacts are skipped. */
  sharedContactBankNote?: boolean;
  supportsKeps: boolean;
  contactSource: DigitalContactsWriteSource;
  onContactSourceChange: (source: DigitalContactsWriteSource) => void;
  kepsSelected: boolean;
  onKepsSelectedChange: (selected: boolean) => void;
  onWriteCodeplug: () => void;
  onWriteContacts: () => void;
  onWriteKeps: () => void;
}

const CONTACT_SOURCE_OPTIONS: { value: DigitalContactsWriteSource; label: string }[] = [
  { value: 'none', label: 'None' },
  { value: 'library', label: 'Library' },
  { value: 'directory', label: 'RadioID' },
  { value: 'both', label: 'Both' },
];

export default function WriteRadioModal({
  open,
  onClose,
  buildId,
  serialOk,
  busy,
  writeHidden,
  supportsDigitalContacts,
  sharedContactBankNote = false,
  supportsKeps,
  contactSource,
  onContactSourceChange,
  kepsSelected,
  onKepsSelectedChange,
  onWriteCodeplug,
  onWriteContacts,
  onWriteKeps,
}: WriteRadioModalProps) {
  const writeDisabled = !serialOk || busy || writeHidden;
  const contactsWriteDisabled = writeDisabled || contactSource === 'none';
  const kepsWriteDisabled = writeDisabled || !kepsSelected;

  return (
    <ModalShell open={open} onClose={onClose} title="Write radio" size="md">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
          <Stack gap={4}>
            <Text fw={600} size="sm">
              Write codeplug
            </Text>
            <Text size="xs" c="dimmed">
              Writes this build onto the connected radio.
              {supportsDigitalContacts ? ' Digital contacts follow the source below.' : ''}
              {supportsKeps ? ' Satellite keps use Write keps only — not Write codeplug.' : ''}
            </Text>
          </Stack>
          <Button variant="primary" size="sm" disabled={writeDisabled} onClick={onWriteCodeplug}>
            Write codeplug
          </Button>
        </Group>

        {supportsDigitalContacts ? (
          <Stack gap="xs">
            <FormField
              label="Digital contacts"
              hint="Library contacts are curated project rows. RadioID directory is the local shadow book. None leaves the radio contact banks unchanged. Both: library wins on duplicate DMR ID."
            >
              <SegmentedControl
                size="sm"
                value={contactSource}
                onChange={onContactSourceChange}
                disabled={busy}
                options={CONTACT_SOURCE_OPTIONS}
              />
            </FormField>
            {sharedContactBankNote ? (
              <Text size="xs" c="dimmed">
                Talk groups still rewrite this radio&apos;s shared contact bank. Skipping library
                contacts and RadioID directory does not preserve private-contact slots already on
                the radio.
              </Text>
            ) : null}
            <Group justify="flex-end">
              <Button
                variant="secondary"
                size="sm"
                disabled={contactsWriteDisabled}
                onClick={onWriteContacts}
              >
                Write contacts only
              </Button>
            </Group>
          </Stack>
        ) : null}

        {supportsKeps ? (
          <Stack gap="xs">
            <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
              <Stack gap={4}>
                <Group gap="xs">
                  <Checkbox
                    checked={kepsSelected}
                    onCheckedChange={onKepsSelectedChange}
                    disabled={busy}
                    aria-label="Satellite keps"
                  />
                  <Text fw={600} size="sm">
                    Satellite keps
                  </Text>
                </Group>
                <Text size="xs" c="dimmed">
                  Writes enabled library satellites only — not part of Write codeplug.{' '}
                  <Anchor component={Link} to={`/builds/${buildId}/satellite-keps`} size="xs">
                    Preview on the Satellite keps tab
                  </Anchor>
                  .
                </Text>
              </Stack>
              <Button
                variant="secondary"
                size="sm"
                disabled={kepsWriteDisabled}
                onClick={onWriteKeps}
              >
                Write keps only
              </Button>
            </Group>
          </Stack>
        ) : null}
      </Stack>
    </ModalShell>
  );
}
