/**
 * Verify user-supplied stock firmware (a vendor zip, the files extracted from it, or a mix) against a radio's
 * pinned descriptor. Pure: works on member roles, file names from the descriptor, sizes and SHA-256s only.
 */
import { unzipSync } from 'fflate';

import { FirmwareError } from '../errors.ts';
import { sha256Hex } from '../hash.ts';
import { stockVariants } from '../stockVariants.ts';
import type {
  FirmwarePackage,
  KnownPatchedResult,
  NamedBytes,
  StockFirmwareDescriptor,
  StockFirmwareMember,
} from '../types.ts';

export interface VerifiedStockFirmware {
  readonly descriptor: StockFirmwareDescriptor;
  /** Copies, keyed by role. */
  readonly package: FirmwarePackage;
  /** By role. */
  readonly sha256: Readonly<Record<string, string>>;
  readonly via: 'zip' | 'files';
  /** Zip hash differed from the pinned one, but every member matched (re-zipped download). */
  readonly zipMismatchNoted: boolean;
  /**
   * The further stock versions supplied at the same time, for a radio that takes one per stock base
   * (`StockFirmwareDescriptor.severalStocks`). Each is verified on its own; a patch is built on the one its `base`
   * names ({@link verifiedStockForBase}).
   */
  readonly others?: readonly VerifiedStockFirmware[];
}

/**
 * The verified stock a patch on `base` is built from: the supplied stock, or one of its `others`, whose descriptor
 * names that base. Undefined when none was supplied.
 */
export function verifiedStockForBase(
  stock: VerifiedStockFirmware,
  base: string,
): VerifiedStockFirmware | undefined {
  return [stock, ...(stock.others ?? [])].find((s) => s.descriptor.baseName === base);
}

export interface ResolveStockContext {
  /** Every other radio's descriptor, for 'stock-wrong-radio'. */
  readonly otherDescriptors: readonly StockFirmwareDescriptor[];
  /** Known patched results (later: from the release catalog), for 'stock-is-patched'. */
  readonly knownPatchedResults?: readonly KnownPatchedResult[];
}

const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04] as const;

function isZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && ZIP_MAGIC.every((b, i) => bytes[i] === b);
}

/** Last path segment, accepting both `/` and `\` separators. */
export function firmwareBasename(name: string): string {
  const parts = name.replace(/\\/g, '/').split('/');
  return parts[parts.length - 1] ?? '';
}

interface Candidate {
  readonly bytes: Uint8Array;
  readonly fromZip: boolean;
}

interface ZipScan {
  readonly sha256: string;
  /** Inflated entries (only names in the filter set), by basename; one array item per entry. */
  readonly entries: ReadonlyMap<string, readonly Uint8Array[]>;
}

function wrongRadioError(
  descriptor: StockFirmwareDescriptor,
  other: StockFirmwareDescriptor,
): FirmwareError {
  return new FirmwareError(
    'stock-wrong-radio',
    `This is ${other.label} firmware, but you picked the ${descriptor.label}.`,
  );
}

async function scanZip(bytes: Uint8Array, wanted: ReadonlySet<string>): Promise<ZipScan> {
  const sha256 = await sha256Hex(bytes);
  const entries = new Map<string, Uint8Array[]>();
  let unzipped: Record<string, Uint8Array>;
  try {
    // Only member entries are inflated: large unrelated content (icon packs, manuals) is never decompressed.
    unzipped = unzipSync(bytes, { filter: (f) => wanted.has(firmwareBasename(f.name)) });
  } catch {
    throw new FirmwareError(
      'stock-corrupt-zip',
      'This zip file is damaged or incomplete. Download it again from the vendor.',
    );
  }
  for (const [path, data] of Object.entries(unzipped)) {
    const base = firmwareBasename(path);
    if (!base) continue;
    const list = entries.get(base) ?? [];
    list.push(data);
    entries.set(base, list);
  }
  return { sha256, entries };
}

