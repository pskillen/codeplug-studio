import { describe, expect, it } from 'vitest';
import type { BytePipe } from '../../types.ts';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import { createRt95HeadFirmwareUpdater } from './firmwareUpdate/updater.ts';
import { Rt95BootloaderMock } from './firmwareUpdate/__fixtures__/rt95BootloaderMock.ts';
import {
  preparedRt95HeadImage,
  synthRt95HeadPackage,
} from './firmwareUpdate/__fixtures__/syntheticPackage.ts';
import { buildSyntheticRt95Image } from './__fixtures__/syntheticImage.ts';
import { createFakeRt95Pipe } from './__fixtures__/fakeRt95Pipe.ts';
import { RT95_IMAGE_SIZE } from './constants.ts';
import { Rt95Protocol } from './protocol.ts';

/**
 * The host's Web Serial layer may cut one write into two (the frame split fixed for #1546). On the RT95's
 * single-wire bridge the radio sees one byte stream, so each write is cut in two at an arbitrary byte here
 * and the session must come out the same. Link framing: docs/reference/radios/retevis/rt95/protocol.md.
 */
function splitEveryWrite(inner: BytePipe): BytePipe & { cuts: number } {
  let n = 0;
  const out = {
    cuts: 0,
    get baudRate() {
      return inner.baudRate;
    },
    async write(data: Uint8Array) {
      if (data.length < 2) return inner.write(data);
      // Deterministic but arbitrary cut point in 1..length-1, different for each write.
      const at = 1 + ((n++ * 7 + 3) % (data.length - 1));
      out.cuts++;
      await inner.write(data.subarray(0, at));
      await inner.write(data.subarray(at));
    },
    readExact: (len: number, timeoutMs: number) => inner.readExact(len, timeoutMs),
    flush: () => inner.flush?.() ?? Promise.resolve(),
    close: () => inner.close(),
  };
  return out as BytePipe & { cuts: number };
}

describe('RT95 writes cut in two at an arbitrary byte (#1546)', () => {
  it('a codeplug write lands the same EEPROM and W log as the unsplit write', async () => {
    const bytes = buildSyntheticRt95Image();
    bytes[0x0100] = 0x42;
    const image = () => {
      const map = createMemoryMap(RT95_IMAGE_SIZE);
      map.set(0, bytes.subarray(0, RT95_IMAGE_SIZE));
      return map;
    };

    const whole = createFakeRt95Pipe();
    const wholeRadio = new Rt95Protocol();
    await wholeRadio.connect(whole);
    await wholeRadio.upload(image(), {});

    const inner = createFakeRt95Pipe();
    const cut = splitEveryWrite(inner);
    const radio = new Rt95Protocol();
    await radio.connect(cut);
    await radio.upload(image(), {});

    expect(cut.cuts).toBeGreaterThan(500);
    expect(inner.log).toEqual(whole.log);
    expect(inner.eeprom).toEqual(whole.eeprom);
    expect(inner.eeprom[0x0100]).toBe(0x42);
  });

  it.each([true, false])('the head flasher still finishes byte-exact (echo %s)', async (echo) => {
    const files = synthRt95HeadPackage();
    const image = preparedRt95HeadImage(files);

    const whole = new Rt95BootloaderMock({ echo });
    const updater = createRt95HeadFirmwareUpdater();
    await updater.identify(whole);
    await updater.flash(image, {});

    const mock = new Rt95BootloaderMock({ echo });
    const cut = splitEveryWrite(mock);
    const cutUpdater = createRt95HeadFirmwareUpdater();
    await cutUpdater.identify(cut);
    const result = await cutUpdater.flash(image, {});

    expect(cut.cuts).toBeGreaterThan(50);
    expect(result.end).toBe('acknowledged');
    expect(mock.received).toEqual(whole.received);
    expect(mock.image(0x08002000, files.cdd.length)).toEqual(files.cdd);
    expect(mock.log.filter((l) => l.startsWith('unknown') || l === 'badframe')).toEqual([]);
  });
});
