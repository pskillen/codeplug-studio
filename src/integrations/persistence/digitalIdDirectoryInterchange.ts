import { csvToTable } from '@core/import-export/csvParse.ts';
import { formatCsv } from '@core/import-export/formats/opengd77/csvWrite.ts';
import type { DigitalIdDirectoryEntry } from '@core/models/digitalIdDirectory.ts';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

export const DIRECTORY_INTERCHANGE_SCHEMA_VERSION = 1;

export type DirectoryInterchangeFormat = 'yaml' | 'csv';

export const DIRECTORY_CSV_HEADERS = [
  'digitalId',
  'mode',
  'callsign',
  'name',
  'city',
  'state',
  'country',
  'remarks',
  'fetchedAt',
] as const;

type DirectoryInterchangeRow = Omit<DigitalIdDirectoryEntry, 'projectId'>;

export interface DirectoryInterchangeDocument {
  schemaVersion: number;
  entries: DirectoryInterchangeRow[];
}

function sanitisedProjectBase(projectName: string): string {
  const base = projectName.trim() || 'project';
  return (
    base
      .replace(/[^\w\s.-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'project'
  );
}

export function defaultDirectoryExportFileName(
  projectName: string,
  format: DirectoryInterchangeFormat,
): string {
  const ext = format === 'yaml' ? 'yaml' : 'csv';
  return `${sanitisedProjectBase(projectName)}-digital-id-directory.${ext}`;
}

export function defaultProjectWithDirectoryZipFileName(projectName: string): string {
  return `${sanitisedProjectBase(projectName)}-with-directory.zip`;
}

function stripProjectId(entry: DigitalIdDirectoryEntry): DirectoryInterchangeRow {
  return {
    digitalId: entry.digitalId,
    mode: entry.mode,
    name: entry.name,
    callsign: entry.callsign,
    city: entry.city,
    state: entry.state,
    country: entry.country,
    ...(entry.remarks !== undefined ? { remarks: entry.remarks } : {}),
    ...(entry.fetchedAt !== undefined ? { fetchedAt: entry.fetchedAt } : {}),
  };
}

function attachProjectId(projectId: string, row: DirectoryInterchangeRow): DigitalIdDirectoryEntry {
  return { ...row, projectId };
}

export function serialiseDirectoryInterchangeYaml(
  entries: readonly DigitalIdDirectoryEntry[],
): string {
  const document: DirectoryInterchangeDocument = {
    schemaVersion: DIRECTORY_INTERCHANGE_SCHEMA_VERSION,
    entries: entries.map(stripProjectId),
  };
  return `${stringifyYaml(document, { lineWidth: 0 }).trimEnd()}\n`;
}

export function parseDirectoryInterchangeYaml(
  text: string,
  projectId: string,
): DigitalIdDirectoryEntry[] {
  const parsed = parseYaml(text.replace(/^\uFEFF/, '')) as unknown;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Directory YAML must be a mapping with entries');
  }
  const record = parsed as Partial<DirectoryInterchangeDocument>;
  if (record.schemaVersion !== DIRECTORY_INTERCHANGE_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported directory YAML schemaVersion: ${String(record.schemaVersion)} (expected ${DIRECTORY_INTERCHANGE_SCHEMA_VERSION})`,
    );
  }
  if (!Array.isArray(record.entries)) {
    throw new Error('Directory YAML must include an entries list');
  }
  return record.entries.map((row, index) => {
    if (!row || typeof row !== 'object') {
      throw new Error(`Directory YAML entry ${index + 1} is not an object`);
    }
    const entry = row as DirectoryInterchangeRow;
    if (typeof entry.digitalId !== 'number' || !Number.isFinite(entry.digitalId)) {
      throw new Error(`Directory YAML entry ${index + 1} is missing a numeric digitalId`);
    }
    return attachProjectId(projectId, {
      mode: entry.mode ?? 'dmr',
      digitalId: entry.digitalId,
      name: entry.name ?? '',
      callsign: entry.callsign ?? '',
      city: entry.city ?? '',
      state: entry.state ?? '',
      country: entry.country ?? '',
      ...(entry.remarks !== undefined ? { remarks: entry.remarks } : {}),
      ...(entry.fetchedAt !== undefined ? { fetchedAt: entry.fetchedAt } : {}),
    });
  });
}

function directoryRowToCsv(entry: DirectoryInterchangeRow): string[] {
  return [
    String(entry.digitalId),
    entry.mode,
    entry.callsign,
    entry.name,
    entry.city,
    entry.state,
    entry.country,
    entry.remarks ?? '',
    entry.fetchedAt ?? '',
  ];
}

export function serialiseDirectoryInterchangeCsv(
  entries: readonly DigitalIdDirectoryEntry[],
): string {
  const rows = entries.map((entry) => directoryRowToCsv(stripProjectId(entry)));
  return formatCsv([...DIRECTORY_CSV_HEADERS], rows);
}

function columnIndex(headers: string[], name: string): number {
  const index = headers.findIndex((header) => header.trim().toLowerCase() === name.toLowerCase());
  if (index < 0) {
    throw new Error(`Directory CSV is missing required column: ${name}`);
  }
  return index;
}

export function parseDirectoryInterchangeCsv(
  text: string,
  projectId: string,
): DigitalIdDirectoryEntry[] {
  const { headers, rows } = csvToTable(text);
  if (headers.length === 0) {
    return [];
  }
  const digitalIdIndex = columnIndex(headers, 'digitalId');
  const modeIndex = columnIndex(headers, 'mode');
  const callsignIndex = columnIndex(headers, 'callsign');
  const nameIndex = columnIndex(headers, 'name');
  const cityIndex = columnIndex(headers, 'city');
  const stateIndex = columnIndex(headers, 'state');
  const countryIndex = columnIndex(headers, 'country');
  const remarksIndex = headers.findIndex((header) => header.trim().toLowerCase() === 'remarks');
  const fetchedAtIndex = headers.findIndex((header) => header.trim().toLowerCase() === 'fetchedat');

  return rows.map((row, index) => {
    const digitalIdRaw = row[digitalIdIndex]?.trim() ?? '';
    const digitalId = Number.parseInt(digitalIdRaw, 10);
    if (!Number.isFinite(digitalId)) {
      throw new Error(`Directory CSV row ${index + 2} has invalid digitalId: ${digitalIdRaw}`);
    }
    const mode = row[modeIndex]?.trim() || 'dmr';
    if (mode !== 'dmr') {
      throw new Error(`Directory CSV row ${index + 2} has unsupported mode: ${mode}`);
    }
    const remarks = remarksIndex >= 0 ? row[remarksIndex]?.trim() : '';
    const fetchedAt = fetchedAtIndex >= 0 ? row[fetchedAtIndex]?.trim() : '';
    return attachProjectId(projectId, {
      digitalId,
      mode: 'dmr',
      callsign: row[callsignIndex]?.trim() ?? '',
      name: row[nameIndex]?.trim() ?? '',
      city: row[cityIndex]?.trim() ?? '',
      state: row[stateIndex]?.trim() ?? '',
      country: row[countryIndex]?.trim() ?? '',
      ...(remarks ? { remarks } : {}),
      ...(fetchedAt ? { fetchedAt } : {}),
    });
  });
}

export function parseDirectoryInterchangeFile(
  text: string,
  projectId: string,
  format: DirectoryInterchangeFormat,
): DigitalIdDirectoryEntry[] {
  return format === 'yaml'
    ? parseDirectoryInterchangeYaml(text, projectId)
    : parseDirectoryInterchangeCsv(text, projectId);
}

export function serialiseDirectoryInterchangeFile(
  entries: readonly DigitalIdDirectoryEntry[],
  format: DirectoryInterchangeFormat,
): string {
  return format === 'yaml'
    ? serialiseDirectoryInterchangeYaml(entries)
    : serialiseDirectoryInterchangeCsv(entries);
}
