import { summariseRadioFoundryBuild } from '@core/radios/radiofoundry/firmware.ts';
import type { DebugIdentityInput, DebugIdentityRows } from '../../debugView/index.ts';
import {
  RADIOFOUNDRY_DEBUG_IDDB_SIDECAR,
  RADIOFOUNDRY_DEBUG_INFO_SIDECAR,
  RADIOFOUNDRY_DEBUG_VERSION_SIDECAR,
} from './debugCapture.ts';
import { radioFoundryCableBoardForModelId } from './board.ts';
import { parseRadioFoundryVersionText } from './version.ts';

/** Caption under the RadioFoundry identity grid. */
export const RADIOFOUNDRY_IDENTITY_NOTE =
  "Values are the radio's INFO, VERSION and IDDB replies, as reported. Source and repository are what the build says of itself; this read does not hash the image. No serial is reported.";

const hex = (n: number) => `0x${n.toString(16)}`;

function readU32(info: Uint8Array, offset: number): number {
  return (
    (info[offset]! |
      (info[offset + 1]! << 8) |
      (info[offset + 2]! << 16) |
      (info[offset + 3]! << 24)) >>>
    0
  );
}

function joinDefined(parts: (string | undefined)[]): string {
  return parts.filter(Boolean).join(' · ');
}

function formatIddb(body: Uint8Array): string {
  if (body.length < 5) return 'Not reported';
  const formatByte = body[0]!;
  const format = formatByte === 0 ? 'none' : String.fromCharCode(formatByte);
  const records = (body[1]! | (body[2]! << 8) | (body[3]! << 16) | (body[4]! << 24)) >>> 0;
  return `format ${format} · ${records} records`;
}

function firmwareReadLabel(archive: DebugIdentityInput['archive']): string {
  if (!archive) return 'Not read yet';
  const info = archive.sidecars[RADIOFOUNDRY_DEBUG_INFO_SIDECAR];
  const versionText = archive.sidecars[RADIOFOUNDRY_DEBUG_VERSION_SIDECAR];
  if (info && !versionText) return 'INFO answered, VERSION not reported';
  if (!versionText) {
    return archive.manifest.firmware ?? 'Not read yet';
  }
  try {
    const text = new TextDecoder().decode(versionText);
    return summariseRadioFoundryBuild(parseRadioFoundryVersionText(text)).label;
  } catch {
    return archive.manifest.firmware ?? 'Not read yet';
  }
}

/** Overview rows from INFO, VERSION and IDDB sidecars only. */
export function radioFoundryIdentityRows({
  archive,
  connection,
}: DebugIdentityInput): DebugIdentityRows {
  const info = archive?.sidecars[RADIOFOUNDRY_DEBUG_INFO_SIDECAR];
  const versionBytes = archive?.sidecars[RADIOFOUNDRY_DEBUG_VERSION_SIDECAR];
  const iddb = archive?.sidecars[RADIOFOUNDRY_DEBUG_IDDB_SIDECAR];
  const version = versionBytes
    ? parseRadioFoundryVersionText(new TextDecoder().decode(versionBytes))
    : undefined;

  const boardLimit =
    archive != null
      ? radioFoundryCableBoardForModelId(archive.manifest.radioModelId)?.limits.IMAGE_END
      : undefined;

  let protocol = 'Not reported';
  let image = 'Not reported';
  if (info && info.length >= 24) {
    const staged = (info[1]! & 1) !== 0 ? 'yes' : 'no';
    const storage = (info[1]! & 2) !== 0 ? 'yes' : 'no';
    protocol = `version ${info[0]!} · staged writes ${staged} · storage writable ${storage}`;
    const eepromEnd = readU32(info, 8);
    const flashStart = readU32(info, 12);
    const imageEnd = readU32(info, 16);
    const physicalBase = readU32(info, 20);
    const boardEnd = boardLimit ?? imageEnd;
    image = joinDefined([
      `EEPROM end ${hex(eepromEnd)}`,
      `flash start ${hex(flashStart)}`,
      `image end ${hex(imageEnd)} (board ${hex(boardEnd)})`,
      `physical base ${hex(physicalBase)}`,
    ]);
  }

  let features = 'Not reported';
  if (version) {
    const listed = version.features.join(', ');
    const off = version.off.length > 0 ? ` · off: ${version.off.join(', ')}` : '';
    features = listed ? `${listed}${off}` : off ? off.slice(3) : 'Not reported';
  }

  return [
    ['Firmware · read', firmwareReadLabel(archive)],
    ['Board · VERSION', version?.board ?? 'Not reported'],
    [
      'Release · git · VERSION',
      joinDefined([
        version?.release,
        version?.git,
        version?.gitTime != null
          ? new Date(version.gitTime * 1000).toISOString().slice(0, 10)
          : undefined,
      ]) || 'Not reported',
    ],
    ['Source · VERSION', joinDefined([version?.source, version?.repo]) || 'Not reported'],
    ['Features · VERSION', features],
    ['Protocol · INFO', protocol],
    ['Image · INFO', image],
    ['DMR ID database · IDDB', iddb ? formatIddb(iddb) : 'Not reported'],
    ['Serial', 'None reported'],
    ['Connection', connection],
  ];
}
