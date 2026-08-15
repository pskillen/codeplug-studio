import { describe, expect, it } from 'vitest';
import {
  OPENGD77_TYPE_COMMAND,
  OPENGD77_TYPE_WRITE_UV380,
  OPENGD77_WRITE_CMD_SET_SECTOR,
} from '../../kit/codecs/opengd77Serial.ts';
import { OPENGD77_CMD_CONTROL, OPENGD77_CONTROL_SAVE_REBOOT } from './constants.ts';
import { OpenGd77Protocol } from './protocol.ts';
import { encodeOpenGd77UserDatabase } from './userDatabaseCodec.ts';
import {
  overlayUserDatabaseSpanOnSector,
  userDatabaseFlashSpans,
  userDatabaseSectorAbsSet,
} from './userDatabaseWrite.ts';
import { OpenGd77ScriptedPipe } from './__fixtures__/scriptedPipe.ts';

describe('OpenGD77 User Database sidecar write', () => {
  it('overlays occupied header bytes onto the header sector', () => {
    const encoded = encodeOpenGd77UserDatabase([
      {
        wireName: 'Ada',
        digitalId: 1001,
        callsign: 'M0ABC',
        city: '',
        province: '',
        country: '',
        remark: '',
      },
    ]);
    const spans = userDatabaseFlashSpans(encoded);
    const sectors = userDatabaseSectorAbsSet(spans);
    expect(sectors[0]).toBe(0x50000);
    const sector = new Uint8Array(4096);
    sector.fill(0xff);
    overlayUserDatabaseSpanOnSector(sector, 0x50000, spans[0]!);
    expect(String.fromCharCode(sector[0]!, sector[1]!)).toBe('Id');
    expect(sector[8]).toBe(1);
  });

  it('programs User Database FLASH and SAVE_REBOOT without stretching the programming image', async () => {
    const pipe = new OpenGd77ScriptedPipe(0x08);
    const proto = new OpenGd77Protocol();
    await proto.connect(pipe);
    await proto.uploadUserDatabase(
      [
        {
          wireName: 'Ada',
          digitalId: 1001,
          callsign: 'M0ABC',
          city: '',
          province: '',
          country: '',
          remark: '',
        },
      ],
      {},
    );
    expect(pipe.flashByte(0x50000)).toBe(0x49);
    expect(pipe.flashByte(0x50001)).toBe(0x64);
    expect(pipe.flashByte(0x50008)).toBe(1);
    const setSector = pipe.writes.filter(
      (w) => w[0] === OPENGD77_TYPE_WRITE_UV380 && w[1] === OPENGD77_WRITE_CMD_SET_SECTOR,
    );
    const sectorIndex = (setSector[0]![2]! << 16) | (setSector[0]![3]! << 8) | setSector[0]![4]!;
    expect(sectorIndex).toBe(0x50000 / 4096);
    expect(
      pipe.writes.some(
        (w) =>
          w[0] === OPENGD77_TYPE_COMMAND &&
          w[1] === OPENGD77_CMD_CONTROL &&
          w[2] === OPENGD77_CONTROL_SAVE_REBOOT,
      ),
    ).toBe(true);
    expect(proto.getLastUserDatabaseWarning()).toMatch(/extended callsign DB/);
  });
});
