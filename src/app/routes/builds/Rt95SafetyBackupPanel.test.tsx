import { MantineProvider } from '@mantine/core';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findSafetyBackupRecord } from '@integrations/persistence/radioSafetyBackupRecords.ts';
import {
  buildFakeRt95Eeprom,
  createFakeRt95Pipe,
} from '@integrations/radio-io/radios/rt95/__fixtures__/fakeRt95Pipe.ts';
import { RT95_SAFETY_SIGNATURE_ADDR } from '@integrations/radio-io/radios/rt95/safetyBackup/reader.ts';
import {
  runRt95SafetyBackup,
  type Rt95SafetyBackupResult,
} from '@integrations/radio-io/radios/rt95/safetyBackup/runner.ts';
import Rt95SafetyBackupPanel from './Rt95SafetyBackupPanel.tsx';

async function synthetic(): Promise<Rt95SafetyBackupResult> {
  const e = buildFakeRt95Eeprom();
  e.set(new TextEncoder().encode('AT778-UV'), RT95_SAFETY_SIGNATURE_ADDR);
  return runRt95SafetyBackup(createFakeRt95Pipe({ eeprom: e }), {
    region: 'cal',
    serial: 'ab 12345',
  });
}

function renderPanel(result: Rt95SafetyBackupResult | null, onBackup = vi.fn()) {
  render(
    <MantineProvider>
      <Rt95SafetyBackupPanel
        busy={false}
        serialOk
        result={result}
        onBackup={onBackup}
        onClear={() => {}}
      />
    </MantineProvider>,
  );
  return onBackup;
}

function upload(bytes: Uint8Array, name = 'backup.zip') {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  const file = new File([new Uint8Array(bytes)], name, { type: 'application/zip' });
  fireEvent.change(input, { target: { files: [file] } });
}

describe('Rt95SafetyBackupPanel', () => {
  beforeEach(() => window.localStorage.clear());

  it('needs a serial before it offers a backup, and passes it normalised', () => {
    const onBackup = renderPanel(null);
    const button = screen.getByRole('button', { name: 'Back up calibration' });
    expect(button).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Radio serial number'), {
      target: { value: ' ab 12345 ' },
    });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    expect(onBackup).toHaveBeenCalledWith('cal', 'AB 12345');
  });

  it('writes the record only after the "I have saved" tick', async () => {
    const result = await synthetic();
    renderPanel(result);
    expect(findSafetyBackupRecord('retevis-rt95', 'AB 12345')).toBeUndefined();
    fireEvent.click(screen.getByRole('checkbox'));
    expect(findSafetyBackupRecord('retevis-rt95', 'AB 12345')).toMatchObject({
      fileName: result.fileName,
      fingerprint: result.manifest.fingerprint,
    });
    expect(screen.getAllByText(/AB 12345/).length).toBeGreaterThan(0);
  });

  it('records a valid backup file I already have, and refuses an invalid one', async () => {
    const result = await synthetic();
    renderPanel(null);
    upload(new Uint8Array([1, 2, 3]));
    await waitFor(() => expect(screen.getByText(/not a readable zip/)).toBeInTheDocument());
    expect(findSafetyBackupRecord('retevis-rt95', 'AB 12345')).toBeUndefined();

    upload(result.zipBytes);
    const record = await screen.findByRole('button', { name: /Record this backup/ });
    expect(findSafetyBackupRecord('retevis-rt95', 'AB 12345')).toBeUndefined();
    fireEvent.click(record);
    expect(findSafetyBackupRecord('retevis-rt95', 'AB 12345')?.fileName).toBe('backup.zip');
  });
});
