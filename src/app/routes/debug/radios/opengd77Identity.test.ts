import { describe, expect, it } from 'vitest';
import { packRadioBackupZip } from '@integrations/radio-io/backup/index.ts';
import { OPENGD77_DM1701_MODEL_ID } from '@integrations/radio-io/radios/opengd77/hydration.ts';
import { openDebugArchive } from './captureArchive.ts';
import { syntheticOpenGd77Archive } from './opengd77.fixture.ts';
import { openGd77IdentityRows } from './opengd77Identity.ts';

const rows = (input: Parameters<typeof openGd77IdentityRows>[0]) =>
  Object.fromEntries(openGd77IdentityRows(input));

describe('openGd77IdentityRows', () => {
  it('reports nothing observed without an archive', () => {
    const r = rows({ connection: 'Not connected' });
    expect(r['Evidence']).toBe('No radio identity observed');
    expect(r['Radio type · FirmwareInfo']).toBe('Unknown');
    expect(r['Connection']).toBe('Not connected');
    expect(r['Serial']).toBe('None reported by FirmwareInfo');
    expect(r['Firmware fork']).toBe('Unknown');
    expect(r['Firmware mod']).toBe('Unknown');
  });

  it('reads identity from the captured FirmwareInfo reply, as reported', async () => {
    const archive = await syntheticOpenGd77Archive(OPENGD77_DM1701_MODEL_ID, {
      radioType: 0x0a,
      revision: 'R20260130',
    });
    const r = rows({ archive, connection: 'Read complete · disconnected' });
    expect(r['Radio type · FirmwareInfo']).toBe('0x0a · DM-1701 / RT-84 (RGB display)');
    expect(r['Revision · FirmwareInfo (as reported)']).toBe('R20260130');
    expect(r['Build date · FirmwareInfo (as reported)']).toBe('20240101120000');
    expect(r['Flash ID · FirmwareInfo']).toBe('0x4018');
    expect(r['Features · FirmwareInfo']).toBe('0x0004 · voice prompts loaded');
    expect(r['Evidence']).toBe('Captured FirmwareInfo reply');
  });

  it('does not treat the manifest firmware string as identity', async () => {
    const full = await syntheticOpenGd77Archive(OPENGD77_DM1701_MODEL_ID);
    expect(full.manifest.firmware).toBeTruthy();
    const bare = openDebugArchive(
      packRadioBackupZip(full.manifest, full.regions),
      OPENGD77_DM1701_MODEL_ID,
    );
    const r = rows({ archive: bare, connection: 'Not connected' });
    expect(r['Evidence']).toBe('Archive manifest only');
    expect(r['Revision · FirmwareInfo (as reported)']).toBe('Unknown');
    expect(r['Radio type · FirmwareInfo']).toBe('Unknown');
  });

  it('names an invalid FirmwareInfo and shows no values', async () => {
    const full = await syntheticOpenGd77Archive(OPENGD77_DM1701_MODEL_ID);
    const bad = openDebugArchive(
      packRadioBackupZip(full.manifest, full.regions, {
        'debug/firmware-info.bin': new Uint8Array(7),
      }),
      OPENGD77_DM1701_MODEL_ID,
    );
    const r = rows({ archive: bad, connection: 'Not connected' });
    expect(r['Evidence']).toMatch(/^Invalid FirmwareInfo: .*7 bytes/);
    expect(r['Radio type · FirmwareInfo']).toBe('Unknown');
  });
});
