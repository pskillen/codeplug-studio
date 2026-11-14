import { Alert, Button, Group, NumberInput, Stack, Table, Text } from '@mantine/core';
import { useState } from 'react';
import { Page, PageHeader, PageSection } from '@app/components/ui/index.ts';
import {
  openWebSerialPipe,
  requestWebSerialPort,
  webSerialDrainMs,
} from '@integrations/radio-io/transport/index.ts';
import WebSerialOnlyDebugPage from './WebSerialOnlyDebugPage.tsx';

interface Sample {
  round: number;
  baudRate: number;
  totalMs: number;
  /** `totalMs` less the drain wait: close + open + signals + reattach. */
  switchMs: number;
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

/**
 * Times `BytePipe.reopen` on this machine's OS and USB-serial driver. Needs only a USB serial cable (for example a
 * CH340 programming cable) with nothing on the other end: no radio. See the web serial transport doc comment.
 */
function SerialReopen() {
  const [baudA, setBaudA] = useState<number | string>(9600);
  const [baudB, setBaudB] = useState<number | string>(115200);
  const [writeBytes, setWriteBytes] = useState<number | string>(11);
  const [rounds, setRounds] = useState<number | string>(20);
  const [running, setRunning] = useState(false);
  const [samples, setSamples] = useState<Sample[]>([]);
  const [error, setError] = useState<string | null>(null);

  const run = async (): Promise<void> => {
    const a = Number(baudA);
    const b = Number(baudB);
    const n = Number(writeBytes);
    const count = Number(rounds);
    setRunning(true);
    setError(null);
    setSamples([]);
    let pipe: Awaited<ReturnType<typeof openWebSerialPipe>> | null = null;
    try {
      const port = await requestWebSerialPort(true);
      pipe = await openWebSerialPipe(port, a, { raiseDtrRts: false });
      const out: Sample[] = [];
      let rate = a;
      for (let round = 1; round <= count; round++) {
        const next = rate === a ? b : a;
        await pipe.write(new Uint8Array(n).fill(0x55));
        const drain = webSerialDrainMs(n, rate);
        const t0 = performance.now();
        await pipe.reopen!(next);
        const totalMs = performance.now() - t0;
        out.push({ round, baudRate: next, totalMs, switchMs: Math.max(0, totalMs - drain) });
        rate = next;
      }
      setSamples(out);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      await pipe?.close();
      setRunning(false);
    }
  };

  const totals = samples.map((s) => s.totalMs);
  const switches = samples.map((s) => s.switchMs);
  const fmt = (v: number): string => v.toFixed(1);

  return (
    <Page>
      <PageHeader
        title="Serial reopen timing"
        description="How long a Web Serial port takes to close and reopen at a new baud rate."
      />
      <Stack gap="md">
        <Alert color="yellow" title="Cable only">
          Plug in the USB serial cable with nothing connected to its other end: no radio. The test
          writes a few filler bytes (0x55) at the start of each round, then times the switch. DTR
          and RTS are set low after every open. Run it on each OS you care about and record the
          numbers.
        </Alert>
        <PageSection title="Run">
          <Group align="flex-end">
            <NumberInput label="Baud A" value={baudA} onChange={setBaudA} min={300} w={110} />
            <NumberInput label="Baud B" value={baudB} onChange={setBaudB} min={300} w={110} />
            <NumberInput
              label="Bytes per round"
              value={writeBytes}
              onChange={setWriteBytes}
              min={0}
              w={140}
            />
            <NumberInput
              label="Rounds"
              value={rounds}
              onChange={setRounds}
              min={1}
              max={200}
              w={90}
            />
            <Button onClick={() => void run()} loading={running}>
              Pick port and run
            </Button>
          </Group>
        </PageSection>
        {error ? (
          <Alert color="red" title="Failed">
            {error}
          </Alert>
        ) : null}
        {samples.length > 0 ? (
          <PageSection title="Result (ms)">
            <Text size="sm">
              Whole switch (drain + close + open): min {fmt(Math.min(...totals))}, median{' '}
              {fmt(median(totals))}, max {fmt(Math.max(...totals))}. Without the drain wait: min{' '}
              {fmt(Math.min(...switches))}, median {fmt(median(switches))}, max{' '}
              {fmt(Math.max(...switches))}.
            </Text>
            <Table withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Round</Table.Th>
                  <Table.Th>New baud</Table.Th>
                  <Table.Th>Whole switch</Table.Th>
                  <Table.Th>Without drain</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {samples.map((s) => (
                  <Table.Tr key={s.round}>
                    <Table.Td>{s.round}</Table.Td>
                    <Table.Td>{s.baudRate}</Table.Td>
                    <Table.Td>{fmt(s.totalMs)}</Table.Td>
                    <Table.Td>{fmt(s.switchMs)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </PageSection>
        ) : null}
      </Stack>
    </Page>
  );
}

/** Web Serial only: the Android app shows a notice instead (#1673). */
export default function DebugSerialReopenPage() {
  return (
    <WebSerialOnlyDebugPage title="Serial reopen timing">
      <SerialReopen />
    </WebSerialOnlyDebugPage>
  );
}
