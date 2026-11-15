import LineChart from '@app/components/LineChart/LineChart.tsx';
import { RT95_CALIBRATION_START } from '@core/radios/retevis/rt95/calibration.ts';
import { RT95_CALIBRATION_REGION_ID } from '@integrations/radio-io/radios/rt95/debugCapture.ts';
import { Alert, Stack, Text, Title } from '@mantine/core';
import { decodeRt95Calibration } from '@core/radios/retevis/rt95/calibration.ts';
import { hexRows, formatAddress } from './viewerUtils.ts';
import type { DebugArchive } from './captureArchive.ts';

export function Rt95Calibration({
  archive,
  overlayArchive,
}: {
  archive?: DebugArchive;
  overlayArchive?: DebugArchive;
}) {
  const { fields, raw } = decodeRt95Calibration(archive?.regions[RT95_CALIBRATION_REGION_ID]);
  const overlayFields = decodeRt95Calibration(
    overlayArchive?.regions[RT95_CALIBRATION_REGION_ID],
  ).fields;
  const hex = (bytes: Uint8Array) =>
    Array.from(bytes, (b) => b.toString(16).toUpperCase().padStart(2, '0')).join(' ');
  return (
    <Stack>
      <Title order={3}>Calibration and production record [body]</Title>
      <Alert title="Not validated on hardware">
        MAIN V1.61 / head V1.41 static trace; applicability to this radio unknown. The head relays
        each block and can answer without a main-board reply, returning stale or zero bytes;
        captured bytes are what the head returned, not proof of EEPROM contents. Stable reads and
        plausible values do not establish calibration health.
      </Alert>
      <Text>
        Little-endian assumed for display, supported by the traced ARM consumer; signedness and
        physical units unresolved. Stored production strings do not establish running firmware or
        modification.
      </Text>
      {fields
        .filter((field) => field.corrections)
        .map((field) => {
          const overlay = overlayFields.find((item) => item.address === field.address);
          const points = (values: readonly (number | undefined)[]) =>
            values.flatMap((y, x) => (y === undefined ? [] : [{ x, y }]));
          const primary = field.availability === 'captured' ? points(field.corrections!) : [];
          const secondary =
            overlay?.availability === 'captured' ? points(overlay.corrections ?? []) : [];
          if (!primary.length && !secondary.length) return null;
          return (
            <LineChart
              key={field.address}
              title={field.label}
              xLabel="Index"
              yLabel="Correction"
              series={[
                ...(primary.length
                  ? [{ id: 'primary', label: 'Selected read', slot: 0, points: primary }]
                  : []),
                ...(secondary.length
                  ? [
                      {
                        id: 'overlay',
                        label: 'Overlay read',
                        slot: 0,
                        dashed: true,
                        points: secondary,
                      },
                    ]
                  : []),
              ]}
            />
          );
        })}
      {fields.map((field) => (
        <div key={`${field.address}-${field.label}`}>
          <Text fw={600}>
            {field.label} [body] · {formatAddress(field.address)} · {field.width} bytes ·{' '}
            {field.order}
          </Text>
          <Text size="sm">
            {field.availability === 'not-captured'
              ? 'Not captured'
              : `Raw: ${hex(field.raw)}${field.availability === 'partial' ? ' · partial' : ''}`}{' '}
            · Decoded:{' '}
            {field.text !== undefined
              ? `Text: ${field.text}`
              : field.value === undefined
                ? field.availability === 'captured'
                  ? 'Not decoded'
                  : 'Not captured'
                : `0x${field.value.toString(16).toUpperCase()}`}{' '}
            {field.referenceIndex === undefined ? '' : `· reference index ${field.referenceIndex}`}{' '}
            · layout {field.layout}, meaning {field.meaning} · {field.source}
          </Text>
          {field.corrections && (
            <Text size="sm">
              [body] Base + entry − reference (unmasked; firmware masks to 16 bits):{' '}
              {field.corrections
                .map((value, index) => `${index}: ${value === undefined ? 'Not captured' : value}`)
                .join(' · ')}
            </Text>
          )}
        </div>
      ))}
      <Title order={4}>Raw captured EEPROM [body]</Title>
      {raw.length ? (
        Array.from({ length: Math.ceil(raw.length / 256) }, (_, page) =>
          hexRows(raw, RT95_CALIBRATION_START, page),
        )
          .flat()
          .map((row) => (
            <Text key={row.address} size="xs" style={{ overflowWrap: 'anywhere' }}>
              [body] {formatAddress(row.address)} · {row.hex}
            </Text>
          ))
      ) : (
        <Text>Not captured</Text>
      )}
    </Stack>
  );
}

export function Rt95CalibrationDiff({
  first,
  second,
}: {
  first: DebugArchive;
  second: DebugArchive;
}) {
  const a = decodeRt95Calibration(first.regions[RT95_CALIBRATION_REGION_ID]).fields;
  const b = decodeRt95Calibration(second.regions[RT95_CALIBRATION_REGION_ID]).fields;
  const changed = a.flatMap((field) => {
    const next = b.find((item) => item.address === field.address);
    if (!next || field.availability !== 'captured' || next.availability !== 'captured') return [];
    if (field.raw.length === next.raw.length && field.raw.every((byte, i) => byte === next.raw[i]))
      return [];
    const hex = (bytes: Uint8Array) =>
      Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(' ');
    return [
      `${field.label} (${formatAddress(field.address)}): ${hex(field.raw)} → ${hex(next.raw)}`,
    ];
  });
  return (
    <Stack>
      <Title order={4}>Calibration field changes</Title>
      {changed.length ? (
        changed.map((text) => <Text key={text}>{text}</Text>)
      ) : (
        <Text>No captured field changes; missing or partial fields are incomparable.</Text>
      )}
    </Stack>
  );
}
