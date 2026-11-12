/**
 * RT95 safety backup on Backup / Restore (#1617): the calibration and identity block (EEPROM 0x3B00-0x3FFF)
 * cannot be rebuilt, so a saved copy must exist before the main board is flashed. Read-only: no restore.
 * "Saved" is recorded only when the operator says they saved the file (a browser cannot confirm a download).
 */

import { useRef, useState } from 'react';
import { Alert, FileButton, Group, Stack, Text } from '@mantine/core';
import { listSafetyBackupRecords } from '@integrations/persistence/radioSafetyBackupRecords.ts';
import {
  normaliseRadioSerial,
  RT95_SAFETY_RECORD_FAMILY,
} from '@integrations/radio-io/radios/rt95/safetyBackup/files.ts';
import type { Rt95SafetyRegion } from '@integrations/radio-io/radios/rt95/safetyBackup/reader.ts';
import {
  downloadRt95SafetyZip,
  openRt95SafetyBackupFile,
  recordRt95SafetyBackupFile,
  recordRt95SafetyBackupSaved,
  type OpenedRt95SafetyFile,
  type Rt95SafetyBackupResult,
} from '../../services/rt95SafetyBackup.ts';
import { FormSection } from '../../components/ui/index.ts';
import { Button, TextInput } from '../../components/v2/index.ts';

export interface Rt95SafetyBackupPanelProps {
  busy: boolean;
  serialOk: boolean;
  /** The last backup read in this page visit (already downloaded). */
  result: Rt95SafetyBackupResult | null;
  onBackup: (region: Rt95SafetyRegion, serial: string) => void;
  onClear: () => void;
}

const REGION_LABEL: Record<Rt95SafetyRegion, string> = {
  cal: 'calibration',
  full: 'full EEPROM',
};

