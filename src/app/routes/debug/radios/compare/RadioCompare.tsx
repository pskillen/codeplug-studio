import { Alert, Select, Stack, Text, Title } from '@mantine/core';
import { useMemo, useState } from 'react';
import { scrollToPageSection } from '@app/lib/scrollToPageSection.ts';
import type { DebugArchive } from '../captureArchive.ts';
import type { RadioDebugDescriptor } from '../descriptors.ts';
import { SensitiveRevealButton } from '../SensitiveReveal.tsx';
import { archiveKey, sensitiveRanges } from '../viewerUtils.ts';
import { CompareSummary } from './CompareSummary.tsx';
import { HexDiff } from './HexDiff.tsx';

const HEX_SECTION_ID = 'compare-hex-diff';

/**
 * The Compare tab body for two chosen reads: verdict and region list, the hex diff, then the
 * radio's decoded changes. The A/B picker sits above it, in the page.
 */
export function RadioCompare({
  descriptor,
  a,
  b,
}: {
  descriptor: RadioDebugDescriptor;
  a?: DebugArchive;
  b?: DebugArchive;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  // Only-changed per section: unset means "on when the section differs".
  const [filter, setFilter] = useState<Record<string, boolean>>({});
  const [revealedFor, setRevealedFor] = useState<string>();

  const comparison = useMemo(
    () => (a && b && descriptor.compare ? descriptor.compare.sections(a, b) : undefined),
    [a, b, descriptor],
  );
  if (!a || !b) return <Text>Choose two different reads to compare.</Text>;
  if (!comparison)
    return <Alert title="Compare unavailable">This radio has no byte compare yet.</Alert>;
  if (comparison.error)
    return (
      <Stack>
        <Alert color="red" title="Cannot compare">
          {comparison.error}
        </Alert>
        {/* Decoded changes do not depend on the byte compare (the D890 shows them without its sidecar). */}
        {descriptor.DecodedDiff && <descriptor.DecodedDiff first={a} second={b} />}
      </Stack>
    );

  const shown = comparison.sections.filter((s) => s.a && s.b && s.kind !== 'incomparable');
  const section =
    shown.find((s) => s.id === selected) ?? shown.find((s) => s.changed > 0) ?? shown[0];
  const pairKey = `${archiveKey(a)}:${archiveKey(b)}`;
  const revealed = revealedFor === pairKey;
  const rangesA = section ? sensitiveRanges(a, section.regionId ?? section.id) : [];
  const rangesB = section ? sensitiveRanges(b, section.regionId ?? section.id) : [];
  const onlyChanged = section ? (filter[section.id] ?? section.changed > 0) : false;
  const Decoded = descriptor.DecodedDiff;

  const jump = (id: string) => {
    setSelected(id);
    setFilter((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => scrollToPageSection(HEX_SECTION_ID), 0);
  };

  return (
    <Stack>
      <CompareSummary comparison={comparison} onJump={jump} />
      {section && (
        <Stack gap="xs" id={HEX_SECTION_ID}>
          <Title order={4}>Hex diff</Title>
          <Select
            label="Comparison region"
            value={section.id}
            data={shown.map((s) => ({ value: s.id, label: s.label }))}
            allowDeselect={false}
            onChange={(id) => id && setSelected(id)}
          />
          <Text size="sm">
            {section.label}
            {section.note ? ` [${section.note}]` : ''} · {section.changed.toLocaleString()} changed{' '}
            {section.changed === 1 ? 'byte' : 'bytes'}
          </Text>
          {(rangesA.length > 0 || rangesB.length > 0) && (
            <Stack gap={4} align="flex-start">
              <Text size="sm">
                Password bytes are {revealed ? 'shown' : 'hidden (••)'} in A and B; a hidden byte
                that differs is still marked.
              </Text>
              <SensitiveRevealButton
                revealed={revealed}
                onToggle={() => setRevealedFor(revealed ? undefined : pairKey)}
              />
            </Stack>
          )}
          <HexDiff
            key={section.id}
            section={section}
            rangesA={rangesA}
            rangesB={rangesB}
            revealed={revealed}
            onlyChanged={onlyChanged}
            onOnlyChangedChange={(value) => setFilter((prev) => ({ ...prev, [section.id]: value }))}
          />
        </Stack>
      )}
      {Decoded && <Decoded first={a} second={b} />}
    </Stack>
  );
}
