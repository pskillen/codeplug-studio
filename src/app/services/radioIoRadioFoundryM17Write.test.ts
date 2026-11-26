/**
 * The Review/Connect write path merges the same settings sector as the
 * protocol, and a build without the M17 feature parks rather than refusing.
 */

import { describe, expect, it } from 'vitest';
import { newChannel, newOwnDigitalId, newRadioBuildForProfile } from '@core/domain/factories.ts';
import type { Channel, ChannelModeProfileM17 } from '@core/models/library.ts';
import type { AssembledBuild, AssembledChannel } from '@core/services/assemble.ts';
import { decodeDebugFrame } from '@integrations/radio-io/kit/codecs/radioFoundryDebugLink.ts';
import { createRadioSession } from '@integrations/radio-io/kit/session.ts';
import { DM32UV_RADIOFOUNDRY_CABLE_BOARD } from '@integrations/radio-io/radios/radiofoundry/board.ts';
import { OP_BLOCK } from '@integrations/radio-io/radios/radiofoundry/constants.ts';
import { DM32_RADIOFOUNDRY_DESCRIPTOR } from '@integrations/radio-io/radios/radiofoundry/descriptor.ts';
import { RadioFoundryCableProtocol } from '@integrations/radio-io/radios/radiofoundry/protocol.ts';
import { ScriptedPipe } from '@integrations/radio-io/radios/radiofoundry/protocol.test.ts';
import {
  RADIOFOUNDRY_M17_PARKED_NOTE,
  radioFoundryWritePreflight,
} from '@integrations/radio-io/radios/radiofoundry/writePreflight.ts';
import {
  radioFoundryWriteSourceFromAssembled,
  type RadioFoundryWriteSource,
} from '@integrations/radio-io/radios/radiofoundry/writeSource.ts';
import { memoryMapFromBytes } from '@integrations/radio-io/kit/memoryMap.ts';
import { uploadPreparedRadioWrite } from './radioIoSession.ts';

/** Image offset of the RadioFoundry settings sector. The cable merge writes this block. */
const SETTINGS_BLOCK = 0xe000;

function m17Assembled(): AssembledBuild {
  const profile: ChannelModeProfileM17 = {
    mode: 'm17',
    can: 3,
    playEveryCan: true,
    destination: 'ECHO',
  };
  const entity: Channel = {
    ...newChannel('p', 'Echo'),
    rxFrequency: 145_500_000,
    txFrequency: 145_500_000,
    primaryMode: 'm17',
    modeProfiles: [profile],
  };
  const channel: AssembledChannel = { entity, wireName: 'Echo' };
  return {
    buildId: 'b',
    formatId: 'radiofoundry',
    profileId: 'radiofoundry-dm32uv',
    buildName: 'DM-32',
    channels: [channel],
    zones: [],
    scanLists: [],
    talkGroups: [],
    digitalContacts: [],
    analogContacts: [],
    rxGroupLists: [],
    ownDigitalIds: [
      { ...newOwnDigitalId('p', 'dmr', 'MM9PDY', 2_351_234), isDefault: true },
      { ...newOwnDigitalId('p', 'm17', 'AB1CD', 'AB1CD'), isDefault: true },
    ],
  };
}

function writtenSettings(pipe: ScriptedPipe): boolean {
  return pipe.writes.some((frame) => {
    const decoded = decodeDebugFrame(frame);
    if (decoded.payload[0] !== OP_BLOCK) return false;
    const addr =
      decoded.payload[1]! |
      (decoded.payload[2]! << 8) |
      (decoded.payload[3]! << 16) |
      (decoded.payload[4]! << 24);
    return addr === SETTINGS_BLOCK;
  });
}

describe('RadioFoundry M17 cable write session', () => {
  it('parks on Connect and writes the same settings sector as the protocol', async () => {
    const source: RadioFoundryWriteSource = radioFoundryWriteSourceFromAssembled(m17Assembled());
    expect(source.settings?.ownsChannelTable).toBe(true);
    expect(source.settings?.channelTags.size).toBeGreaterThan(0);

    const unitPipe = new ScriptedPipe(0xff);
    const unit = new RadioFoundryCableProtocol(DM32UV_RADIOFOUNDRY_CABLE_BOARD);
    await unit.connect(unitPipe);
    unit.armWriteSource(source);
    await unit.download({ progressStage: 'Pre-write read' });
    const overlay = unit.overlayWriteImage();
    await unit.upload(memoryMapFromBytes(Uint8Array.of(0)), {});
    expect(writtenSettings(unitPipe)).toBe(true);

    const pipe = new ScriptedPipe(0xff);
    pipe.versionText = 'proto=1\nboard=DM-32UV\nfeatures=M17_PACKET\n';
    const proto = new RadioFoundryCableProtocol(DM32UV_RADIOFOUNDRY_CABLE_BOARD);
    await proto.connect(pipe);
    const session = createRadioSession({
      descriptor: DM32_RADIOFOUNDRY_DESCRIPTOR,
      pipe,
      radio: proto,
    });
    const preflight = await radioFoundryWritePreflight(session, { includesM17: true });
    expect(preflight.refusal).toBeUndefined();
    expect(preflight.rows.find((row) => row.label === 'M17')?.value).toBe('not in this build');
    expect(
      preflight.findings?.flatMap((finding) =>
        finding.kind === 'general' ? [finding.message] : [],
      ),
    ).toContain(RADIOFOUNDRY_M17_PARKED_NOTE);

    const { egress } = newRadioBuildForProfile('p1', 'radio-io-dm32uv-radiofoundry');
    await uploadPreparedRadioWrite(session, egress, undefined, {
      channels: [],
      organisation: {},
      radioFoundryWrite: {
        bytes: source.bytes,
        owned: source.owned,
        ...(source.settings ? { settings: source.settings } : {}),
        ...(source.area2 ? { area2: source.area2, area2Owned: source.area2Owned } : {}),
      },
    });
    expect(writtenSettings(pipe)).toBe(true);
    expect([...pipe.block(SETTINGS_BLOCK)]).toEqual([...unitPipe.block(SETTINGS_BLOCK)]);
    expect([...pipe.block(SETTINGS_BLOCK)]).toEqual([
      ...overlay.bytes.subarray(SETTINGS_BLOCK, SETTINGS_BLOCK + 0x1000),
    ]);
  }, 60_000);
});
