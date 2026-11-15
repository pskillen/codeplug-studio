import { Rt95Memory } from './Rt95Memory.tsx';
import { RT95_MMD1_REGION_ID } from '@integrations/radio-io/radios/rt95/debugCapture.ts';
import { RT95_MODEL_ID } from '@integrations/radio-io/radios/rt95/constants.ts';
import { RT95_CALIBRATION_REGION_ID } from '@integrations/radio-io/radios/rt95/debugCapture.ts';
import {
  Alert,
  Button,
  Card,
  FileButton,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useState } from 'react';
import { openDebugArchive, rt95ArchiveDetails, type DebugArchive } from './captureArchive.ts';
import {
  compareRegions,
  formatAddress,
  HEX_PAGE_BYTES,
  hexRows,
  regionIdentity,
} from './viewerUtils.ts';

function provenance(archive: DebugArchive | undefined, id: string) {
  return archive?.manifest.radioModelId === RT95_MODEL_ID
    ? id === RT95_CALIBRATION_REGION_ID || id === RT95_MMD1_REGION_ID
      ? ' [body]'
      : ' [unknown]'
    : '';
}

export function HexViewer({ archive }: { archive?: DebugArchive }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [jump, setJump] = useState('');
  const [jumpError, setJumpError] = useState<string>();
  if (!archive)
    return <Alert title="No capture">Open or read a capture to inspect its bytes.</Alert>;
  const wire = selected === '__mini_wire' ? archive.sidecars['debug/wire.bin'] : undefined;
  const region =
    archive.manifest.regions.find((r) => r.id === selected) ?? archive.manifest.regions[0];
  if (!region) return <Alert>No captured regions.</Alert>;
  const bytes = wire ?? archive.regions[region.id]!;
  const pages = Math.max(1, Math.ceil(bytes.length / HEX_PAGE_BYTES));
  const current = Math.min(page, pages - 1);
  const base = wire ? 0 : region.address;
  const goToAddress = () => {
    const text = jump.trim().replace(/^0x/i, '');
    const target = /^[0-9a-f]+$/i.test(text) ? parseInt(text, 16) : NaN;
    const offset = target - base;
    if (!Number.isFinite(offset) || offset < 0 || offset >= bytes.length) {
      setJumpError(
        `Address is outside this region (${formatAddress(base)}–${formatAddress(base + Math.max(0, bytes.length - 1))}).`,
      );
      return;
    }
    setJumpError(undefined);
    setPage(Math.floor(offset / HEX_PAGE_BYTES));
  };
  return (
    <Stack>
      <Title order={3}>Hex &amp; region map</Title>
      <Text size="sm">
        {wire
          ? 'Wire bytes as received'
          : archive.manifest.radioModelId === 'UV-5R Mini' && region.id === 'clone'
            ? 'Decoded clone bytes'
            : (regionIdentity(archive, region.id)?.representation ??
              'Archive bytes; wire or decoded representation is not recorded')}
        .{' '}
        {archive.manifest.radioModelId === 'UV-5R Mini' && region.id.startsWith('mem-') && !wire
          ? 'Addresses shown are packed offsets, not radio addresses. '
          : ''}
        Gaps are never displayed as bytes.
      </Text>
      <Select
        label="Region"
        value={wire ? '__mini_wire' : region.id}
        data={[
          ...archive.manifest.regions.map((r) => ({ value: r.id, label: r.label })),
          ...(archive.sidecars['debug/wire.bin']
            ? [{ value: '__mini_wire', label: 'Wire bytes as received' }]
            : []),
        ]}
        onChange={(id) => {
          setSelected(id);
          setPage(0);
          setJumpError(undefined);
        }}
        allowDeselect={false}
      />
      <Card withBorder>
        <Text fw={600}>
          {wire ? 'Wire bytes as received' : region.label}{' '}
          {archive?.manifest.radioModelId === RT95_MODEL_ID
            ? region.id === RT95_CALIBRATION_REGION_ID || region.id === RT95_MMD1_REGION_ID
              ? '[body]'
              : '[unknown]'
            : ''}{' '}
          · {bytes.length} bytes
        </Text>
        <div style={{ overflowX: 'auto' }}>
          <pre aria-label="Hexadecimal bytes">
            {hexRows(bytes, wire ? 0 : region.address, current)
              .map(
                (row) =>
                  `${formatAddress(row.address)}${provenance(archive, region.id)}  ${row.hex.padEnd(47)}  ${row.ascii}`,
              )
              .join('\n') || 'Empty region'}
          </pre>
        </div>
        <Group>
          <Button variant="default" disabled={current === 0} onClick={() => setPage(current - 1)}>
            Previous
          </Button>
          <Text>
            Page {current + 1} of {pages}
          </Text>
          <TextInput
            aria-label="Go to address"
            placeholder="Address, e.g. 0xF000"
            value={jump}
            error={jumpError}
            onChange={(event) => setJump(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') goToAddress();
            }}
          />
          <Button variant="default" onClick={goToAddress}>
            Go
          </Button>
          <Button
            variant="default"
            disabled={current + 1 >= pages}
            onClick={() => setPage(current + 1)}
          >
            Next
          </Button>
        </Group>
      </Card>
    </Stack>
  );
}

