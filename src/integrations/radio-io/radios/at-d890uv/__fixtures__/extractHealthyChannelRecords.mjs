/**
 * Dev-only: extract channel 0x80 records from a native YAML egress hydration bag.
 *
 * Usage (from repo root):
 *   node src/integrations/radio-io/radios/at-d890uv/__fixtures__/extractHealthyChannelRecords.mjs \
 *     /path/to/MM9PDY-July-2026\(6\).yaml [egressPathId]
 *
 * Writes healthyChannelRecords.ts next to this script. Not run in CI.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseYaml } from 'yaml';

const __dir = dirname(fileURLToPath(import.meta.url));
const CHANNEL_RECORD_SIZE = 0x80;
const CHANNEL_CHUNK_SIZE = 0x40;
const CHANNEL_SET = 0x3482a00;
const CHANNEL_DATA = 0x1000000;
const CHANNEL_DATA_OFFSET = 0x80;
const CHANNEL_DATA_BLOCK_OFFSET = 0x80000;
const CHANNEL_DATA_BLOCK_SIZE = 128;
const CHANNEL_DATA_SECONDARY_OFFSET = 0x40;
const NAME_OFFSET = 0x44;
const NAME_LEN = 0x20;

function channelPrimaryAddress(index) {
  const blockIndex = Math.floor(index / CHANNEL_DATA_BLOCK_SIZE);
  const indexInBlock = index % CHANNEL_DATA_BLOCK_SIZE;
  return CHANNEL_DATA + blockIndex * CHANNEL_DATA_BLOCK_OFFSET + indexInBlock * CHANNEL_DATA_OFFSET;
}

function channelSecondaryAddress(index) {
  return channelPrimaryAddress(index) + CHANNEL_DATA_SECONDARY_OFFSET;
}

function base64ToBytes(b64) {
  return Uint8Array.from(Buffer.from(b64, 'base64'));
}

function bytesToHex(bytes) {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function getCacheBytes(blocks, address, length) {
  const out = new Uint8Array(length);
  let filled = 0;
  const sorted = [...blocks.entries()].sort((a, b) => a[0] - b[0]);
  for (const [blockAddr, data] of sorted) {
    const blockEnd = blockAddr + data.length;
    if (blockEnd <= address) continue;
    if (blockAddr >= address + length) break;
    const startInBlock = Math.max(0, address - blockAddr);
    const startInOut = Math.max(0, blockAddr - address);
    const copyLen = Math.min(data.length - startInBlock, length - startInOut);
    if (copyLen <= 0) continue;
    out.set(data.subarray(startInBlock, startInBlock + copyLen), startInOut);
    filled += copyLen;
  }
  if (filled < length) {
    // unfilled stays 0
  }
  return out;
}

function listSetBits(data) {
  const out = [];
  for (let byteIndex = 0; byteIndex < data.length; byteIndex++) {
    const bits = data[byteIndex];
    for (let bit = 0; bit < 8; bit++) {
      if ((bits & (1 << bit)) !== 0) out.push(byteIndex * 8 + bit);
    }
  }
  return out;
}

function sanitizeNameField(record) {
  const copy = record.slice();
  const slot = copy[0] === 0 && copy[1] === 0 ? 0 : 1;
  const label = `CH${String(slot).padStart(4, '0')}`;
  for (let i = 0; i < NAME_LEN; i++) {
    copy[NAME_OFFSET + i] = 0;
  }
  for (let i = 0; i < label.length; i++) {
    copy[NAME_OFFSET + i * 2] = label.charCodeAt(i);
  }
  return copy;
}

const yamlPath = process.argv[2];
const egressIdFilter = process.argv[3];
if (!yamlPath) {
  console.error('Usage: node extractHealthyChannelRecords.mjs <yaml-path> [egressPathId]');
  process.exit(1);
}

const doc = parseYaml(readFileSync(yamlPath, 'utf8'));
const egressPaths = doc.egressPaths ?? [];
const candidates = egressPaths.filter(
  (e) =>
    e.profileId === 'radio-io-at-d890uv' &&
    e.hydration?.formatId === 'radio-clone' &&
    Array.isArray(e.hydration?.retain?.blocks),
);

if (candidates.length === 0) {
  console.error('No radio-io-at-d890uv sparse hydration bags found');
  process.exit(1);
}

let bag = candidates[0];
if (egressIdFilter) {
  bag = candidates.find((e) => e.id === egressIdFilter);
  if (!bag) {
    console.error('No matching egress path id');
    process.exit(1);
  }
}

console.log(
  `Using egress ${bag.id} capturedAt=${bag.hydration.capturedAt} revision=${bag.revision}`,
);

const blocks = new Map();
for (const b of bag.hydration.retain.blocks) {
  blocks.set(b.address, base64ToBytes(b.dataBase64));
}

const setData = getCacheBytes(blocks, CHANNEL_SET, 0x200);
const occupied = listSetBits(setData);
const records = [];

for (const idx of occupied) {
  if (idx >= 4000) continue;
  const primary = getCacheBytes(blocks, channelPrimaryAddress(idx), CHANNEL_CHUNK_SIZE);
  const secondary = getCacheBytes(blocks, channelSecondaryAddress(idx), CHANNEL_CHUNK_SIZE);
  const combined = new Uint8Array(CHANNEL_RECORD_SIZE);
  combined.set(primary, 0);
  combined.set(secondary, CHANNEL_CHUNK_SIZE);
  const rxHz = parseInt(bytesToHex(combined.subarray(0, 4)), 16) || 0;
  if (rxHz === 0) continue;
  const sanitized = sanitizeNameField(combined);
  records.push({
    slotIndex: idx + 1,
    bytesHex: bytesToHex(sanitized),
    wireContactIdx: (combined[0x13] << 8) | combined[0x14],
    bwWire: (combined[0x08] >> 4) & 0x3,
  });
}

console.log(`Extracted ${records.length} channel records`);

const contactWireValues = records.map((r) => r.wireContactIdx);
const uniqueContacts = [...new Set(contactWireValues)].sort((a, b) => a - b);
console.log('Contact wire values sample:', uniqueContacts.slice(0, 20));
console.log(
  'Min/max contact wire:',
  Math.min(...contactWireValues),
  Math.max(...contactWireValues),
);

const outLines = [
  '/**',
  ' * Healthy AT-D890UV channel 0x80 records extracted from forensic hydration.',
  ' * Name fields (0x44–0x63) sanitized to CH#### wide-char labels before commit.',
  ` * Source: ${yamlPath} egress ${bag.id} capturedAt ${bag.hydration.capturedAt}`,
  ' * Regenerate: node __fixtures__/extractHealthyChannelRecords.mjs <yaml> [egressId]',
  ' */',
  '',
  'export interface HealthyChannelRecordFixture {',
  '  slotIndex: number;',
  '  bytesHex: string;',
  '}',
  '',
  'export const HEALTHY_CHANNEL_RECORDS: readonly HealthyChannelRecordFixture[] = [',
];

for (const r of records) {
  outLines.push(`  { slotIndex: ${r.slotIndex}, bytesHex: '${r.bytesHex}' },`);
}

outLines.push('];', '');

const outPath = join(__dir, 'healthyChannelRecords.ts');
writeFileSync(outPath, outLines.join('\n'));
console.log(`Wrote ${outPath}`);