/** Pure. Every source, present and future, goes through this one verifier. */
export async function resolveStockFirmware(
  radioDescriptor: StockFirmwareDescriptor,
  inputs: readonly NamedBytes[],
  context: ResolveStockContext,
): Promise<VerifiedStockFirmware> {
  const variants = stockVariants(radioDescriptor);
  const others = context.otherDescriptors.filter((d) => d.radioId !== radioDescriptor.radioId);
  const ownNames = new Set(variants.flatMap((v) => v.members.map((m) => m.fileName)));
  const otherNames = new Map<string, StockFirmwareDescriptor>();
  for (const o of others) {
    for (const v of stockVariants(o)) for (const m of v.members) otherNames.set(m.fileName, o);
  }
  const wanted = new Set<string>([...ownNames, ...otherNames.keys()]);

  const candidates = new Map<string, Candidate[]>();
  const addCandidate = (name: string, c: Candidate) => {
    const list = candidates.get(name) ?? [];
    list.push(c);
    candidates.set(name, list);
  };
  const zipHashes: string[] = [];
  const looseHashes: string[] = [];

  for (const input of inputs) {
    if (isZip(input.bytes)) {
      const scan = await scanZip(input.bytes, wanted);
      zipHashes.push(scan.sha256);
      for (const [name, list] of scan.entries) {
        for (const bytes of list) addCandidate(name, { bytes, fromZip: true });
      }
    } else {
      const name = firmwareBasename(input.name);
      if (wanted.has(name)) addCandidate(name, { bytes: input.bytes, fromZip: false });
      else looseHashes.push(await sha256Hex(input.bytes));
    }
  }

  // Nothing of this radio's: diagnose another radio's stock before calling it missing.
  const anyOwn = [...ownNames].some((n) => candidates.has(n));
  if (!anyOwn) {
    for (const name of candidates.keys()) {
      const other = otherNames.get(name);
      if (other) throw wrongRadioError(radioDescriptor, other);
    }
    for (const o of others) {
      const memberHashes = new Set(stockVariants(o).flatMap((v) => v.members.map((m) => m.sha256)));
      if (
        zipProvesOther(radioDescriptor, o, zipHashes) ||
        looseHashes.some((h) => memberHashes.has(h))
      ) {
        throw wrongRadioError(radioDescriptor, o);
      }
    }
  }

  // The files supplied pick the stock version; a radio's variants never share a file name.
  const present = variants.filter((v) => v.members.some((m) => candidates.has(m.fileName)));
  if (present.length > 1 && !radioDescriptor.severalStocks) {
    throw new FirmwareError(
      'stock-duplicate-member',
      `Files for more than one ${radioDescriptor.label} stock version were supplied. Supply exactly one.`,
    );
  }
  // A radio that takes several stocks gets each supplied version verified on its own; the first is the primary.
  const [first, ...rest] = present.length > 0 ? present : [variants[0]!];
  const primary = await verifyStockVariant(first!, candidates, zipHashes, others, context);
  if (rest.length === 0) return primary;
  const more: VerifiedStockFirmware[] = [];
  for (const v of rest)
    more.push(await verifyStockVariant(v, candidates, zipHashes, others, context));
  return { ...primary, others: more };
}

/** Verify one stock version's members from the candidates supplied. */
async function verifyStockVariant(
  descriptor: StockFirmwareDescriptor,
  candidates: ReadonlyMap<string, readonly Candidate[]>,
  zipHashes: readonly string[],
  others: readonly StockFirmwareDescriptor[],
  context: ResolveStockContext,
): Promise<VerifiedStockFirmware> {
  const files: Record<string, Uint8Array> = {};
  const sha256: Record<string, string> = {};
  let usedZip = false;

  for (const member of descriptor.members) {
    const list = candidates.get(member.fileName) ?? [];
    const fromZip = list.filter((c) => c.fromZip);
    const loose = list.filter((c) => !c.fromZip);
    // A zip's member wins over a loose copy of the same file.
    const pool = fromZip.length > 0 ? fromZip : loose;
    if (pool.length === 0) {
      throw new FirmwareError(
        'stock-missing-member',
        descriptor.zip
          ? `${member.fileName} is missing. Supply the ${descriptor.label} ${descriptor.version} zip, or every file extracted from it.`
          : `${member.fileName} is missing. Supply the ${descriptor.label} ${descriptor.version} stock file.`,
      );
    }
    if (pool.length > 1) {
      throw new FirmwareError(
        'stock-duplicate-member',
        `${member.fileName} was supplied more than once. Supply exactly one copy.`,
      );
    }
    const chosen = pool[0]!;
    usedZip ||= chosen.fromZip;
    const hash = await sha256Hex(chosen.bytes);
    if (chosen.bytes.length !== member.size || hash !== member.sha256) {
      throw diagnoseMismatch(
        descriptor,
        member,
        hash,
        zipHashes,
        others,
        context.knownPatchedResults ?? [],
      );
    }
    files[member.role] = chosen.bytes.slice();
    sha256[member.role] = hash;
  }

  return {
    descriptor,
    package: { radioId: descriptor.radioId, files },
    sha256,
    via: usedZip ? 'zip' : 'files',
    zipMismatchNoted:
      usedZip &&
      descriptor.zip !== undefined &&
      zipHashes.some((h) => h !== descriptor.zip!.sha256),
  };
}

/**
 * A supplied zip proves "another radio" only when that radio's zip is not also this radio's zip: the RT95 head and
 * main board ship in one vendor zip, so that zip says nothing about which of the two the user meant.
 */
function zipProvesOther(
  descriptor: StockFirmwareDescriptor,
  other: StockFirmwareDescriptor,
  zipHashes: readonly string[],
): boolean {
  if (other.zip === undefined || !zipHashes.includes(other.zip.sha256)) return false;
  return other.zip.sha256 !== descriptor.zip?.sha256;
}

function diagnoseMismatch(
  descriptor: StockFirmwareDescriptor,
  member: StockFirmwareMember,
  hash: string,
  zipHashes: readonly string[],
  others: readonly StockFirmwareDescriptor[],
  knownPatched: readonly KnownPatchedResult[],
): FirmwareError {
  const patched = knownPatched.find(
    (k) => k.radioId === descriptor.radioId && k.sha256[member.role] === hash,
  );
  if (patched) {
    return new FirmwareError(
      'stock-is-patched',
      `This is already-patched firmware (${patched.label}). Supply the vendor download instead.`,
    );
  }
  for (const o of others) {
    if (
      stockVariants(o).some((v) => v.members.some((m) => m.sha256 === hash)) ||
      zipProvesOther(descriptor, o, zipHashes)
    ) {
      return wrongRadioError(descriptor, o);
    }
  }
  return new FirmwareError(
    'stock-wrong-version',
    zipHashes.length > 0
      ? `This zip is not stock ${descriptor.version} for the ${descriptor.label}.`
      : `${member.fileName} is not stock ${descriptor.version} for the ${descriptor.label}.`,
  );
}
