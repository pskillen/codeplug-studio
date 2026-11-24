import { beforeEach, describe, expect, it, vi } from 'vitest';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';

const session = { id: 'airsec-session' };

vi.mock('./radioIoSession.ts', () => ({
  grantRadioSerialPortForEgress: vi.fn(async () => ({ transport: 'web', port: { id: 'port' } })),
  openRadioSessionForEgress: vi.fn(async () => ({ session })),
  closeRadioSession: vi.fn(async () => {}),
}));

vi.mock('./radioIoAtD890AirSecurity.ts', () => ({
  readAtD890AirSecuritySeedSet: vi.fn(async () => true),
  writeAtD890AirSecuritySeed: vi.fn(async () => ({ writeVerifyPending: { unused: true } })),
}));

import {
  readAtD890AirSecuritySeedSet,
  writeAtD890AirSecuritySeed,
} from './radioIoAtD890AirSecurity.ts';
import {
  closeRadioSession,
  grantRadioSerialPortForEgress,
  openRadioSessionForEgress,
  type GrantedRadioSerialPort,
} from './radioIoSession.ts';
import {
  checkAtD890AirSecuritySeed,
  writeAtD890AirSecuritySeedOnRadio,
} from './radioIoAtD890AirSecuritySession.ts';

const { egress } = newRadioBuildForProfile('p', 'radio-io-at-d890uv-mm9pdy');
const granted = { transport: 'web' as const, port: { id: 'port' } };

beforeEach(() => {
  vi.mocked(grantRadioSerialPortForEgress).mockClear();
  vi.mocked(openRadioSessionForEgress).mockClear();
  vi.mocked(closeRadioSession).mockClear();
  vi.mocked(readAtD890AirSecuritySeedSet).mockClear();
  vi.mocked(writeAtD890AirSecuritySeed).mockClear();
  vi.mocked(grantRadioSerialPortForEgress).mockResolvedValue(
    granted as unknown as GrantedRadioSerialPort,
  );
  vi.mocked(openRadioSessionForEgress).mockResolvedValue({ session } as never);
  vi.mocked(readAtD890AirSecuritySeedSet).mockResolvedValue(true);
  vi.mocked(writeAtD890AirSecuritySeed).mockResolvedValue({
    writeVerifyPending: { unused: true },
  } as never);
});

describe('AirSecurity seed session', () => {
  it('grants the port first, reads whether a seed is set, and closes', async () => {
    await expect(checkAtD890AirSecuritySeed(egress)).resolves.toBe(true);
    expect(grantRadioSerialPortForEgress).toHaveBeenCalledWith({ forcePortSelection: true });
    expect(vi.mocked(grantRadioSerialPortForEgress).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(openRadioSessionForEgress).mock.invocationCallOrder[0]!,
    );
    expect(openRadioSessionForEgress).toHaveBeenCalledWith(egress, {
      grantedPort: granted,
      purpose: 'read',
      signal: undefined,
    });
    expect(readAtD890AirSecuritySeedSet).toHaveBeenCalledWith(session, undefined);
    expect(writeAtD890AirSecuritySeed).not.toHaveBeenCalled();
    expect(closeRadioSession).toHaveBeenCalledWith(session);
  });

  it('writes without reading the seed back, ignores the write result, and closes', async () => {
    const seed = Uint8Array.from([1, 2, 3]);
    await writeAtD890AirSecuritySeedOnRadio(egress, seed);
    expect(writeAtD890AirSecuritySeed).toHaveBeenCalledWith(session, egress, seed, undefined);
    expect(readAtD890AirSecuritySeedSet).not.toHaveBeenCalled();
    expect(closeRadioSession).toHaveBeenCalledWith(session);
  });

  it('closes when the write throws', async () => {
    vi.mocked(writeAtD890AirSecuritySeed).mockRejectedValueOnce(new Error('radio stopped'));
    await expect(writeAtD890AirSecuritySeedOnRadio(egress, null)).rejects.toThrow('radio stopped');
    expect(readAtD890AirSecuritySeedSet).not.toHaveBeenCalled();
    expect(closeRadioSession).toHaveBeenCalledWith(session);
  });
});
