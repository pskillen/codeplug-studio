import type { RadioDebugCoverageView } from '../descriptors.ts';
import type { DebugArchive } from '../captureArchive.ts';
import { formatAddress } from '../viewerUtils.ts';
import { Text } from '@mantine/core';
import { AT_D890_VITAL_UNIT_BYTES } from '@integrations/radio-io/radios/at-d890uv/vitalBackup.ts';
import {
  atD890VitalComparison,
  classifyAtD890DebugCoverage,
} from '@integrations/radio-io/radios/at-d890uv/debugCoverage.ts';

/** AT-D890UV Backup coverage: virtual map, expected spans, out-of-map reads and the vital units. */
export function atD890Coverage(archive: DebugArchive): RadioDebugCoverageView {
  const d890 = classifyAtD890DebugCoverage(archive.manifest.regions);
  return {
    regionKind: (id) =>
      d890.vital.some((v) => v.region?.id === id)
        ? 'Vital read · separate provenance'
        : d890.outside.some((r) => r.id === id)
          ? 'Out-of-map sparse read'
          : d890.unclassified.some((r) => r.id === id)
            ? 'Unclassified address space'
            : 'D890 virtual map',
    body: (
      <>
        <Text fw={600}>Virtual map · sparse configuration</Text>
        {d890.map.map((range) => (
          <Text key={range.start}>
            {formatAddress(range.start)}–{formatAddress(range.end - 1)} ·{' '}
            {range.captured ? 'Captured' : 'Not captured'}
          </Text>
        ))}
        <Text fw={600}>Expected configuration spans</Text>
        {d890.spans.map((range, i) => (
          <Text key={`${range.label}-${range.start}-${i}`}>
            {range.label} {formatAddress(range.start)}–{formatAddress(range.end - 1)} ·{' '}
            {range.captured ? 'Captured' : 'Not captured'}
          </Text>
        ))}
        <Text fw={600}>Vital reads · requested separately</Text>
        <Text size="sm">
          {atD890VitalComparison(archive.sidecars['debug/vital.json'])
            ? 'Archive metadata reports two matching reads.'
            : 'Two-read comparison is not established by archive metadata.'}
        </Text>
        {d890.vital.map(({ def, region }) => (
          <Text key={def.id}>
            {def.label} {formatAddress(def.address)}–
            {formatAddress(def.address + AT_D890_VITAL_UNIT_BYTES - 1)} ·{' '}
            {region ? 'Captured' : 'Not captured'}
            {def.asReturned ? ' · as returned; not an independent physical copy' : ''}
          </Text>
        ))}
        <Text size="sm">
          Vital reads may overlap configuration ranges and are reported separately. A successful
          live capture compares two reads; archive metadata records that claim. Firmware can divert
          vital reads; these are the bytes returned, not proof of physical storage.
        </Text>
        <Text size="sm">
          Sparse configuration omits occupancy-skipped records. Out-of-map and unclassified entries
          remain separate above.
        </Text>
      </>
    ),
  };
}