export function MemoryViewer({ archive }: { archive?: DebugArchive }) {
  return (
    <Stack>
      <Title order={3}>Memory</Title>
      {!archive ? (
        <Alert title="No capture">Open or read a capture to inspect its memory.</Alert>
      ) : archive.manifest.radioModelId !== RT95_MODEL_ID ? (
        <Alert title="Decoded inventory unavailable">
          Memory is not decoded for this capture yet.
        </Alert>
      ) : null}
      {archive?.manifest.radioModelId === RT95_MODEL_ID && <Rt95Memory archive={archive} />}
      {(archive?.manifest.radioModelId === RT95_MODEL_ID
        ? ['Scan lists', 'Contacts', 'Talk groups']
        : ['Zones', 'Scan lists', 'Contacts', 'Talk groups']
      ).map((section) => (
        <Text key={section}>{section}: not decoded for this radio yet.</Text>
      ))}
    </Stack>
  );
}

export function CompareViewer(props: {
  archive?: DebugArchive;
  modelId: string;
  other?: DebugArchive;
  DecodedDiff?: import('react').ComponentType<{ first: DebugArchive; second: DebugArchive }>;
}) {
  const { archive, modelId } = props;
  const [uploadedOther, setOther] = useState<DebugArchive>();
  const other = 'other' in props ? props.other : uploadedOther;
  const [error, setError] = useState<string>();
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const open = async (file: File | null) => {
    if (!file) return;
    try {
      setOther(openDebugArchive(new Uint8Array(await file.arrayBuffer()), modelId));
      setError(undefined);
      setSelected(null);
      setPage(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open archive.');
    }
  };
  const comparison = archive && other ? compareRegions(archive, other) : undefined;
  const region =
    comparison?.regions.find((r) => r.id === selected && r.comparable) ??
    comparison?.regions.find((r) => r.comparable);
  const left = region && archive?.manifest.regions.find((r) => r.id === region.id);
  const a = region && archive?.regions[region.id];
  const b = region && other?.regions[region.id];
  const length = a && b ? Math.min(a.length, b.length) : 0;
  const pages = Math.max(1, Math.ceil(length / HEX_PAGE_BYTES));
  const current = Math.min(page, pages - 1);
  return (
    <Stack>
      <Title order={3}>Compare captures</Title>
      <Text>Capture A: {archive ? archive.manifest.capturedAt : 'Open a capture first'}</Text>
      <Text>Capture B: {other ? other.manifest.capturedAt : 'Not selected'}</Text>
      {!('other' in props) && (
        <FileButton onChange={open} accept=".zip,application/zip">
          {(buttonProps) => (
            <Button variant="default" {...buttonProps}>
              Open capture B
            </Button>
          )}
        </FileButton>
      )}
      {error && (
        <Alert color="red" title="Could not open capture B">
          {error}
        </Alert>
      )}
      {comparison?.error && <Alert color="red">{comparison.error}</Alert>}
      {comparison &&
        !comparison.error &&
        modelId === 'AT-D890UV' &&
        archive &&
        other &&
        props.DecodedDiff && <props.DecodedDiff first={archive} second={other} />}
      {comparison && !comparison.error && modelId !== 'AT-D890UV' && (
        <>
          <Alert title="Comparison limits">
            Only matching region IDs and starting offsets are compared. Archive format does not
            identify address spaces or wire versus decoded representation for most radios. Such
            regions are refused. Missing bytes are incomparable. Captures may contain sensitive data
            and stay in this browser.
          </Alert>
          <Title order={4}>Summary by region</Title>
          {comparison.regions.map((r) => (
            <Text key={r.id}>
              {r.label}
              {provenance(archive, r.id)}:{' '}
              {r.comparable
                ? `${r.changed} changed bytes · ${r.missing} missing bytes (incomparable)`
                : `Incomparable: ${'reason' in r ? r.reason : 'region or starting offset differs'}`}
            </Text>
          ))}
          {archive && other && props.DecodedDiff && (
            <props.DecodedDiff first={archive} second={other} />
          )}
          <Title order={4}>Decoded changes</Title>
          {(() => {
            const first = archive && rt95ArchiveDetails(archive)?.summary;
            const second = other && rt95ArchiveDetails(other)?.summary;
            if (!first || !second)
              return <Text>Decoded changes are unavailable for these captures.</Text>;
            const settings = first.settingsRetain.flatMap((row) => {
              const next = second.settingsRetain.find((item) => item.label === row.label);
              return next && next.value !== row.value
                ? [`${row.label}: ${row.value} → ${next.value}`]
                : [];
            });
            const slots = new Set([
              ...first.inspectChannels.map((item) => item.slotIndex),
              ...second.inspectChannels.map((item) => item.slotIndex),
            ]);
            const changes = [
              ...settings,
              ...Array.from(slots).flatMap((slot) => {
                const before = first.inspectChannels.find((item) => item.slotIndex === slot)?.name;
                const after = second.inspectChannels.find((item) => item.slotIndex === slot)?.name;
                return before !== after
                  ? [`Channel slot ${slot}: ${before ?? '(empty)'} → ${after ?? '(empty)'}`]
                  : [];
              }),
            ];
            return changes.length ? (
              changes.map((change) => <Text key={change}>{change} [unknown]</Text>)
            ) : (
              <Text>No decoded channel name or setting changes. [unknown]</Text>
            );
          })()}
          {region && left && a && b && (
            <>
              <Select
                label="Comparison region"
                value={region.id}
                data={comparison.regions
                  .filter((r) => r.comparable)
                  .map((r) => ({ value: r.id, label: r.label }))}
                onChange={(id) => {
                  setSelected(id);
                  setPage(0);
                }}
                allowDeselect={false}
              />
              <Card withBorder>
                <Text fw={600}>Byte comparison · {region.label}</Text>
                <div style={{ overflowX: 'auto' }}>
                  <pre aria-label="Byte comparison">
                    {hexRows(a.subarray(0, length), left.address, current)
                      .map((row, i) => {
                        const offset = current * HEX_PAGE_BYTES + i * 16;
                        const otherRow = hexRows(
                          b.subarray(offset, Math.min(offset + 16, length)),
                          left.address + offset,
                          0,
                        )[0];
                        return `${formatAddress(row.address)}${provenance(archive, region.id)}  A ${row.hex}\n${formatAddress(row.address)}${provenance(archive, region.id)}  B ${otherRow?.hex ?? ''}`;
                      })
                      .join('\n') || 'No overlapping bytes'}
                  </pre>
                </div>
                <Group>
                  <Button
                    variant="default"
                    disabled={current === 0}
                    onClick={() => setPage(current - 1)}
                  >
                    Previous
                  </Button>
                  <Text>
                    Page {current + 1} of {pages}
                  </Text>
                  <Button
                    variant="default"
                    disabled={current + 1 >= pages}
                    onClick={() => setPage(current + 1)}
                  >
                    Next
                  </Button>
                </Group>
              </Card>
            </>
          )}
        </>
      )}
    </Stack>
  );
}