export default function Rt95SafetyBackupPanel({
  busy,
  serialOk,
  result,
  onBackup,
  onClear,
}: Rt95SafetyBackupPanelProps) {
  const fileResetRef = useRef<() => void>(null);
  const [serial, setSerial] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [recordedFile, setRecordedFile] = useState<string | null>(null);
  const [recordFailed, setRecordFailed] = useState(false);
  const [opened, setOpened] = useState<OpenedRt95SafetyFile | null>(null);
  const [openedSerial, setOpenedSerial] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [, setVersion] = useState(0);

  const serialKey = normaliseRadioSerial(serial);
  const records = listSafetyBackupRecords(RT95_SAFETY_RECORD_FAMILY);
  const savedForResult =
    result !== null && recordedFile === result.fileName && recordedFile !== null;

  function confirmSaved() {
    if (!result) return;
    const ok = recordRt95SafetyBackupSaved(result);
    setRecordFailed(!ok);
    setRecordedFile(result.fileName);
    setVersion((v) => v + 1);
  }

  async function handleOpenFile(file: File | null) {
    if (!file) return;
    setFileError(null);
    setOpened(null);
    setOpenedSerial('');
    try {
      setOpened(
        await openRt95SafetyBackupFile(new Uint8Array(await file.arrayBuffer()), file.name),
      );
    } catch (err) {
      setFileError(err instanceof Error ? err.message : String(err));
    } finally {
      fileResetRef.current?.();
    }
  }

  const openedKey = opened ? normaliseRadioSerial(opened.parsed.serial || openedSerial) : '';

  function recordOpened() {
    if (!opened) return;
    const ok = recordRt95SafetyBackupFile(opened, openedSerial);
    setRecordFailed(!ok);
    if (ok) {
      setRecordedFile(opened.fileName);
      setOpened(null);
      setVersion((v) => v + 1);
    }
  }

  return (
    <FormSection title="Safety backup">
      <Stack gap="sm">
        <Text size="sm">
          Your radio&apos;s calibration and identity (EEPROM 0x3B00–0x3FFF) cannot be rebuilt. Save
          a copy once before flashing the main board. Channels and settings are covered by a normal
          backup.
        </Text>
        <TextInput
          label="Radio serial number"
          hint="Read it from the label on the radio. The backup is filed under this number."
          value={serial}
          onChange={(e) => setSerial(e.target.value)}
          disabled={busy}
          mono
        />
        <Group gap="sm">
          <Button
            size="sm"
            disabled={busy || !serialOk || serialKey === ''}
            onClick={() => {
              setConfirmed(false);
              onBackup('cal', serialKey);
            }}
          >
            Back up calibration
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || !serialOk || serialKey === ''}
            onClick={() => {
              setConfirmed(false);
              onBackup('full', serialKey);
            }}
          >
            Back up full EEPROM
          </Button>
          <FileButton
            resetRef={fileResetRef}
            onChange={(f) => void handleOpenFile(f)}
            accept=".zip"
          >
            {(props) => (
              <Button size="sm" variant="secondary" disabled={busy} {...props}>
                Use a backup file I already have
              </Button>
            )}
          </FileButton>
        </Group>
        <Text size="xs" c="dimmed">
          Full EEPROM takes about 4 to 6 minutes. This does not write to the radio.
        </Text>

        {fileError ? <Alert color="red">{fileError}</Alert> : null}
        {recordFailed ? (
          <Alert color="yellow">
            This browser would not keep the record. Keep the file safe; Studio will ask again later.
          </Alert>
        ) : null}

        {result ? (
          <Stack gap="xs">
            <Text size="sm" fw={600}>
              Backed up ({REGION_LABEL[result.region]})
            </Text>
            <Text size="sm">
              Serial {result.manifest.serial} · {result.ident.model} {result.ident.version} · both
              reads matched
              {result.manifest.rereads.length > 0
                ? ` (${result.manifest.rereads.length} block(s) needed a third read)`
                : ''}
            </Text>
            <Text size="sm">
              File {result.fileName}, fingerprint{' '}
              <Text span ff="monospace">
                {result.manifest.fingerprint}
              </Text>
            </Text>
            <label>
              <input
                type="checkbox"
                checked={confirmed || savedForResult}
                disabled={savedForResult}
                onChange={(e) => {
                  setConfirmed(e.target.checked);
                  if (e.target.checked) confirmSaved();
                }}
              />{' '}
              I&apos;ve saved {result.fileName} (fingerprint {result.manifest.fingerprint})
            </label>
            <Group gap="sm">
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={() => downloadRt95SafetyZip(result)}
              >
                Save file again
              </Button>
              <Button size="sm" variant="ghost" disabled={busy} onClick={onClear}>
                Clear
              </Button>
            </Group>
          </Stack>
        ) : null}

        {opened ? (
          <Stack gap="xs">
            <Text size="sm" fw={600}>
              Backup file checked ({REGION_LABEL[opened.parsed.region]})
            </Text>
            <Text size="sm">
              {opened.parsed.manifest.ident.model} {opened.parsed.manifest.ident.version}
              {opened.parsed.serial ? ` · serial ${opened.parsed.serial}` : ''} · fingerprint{' '}
              <Text span ff="monospace">
                {opened.parsed.manifest.fingerprint}
              </Text>
            </Text>
            {opened.parsed.serial ? null : (
              <TextInput
                label="Radio serial number"
                hint="This file has no serial number. Type the one on the radio's label."
                value={openedSerial}
                onChange={(e) => setOpenedSerial(e.target.value)}
                mono
              />
            )}
            <Group gap="sm">
              <Button size="sm" disabled={openedKey === ''} onClick={recordOpened}>
                Record this backup for this radio
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOpened(null)}>
                Cancel
              </Button>
            </Group>
          </Stack>
        ) : null}

        <Stack gap={2}>
          <Text size="sm" fw={600}>
            Saved backups
          </Text>
          {records.length === 0 ? (
            <Text size="sm" c="dimmed">
              None recorded in this browser.
            </Text>
          ) : (
            records.map((r) => (
              <Text key={`${r.radioKey}:${r.sha256}`} size="sm">
                Serial {r.radioKey} · saved {new Date(r.savedAt).toLocaleDateString()} ·{' '}
                {REGION_LABEL[r.region]} · fingerprint{' '}
                <Text span ff="monospace">
                  {r.fingerprint}
                </Text>
              </Text>
            ))
          )}
        </Stack>
      </Stack>
    </FormSection>
  );
}
