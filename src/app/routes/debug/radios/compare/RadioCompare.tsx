import { diffDecoded } from '@integrations/radio-io/debugCompare/index.ts';
import { Alert, Select, Stack, Text, Title } from '@mantine/core';
import { useMemo, useState } from 'react';
import { scrollToPageSection } from '@app/lib/scrollToPageSection.ts';
import type { DebugArchive } from '../captureArchive.ts';
import type { RadioDebugDescriptor } from '../descriptors.ts';
import { SensitiveRevealButton } from '../SensitiveReveal.tsx';
import { archiveKey, sensitiveRanges } from '../viewerUtils.ts';
import { CompareSummary } from './CompareSummary.tsx';
import { ALL_CATEGORIES, DecodedDiffView } from './DecodedDiffView.tsx';
import { HexDiff } from './HexDiff.tsx';

const HEX_SECTION_ID = 'compare-hex-diff';
const DECODED_SECTION_ID = 'compare-decoded-diff';

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
  const [category, setCategory] = useState(ALL_CATEGORIES);
  const [onlyChanges, setOnlyChanges] = useState(true);
  const pairKey = a && b ? `${archiveKey(a)}:${archiveKey(b)}` : '';
  const revealed = revealedFor === pairKey;

  const comparison = useMemo(
    () => (a && b && descriptor.compare ? descriptor.compare.sections(a, b) : undefined),
    [a, b, descriptor],
  );
  // Re-run with the values when Show password is on; counts and kinds do not depend on it.
  const decoded = useMemo(() => {
    const adapter = descriptor.compare;
    // A descriptor with its own DecodedDiff (D890, OpenGD77) keeps it until it is removed there.
    if (!a || !b || !adapter?.decoded || descriptor.DecodedDiff) return undefined;
    return diffDecoded(adapter.decoded(a), adapter.decoded(b), { revealSensitive: revealed });
  }, [a, b, descriptor, revealed]);
  if (!a || !b) return <Text>Choose two different reads to compare.</Text>;
  const jumpCategory = (id: string) => {
    setCategory(id);
    setOnlyChanges(true);
    setTimeout(() => scrollToPageSection(DECODED_SECTION_ID), 0);
  };
  const decodedView = decoded && (
    <div id={DECODED_SECTION_ID}>
      <DecodedDiffView
        diff={decoded}
        category={decoded.domains.some((d) => d.id === category) ? category : ALL_CATEGORIES}
        onCategoryChange={setCategory}
        onlyChanges={onlyChanges}
        onOnlyChangesChange={setOnlyChanges}
        revealed={revealed}
        onToggleReveal={() => setRevealedFor(revealed ? undefined : pairKey)}
      />
    </div>
  );
  if (!comparison)
    return <Alert title="Compare unavailable">This radio has no byte compare yet.</Alert>;
  if (comparison.error)
    return (
      <Stack>
        <Alert color="red" title="Cannot compare">
          {comparison.error}
        </Alert>
        {/* Decoded changes do not depend on the byte compare (the D890 shows them without its sidecar). */}
        {decodedView}
        {!decoded && descriptor.DecodedDiff && <descriptor.DecodedDiff first={a} second={b} />}
      </Stack>
    );

  const shown = comparison.sections.filter((s) => s.a && s.b && s.kind !== 'incomparable');
  const section =
    shown.find((s) => s.id === selected) ?? shown.find((s) => s.changed > 0) ?? shown[0];
  const rangesA = section ? sensitiveRanges(a, section.regionId ?? section.id) : [];
  const rangesB = section ? sensitiveRanges(b, section.regionId ?? section.id) : [];
  const onlyChanged = section ? (filter[section.id] ?? section.changed > 0) : false;
  const Decoded = decoded ? undefined : descriptor.DecodedDiff;

  const jump = (id: string) => {
    setSelected(id);
    setFilter((prev) => ({ ...prev, [id]: true }));
    setTimeout(() => scrollToPageSection(HEX_SECTION_ID), 0);
  };

  return (
    <Stack>
      <CompareSummary
        comparison={comparison}
        onJump={jump}
        decoded={decoded}
        onJumpCategory={jumpCategory}
      />
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
      {decodedView}
      {Decoded && <Decoded first={a} second={b} />}
    </Stack>
  );
}
