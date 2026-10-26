import { describe, expect, it, vi } from 'vitest';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import { D890_MAP } from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import { AT_D890UV_DESCRIPTOR } from '@integrations/radio-io/radios/at-d890uv/descriptor.ts';
import { AtD890uvProtocol } from '@integrations/radio-io/radios/at-d890uv/protocol.ts';
import {
  AtD890ScriptedPipe,
  collectAtD890WriteDataAddresses,
  enableAtD890AutoWriteAck,
  localInfoWithSerial,
  makeAtD890EraseUnitBuffer,
  scriptAtD890ConnectWithNegotiation,
  scriptAtD890UploadReadResponder,
} from '@integrations/radio-io/radios/at-d890uv/__fixtures__/scriptedPipe.ts';
import type { RadioSession } from '@integrations/radio-io/types.ts';
import { readAtD890RadioSettings, writeAtD890SettingsOnly } from './radioIoAtD890SettingsWrite.ts';
import {
  RadioWriteBlockedError,
  RadioWriteCancelledError,
  type AtD890PreTransmitContext,
} from './radioIoSession.ts';

const SERIAL = 'SN-TEST-SETTINGS';

async function connectedSession() {
  const pipe = new AtD890ScriptedPipe();
  scriptAtD890ConnectWithNegotiation(pipe);
  const radio = new AtD890uvProtocol();
  await radio.connect(pipe);
  const settings = makeAtD890EraseUnitBuffer();
  for (let i = 0; i < 0x160; i++) settings[i] = (i * 3 + 1) & 0xff;
  settings.set([0x41, 0x42], 0x900);
  settings[0x1280] = 0x33;
  scriptAtD890UploadReadResponder(
    pipe,
    new Map([
      [D890_MAP.LocalInfo, localInfoWithSerial(SERIAL)],
      [0x350_0000, settings],
    ]),
  );
  enableAtD890AutoWriteAck(pipe);
  const session: RadioSession = { descriptor: AT_D890UV_DESCRIPTOR, pipe, radio };
  const { egress } = newRadioBuildForProfile('p1', 'radio-io-at-d890uv');
  return { pipe, radio, session, egress };
}

const overrides = [{ fieldId: 'keyShortP1', value: 9 }];

describe('AT-D890UV settings-only write service', () => {
  it('reads the settings snapshot', async () => {
    const { session } = await connectedSession();
    const snap = await readAtD890RadioSettings(session);
    expect(snap.main.length).toBe(0x200);
    expect(snap.main[0x13]).toBe((0x13 * 3 + 1) & 0xff);
  });

  it('writes only the settings unit and captures write-verify state', async () => {
    const { pipe, session, egress } = await connectedSession();
    const beforeTransmit = vi.fn<(c: AtD890PreTransmitContext) => Promise<'apply'>>(
      async () => 'apply',
    );

    const result = await writeAtD890SettingsOnly(session, egress, overrides, { beforeTransmit });

    expect(beforeTransmit).toHaveBeenCalledTimes(1);
    expect(beforeTransmit.mock.calls[0]![0].serial).toBe(SERIAL);
    const addrs = collectAtD890WriteDataAddresses(pipe);
    expect(addrs.length).toBeGreaterThan(0);
    expect(addrs.every((a) => a >= 0x350_0000 && a < 0x354_0000)).toBe(true);
    expect(result.writeVerifyPending?.staging.chunks.length).toBe(addrs.length);
    const kept = result.writeVerifyPending?.kept as { patches?: { fieldId: string }[] };
    expect(kept.patches?.map((p) => p.fieldId)).toEqual(['keyShortP1']);
  });

  it('refuses an empty override list', async () => {
    const { session, egress, pipe } = await connectedSession();
    await expect(writeAtD890SettingsOnly(session, egress, [])).rejects.toBeInstanceOf(
      RadioWriteBlockedError,
    );
    expect(collectAtD890WriteDataAddresses(pipe)).toEqual([]);
  });

  it("treats 'keep' and a missing callback as cancel", async () => {
    for (const beforeTransmit of [async () => 'keep' as const, undefined]) {
      const { session, egress, pipe } = await connectedSession();
      await expect(
        writeAtD890SettingsOnly(session, egress, overrides, { beforeTransmit }),
      ).rejects.toBeInstanceOf(RadioWriteCancelledError);
      expect(collectAtD890WriteDataAddresses(pipe)).toEqual([]);
    }
  });

  describe("the object form { decision: 'apply', overrides }", () => {
    const stepKeys = [
      { fieldId: 'keyShortP1', value: 14 },
      { fieldId: 'keyShortP2', value: 13 },
    ];

    it('writes the overrides the pause returns, inside the settings unit', async () => {
      const { pipe, session, egress } = await connectedSession();
      const result = await writeAtD890SettingsOnly(session, egress, overrides, {
        beforeTransmit: async () => ({ decision: 'apply', overrides: stepKeys }),
      });
      const addrs = collectAtD890WriteDataAddresses(pipe);
      expect(addrs.length).toBeGreaterThan(0);
      expect(addrs.every((a) => a >= 0x350_0000 && a < 0x354_0000)).toBe(true);
      const kept = result.writeVerifyPending?.kept as { patches?: { fieldId: string }[] };
      expect(kept.patches?.map((p) => p.fieldId)).toEqual(['keyShortP1', 'keyShortP2']);
    });

    it('writes the same frames as the string form given those overrides at the start', async () => {
      const a = await connectedSession();
      await writeAtD890SettingsOnly(a.session, a.egress, stepKeys, {
        beforeTransmit: async () => 'apply',
      });
      const b = await connectedSession();
      await writeAtD890SettingsOnly(b.session, b.egress, overrides, {
        beforeTransmit: async () => ({ decision: 'apply', overrides: stepKeys }),
      });
      expect(b.pipe.writes.map((w) => [...w])).toEqual(a.pipe.writes.map((w) => [...w]));
    });

    it('refuses a bad or empty override list from the pause before any W frame', async () => {
      for (const bad of [[{ fieldId: 'keyShortP1', value: 99 }], []]) {
        const { session, egress, pipe } = await connectedSession();
        await expect(
          writeAtD890SettingsOnly(session, egress, overrides, {
            beforeTransmit: async () => ({ decision: 'apply', overrides: bad }),
          }),
        ).rejects.toThrow();
        expect(collectAtD890WriteDataAddresses(pipe)).toEqual([]);
      }
    });
  });

  it('refuses a bad override before reading or writing', async () => {
    const { session, egress, pipe } = await connectedSession();
    const before = pipe.writes.length;
    await expect(
      writeAtD890SettingsOnly(session, egress, [{ fieldId: 'nope', value: 1 }], {
        beforeTransmit: async () => 'apply',
      }),
    ).rejects.toThrow();
    expect(pipe.writes.length).toBe(before);
  });
});
