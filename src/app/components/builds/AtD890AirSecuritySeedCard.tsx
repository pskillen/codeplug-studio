/**
 * Brandmeister AirSecurity on the MM9PDY AT-D890UV radio settings page.
 *
 * The paste and the parsed bytes live only in this component. They are wiped after a write,
 * after a clear, and when the card unmounts. Nothing here is written to storage, the project,
 * a build, or the settings session.
 */

import { useEffect, useRef, useState } from 'react';
import { Alert, Group, Stack } from '@mantine/core';
import type { EgressPath } from '@core/models/egressPath.ts';
import {
  airSecuritySeedUriDmrId,
  parseAirSecuritySeedInput,
} from '@integrations/radio-io/radios/at-d890uv/airSecuritySeed.ts';
import {
  checkAtD890AirSecuritySeed,
  writeAtD890AirSecuritySeedOnRadio,
} from '../../services/radioIoAtD890AirSecuritySession.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import {
  getRadioSerialUnsupportedMessage,
  isRadioSerialSupported,
} from '../../services/radioIoSession.ts';
import { Button, Panel, TextInput } from '../v2/index.ts';

export interface AtD890AirSecuritySeedCardProps {
  egress: EgressPath;
}

const ENTRY_WARNING =
  'Backups contain the seed. Clearing the seed does not remove it from backups you have already taken.';
const PLACEHOLDER = 'Paste the Selfcare text or the otpauth:// link';
const WRITTEN_NOTE = 'Seed written. The radio restarts; wait about 20 seconds.';
const CLEARED_NOTE = 'Seed cleared. The radio restarts; wait about 20 seconds.';

function dmrIdWarning(id: number): string {
  return `The link is for DMR ID ${id}, which is not one of this library's DMR IDs.`;
}

type Presence = 'unchecked' | 'set' | 'unset';
type Note = 'written' | 'cleared' | null;

const PRESENCE_LABEL: Record<Presence, string> = {
  unchecked: 'Not checked',
  set: 'Seed set',
  unset: 'No seed',
};

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export default function AtD890AirSecuritySeedCard({ egress }: AtD890AirSecuritySeedCardProps) {
  const serialOk = isRadioSerialSupported();
  const { library } = useLibrary();
  const libraryDmrIds = library.ownDigitalIds
    .filter((row) => row.protocol === 'dmr')
    .map((row) => row.number);
  const [text, setText] = useState('');
  const [reason, setReason] = useState<string | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [presence, setPresence] = useState<Presence>('unchecked');
  const [note, setNote] = useState<Note>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const textRef = useRef('');
  const seedRef = useRef<Uint8Array | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  function wipeBuffers(): void {
    textRef.current = '';
    if (seedRef.current) {
      seedRef.current.fill(0);
      seedRef.current = null;
    }
  }

  function wipe(): void {
    wipeBuffers();
    setText('');
    setReason(null);
    setCanWrite(false);
  }

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortRef.current?.abort();
      wipeBuffers();
    };
  }, []);

  function holdSeed(next: Uint8Array | null): void {
    if (seedRef.current && seedRef.current !== next) seedRef.current.fill(0);
    seedRef.current = next;
    setCanWrite(next !== null);
  }

  function onPaste(value: string): void {
    textRef.current = value;
    setText(value);
    if (value.trim() === '') {
      holdSeed(null);
      setReason(null);
      return;
    }
    const parsed = parseAirSecuritySeedInput(value);
    if (parsed.ok) {
      holdSeed(parsed.seed);
      setReason(null);
    } else {
      holdSeed(null);
      setReason(parsed.reason);
    }
  }

  async function run(action: 'check' | 'write' | 'clear'): Promise<void> {
    setError(null);
    setBusy(true);
    const abort = new AbortController();
    abortRef.current = abort;
    // Copy so unmount can wipe seedRef without zeroing the buffer this write is still using.
    const seedCopy = action === 'write' && seedRef.current ? seedRef.current.slice() : null;
    try {
      if (action === 'check') {
        const set = await checkAtD890AirSecuritySeed(egress, { signal: abort.signal });
        if (abort.signal.aborted || !mountedRef.current) return;
        setPresence(set ? 'set' : 'unset');
        setNote(null);
        return;
      }
      await writeAtD890AirSecuritySeedOnRadio(egress, action === 'clear' ? null : seedCopy, {
        signal: abort.signal,
      });
      if (!mountedRef.current) {
        wipeBuffers();
        return;
      }
      wipe();
      if (abort.signal.aborted) return;
      if (action === 'clear') {
        setPresence('unset');
        setNote('cleared');
      } else {
        setPresence('set');
        setNote('written');
      }
    } catch (err) {
      if (!abort.signal.aborted && mountedRef.current) setError(errorText(err));
    } finally {
      seedCopy?.fill(0);
      if (abortRef.current === abort) abortRef.current = null;
      if (mountedRef.current) setBusy(false);
    }
  }

  const linkedDmrId = airSecuritySeedUriDmrId(text);
  const showDmrWarning = linkedDmrId !== null && !libraryDmrIds.includes(linkedDmrId);

  return (
    <Panel title="Brandmeister AirSecurity">
      <Stack gap="sm">
        <Alert color="yellow">{ENTRY_WARNING}</Alert>
        <TextInput
          label="AirSecurity seed"
          type="password"
          autoComplete="off"
          placeholder={PLACEHOLDER}
          value={text}
          error={reason !== null}
          hint={reason ?? undefined}
          disabled={busy || !serialOk}
          onChange={(event) => onPaste(event.target.value)}
        />
        {showDmrWarning && linkedDmrId !== null ? (
          <Alert color="yellow">{dmrIdWarning(linkedDmrId)}</Alert>
        ) : null}
        <p role="status">{PRESENCE_LABEL[presence]}</p>
        {note === 'written' ? <p>{WRITTEN_NOTE}</p> : null}
        {note === 'cleared' ? <p>{CLEARED_NOTE}</p> : null}
        {!serialOk ? (
          <Alert color="yellow" title="Web Serial is not available">
            {getRadioSerialUnsupportedMessage()}
          </Alert>
        ) : null}
        {error ? (
          <Alert color="red" title="Could not update the AirSecurity seed">
            {error}
          </Alert>
        ) : null}
        <Group gap="sm">
          <Button size="sm" disabled={!serialOk || busy} onClick={() => void run('check')}>
            Check radio
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!serialOk || busy || !canWrite}
            onClick={() => void run('write')}
          >
            Write seed
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!serialOk || busy}
            onClick={() => void run('clear')}
          >
            Clear seed
          </Button>
        </Group>
      </Stack>
    </Panel>
  );
}
