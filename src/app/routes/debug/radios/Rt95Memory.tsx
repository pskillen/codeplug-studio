import { decodeChannelRecord } from '@integrations/radio-io/radios/rt95/channelCodec.ts';
import { Alert, Stack, Text, Title } from '@mantine/core';
import { RT95_MMD1_REGION_ID } from '@integrations/radio-io/radios/rt95/debugCapture.ts';
import {
  MMD1_BASE,
  MMD1_END,
  MMD1_STATE_ADDR,
} from '@integrations/radio-io/radios/rt95/modData/layout.ts';
import {
  decodeRt95ModData,
  decodeRt95ZoneState,
} from '@integrations/radio-io/radios/rt95/modData/decode.ts';
import {
  RT95_OCCUPIED_BITFIELD_OFFSET,
  RT95_CHANNEL_RECORD_SIZE,
} from '@integrations/radio-io/radios/rt95/constants.ts';
import {
  RT95_KEY_TABLE_ADDR,
  RT95_KEY_TABLE_LENGTH,
  RT95_KEY_FUNCTION_DIR,
} from '@integrations/radio-io/radios/rt95/zoneKey.ts';
import { rt95GuardEvidence, type DebugArchive } from './captureArchive.ts';

export function Rt95Memory({ archive }: { archive: DebugArchive }) {
  const bytes = archive.regions[RT95_MMD1_REGION_ID];
  const guard = rt95GuardEvidence(archive);
  const cloneRegion = archive.manifest.regions.find((r) => r.id === 'programming-image');
  const clone = archive.regions['programming-image'];
  const at = (address: number, length: number) => {
    if (
      !clone ||
      !cloneRegion ||
      address < cloneRegion.address ||
      address + length > cloneRegion.address + clone.length
    )
      return undefined;
    return clone.subarray(address - cloneRegion.address, address - cloneRegion.address + length);
  };
  const readBlock = (address: number) =>
    bytes && address >= MMD1_BASE && address + 16 <= MMD1_BASE + bytes.length
      ? bytes.subarray(address - MMD1_BASE, address - MMD1_BASE + 16)
      : undefined;
  const decoded = bytes ? decodeRt95ModData(readBlock) : undefined;
  const header = readBlock(MMD1_BASE);
  const member = (index: number) => {
    const slot = index + 1;
    const bit = at(RT95_OCCUPIED_BITFIELD_OFFSET + Math.floor(index / 8), 1);
    if (!bit) return `Slot ${slot}: clone occupancy unavailable [unknown]`;
    if (!(bit[0]! & (1 << (index % 8)))) return `Slot ${slot}: empty [unknown]`;
    const record = at(index * RT95_CHANNEL_RECORD_SIZE, RT95_CHANNEL_RECORD_SIZE);
    if (!record) return `Slot ${slot}: clone record unavailable [unknown]`;
    try {
      const channel = decodeChannelRecord(record, slot);
      return `Slot ${slot}: ${channel.empty ? 'unreadable record' : channel.wireName || '(unnamed)'} [unknown]`;
    } catch {
      return `Slot ${slot}: unreadable record [unknown]`;
    }
  };
  const keys = at(RT95_KEY_TABLE_ADDR, RT95_KEY_TABLE_LENGTH);
  const state =
    decoded?.status === 'valid'
      ? decodeRt95ZoneState(readBlock(MMD1_STATE_ADDR), decoded)
      : undefined;
  return (
    <Stack>
      <Title order={4}>MMD1 zones [body]</Title>
      <Text>
        Body EEPROM is reached through the head; it can return checksum-valid zeros without a body
        reply. Running firmware, release and modification status remain unknown.
      </Text>
      {!guard ? (
        <Alert>Guard evidence unverified [body].</Alert>
      ) : !guard.ok ? (
        <Alert>Guard refused MMD1 capture: {guard.reason} [body].</Alert>
      ) : (
        <Text>Chip guard verified from recorded probe blocks [body].</Text>
      )}
      {!bytes ? (
        <Text>MMD1 not captured [body].</Text>
      ) : (
        <>
          {header && (
            <Text>
              Header [body] · magic{' '}
              {Array.from(header.subarray(0, 4), (v) =>
                v >= 32 && v <= 126 ? String.fromCharCode(v) : '.',
              ).join('')}{' '}
              · version {header[4]} · zone count {header[5]} · flags 0x
              {header[6]!.toString(16).padStart(2, '0')} · zone generation{' '}
              {header[8]! | (header[9]! << 8)} · description generation{' '}
              {header[10]! | (header[11]! << 8)}
            </Text>
          )}
          {decoded?.status !== 'valid' ? (
            <Alert>
              Header {decoded?.status === 'absent' ? 'blank or absent' : 'invalid'}:{' '}
              {decoded?.reason} [body].
            </Alert>
          ) : (
            <>
              <Text>
                Header valid [body].{' '}
                {guard?.ok &&
                bytes.length === MMD1_END - MMD1_BASE &&
                decoded.zones.every((zone) => zone.valid)
                  ? 'MM9PDY-compatible data present.'
                  : ''}
              </Text>
              {decoded.zones.map((zone) => (
                <div key={zone.index}>
                  <Text fw={600}>
                    Zone {zone.index + 1}: {zone.name || '(unnamed)'} [body] ·{' '}
                    {zone.valid ? 'members valid' : 'invalid member CRC'}
                  </Text>
                  {zone.valid &&
                    (zone.memberIndexes.length ? (
                      zone.memberIndexes.map((index) => (
                        <Text key={index}>Member [body] · {member(index)}</Text>
                      ))
                    ) : (
                      <Text>No members [body].</Text>
                    ))}
                </div>
              ))}
              {state?.valid ? (
                <>
                  <Text>ZST1 selection A [body]: {state.sideA}</Text>
                  <Text>ZST1 selection B [body]: {state.sideB}</Text>
                </>
              ) : (
                <Text>ZST1 state [body]: invalid or unavailable ({state?.reason})</Text>
              )}
            </>
          )}
        </>
      )}
      <Title order={4}>P-keys [unknown]</Title>
      {keys ? (
        Array.from(keys, (value, i) => (
          <Text key={i}>
            Group {Math.floor(i / 6) + 1} key {(i % 6) + 1} [unknown]: 0x
            {value.toString(16).padStart(2, '0')}{' '}
            {value === RT95_KEY_FUNCTION_DIR ? '· DIR; used as ZON by compatible firmware.' : ''}
          </Text>
        ))
      ) : (
        <Text>P-key bytes unavailable [unknown].</Text>
      )}
    </Stack>
  );
}
