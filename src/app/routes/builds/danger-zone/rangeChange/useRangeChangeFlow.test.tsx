import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EgressPath } from '@core/models/egressPath.ts';
import {
  listRangeChangeJournal,
  RANGE_CHANGE_JOURNAL_KEY,
  type RangeChangeJournalEntry,
} from '@integrations/persistence/rangeChangeJournal.ts';
import {
  createRadioSession,
  getRadioDescriptor,
  RadioWrongIdentError,
} from '@integrations/radio-io';
import { D890_MAP } from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import { AtD890uvProtocol } from '@integrations/radio-io/radios/at-d890uv/protocol.ts';
import { sha256Hex } from '@integrations/radio-io/radios/at-d890uv/vitalBackupZip.ts';
import { resetRangeChangeJournalCache } from '../../../../state/atD890RangeChangeJournal.ts';
import { FakeD890Radio } from '../../../../services/dangerZone/__fixtures__/fakeD890Radio.ts';
import { useRangeChangeFlow, type UseRangeChangeFlowOptions } from './useRangeChangeFlow.tsx';

const hoisted = vi.hoisted(() => ({
  fake: undefined as unknown,
  openError: undefined as Error | undefined,
  downloads: [] as string[],
  opens: 0,
}));

vi.mock('@integrations/download/browserDownload.ts', async (orig) => {
  const actual = await orig<typeof import('@integrations/download/browserDownload.ts')>();
  return {
    ...actual,
    downloadZip: (_bytes: Uint8Array, name: string) => {
      hoisted.downloads.push(name);
    },
  };
});

vi.mock('../../../../services/radioIoSession.ts', async (orig) => {
  const actual = await orig<typeof import('../../../../services/radioIoSession.ts')>();
  return {
    ...actual,
    openRadioSessionForEgress: vi.fn(async () => {
      hoisted.opens += 1;
      if (hoisted.openError) throw hoisted.openError;
      const fake = hoisted.fake as FakeD890Radio;
      const descriptor = getRadioDescriptor('AT-D890UV')!;
      const pipe = fake.open();
      const radio = new AtD890uvProtocol();
      await radio.connect(pipe);
      const session = createRadioSession({ descriptor, pipe, radio });
      if (radio.mustNotEnd()) {
        try {
          radio.assertNoStunKillFlag();
        } finally {
          await actual.closeRadioSession(session).catch(() => undefined);
        }
      }
      return { session, descriptor };
    }),
  };
});

const EGRESS = { id: 'e', formatId: 'radio-io', profileId: 'radio-io-at-d890uv' } as EgressPath;
const LOCAL_INFO = D890_MAP.LocalInfo;

let navigations: { path: string; state?: unknown }[];

function setup(over: Partial<UseRangeChangeFlowOptions> = {}) {
  navigations = [];
  return renderHook(() =>
    useRangeChangeFlow({
      buildId: 'b1',
      egress: EGRESS,
      descriptor: getRadioDescriptor('AT-D890UV'),
      navigateInBuild: (path, state) => navigations.push({ path, state }),
      ...over,
    }),
  );
}

type Hook = ReturnType<typeof setup>;

async function until(_hook: Hook, check: () => boolean, timeout = 60_000) {
  await waitFor(() => expect(check()).toBe(true), { timeout, interval: 25 });
}

async function connectRead(hook: Hook) {
  await act(async () => hook.result.current.actions.onConnectRead());
  await until(
    hook,
    () => hook.result.current.view.radio !== null || hook.result.current.view.notice !== null,
  );
}

async function toBackUp(hook: Hook, target: number) {
  await connectRead(hook);
  act(() => hook.result.current.actions.onReadNext());
  act(() => hook.result.current.actions.onPickTarget(target));
  act(() => hook.result.current.actions.onRangeNext());
  expect(hook.result.current.view.step).toBe('backUp');
}

async function backUp(hook: Hook) {
  await act(async () => hook.result.current.actions.onBackUp());
  await until(
    hook,
    () =>
      hook.result.current.view.backUp.phase === 'saved' || hook.result.current.view.notice !== null,
  );
}

async function toConfirm(hook: Hook, target = 7) {
  await toBackUp(hook, target);
  await backUp(hook);
  act(() => hook.result.current.actions.onSavedTick(true));
  act(() => hook.result.current.actions.onBackUpNext());
  expect(hook.result.current.view.step).toBe('confirm');
}

async function change(hook: Hook) {
  act(() => hook.result.current.actions.onConfirmTick(true));
  await act(async () => hook.result.current.actions.onChange());
  await until(hook, () => !hook.result.current.view.busy);
}

async function reconnect(hook: Hook) {
  await act(async () => hook.result.current.actions.onReconnect(false));
  await until(hook, () => !hook.result.current.view.busy);
}

const writes = (fake: FakeD890Radio) => fake.allWrites();
const journal = () => listRangeChangeJournal();

beforeEach(() => {
  hoisted.fake = new FakeD890Radio(3);
  hoisted.openError = undefined;
  hoisted.downloads = [];
  hoisted.opens = 0;
  window.localStorage.clear();
  resetRangeChangeJournalCache();
});
afterEach(() => vi.clearAllMocks());

const fake = () => hoisted.fake as FakeD890Radio;

describe('useRangeChangeFlow', () => {
  it('runs the whole flow: one W to the range address in total, journal stages in order, Done', async () => {
    const stages: string[] = [];
    const hook = setup();
    const watch = () => {
      const s = journal()[0]?.stage;
      if (s && stages.at(-1) !== s) stages.push(s);
    };
    const origSet = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (this: Storage, k, v) {
      origSet.call(this, k, v);
      if (k === RANGE_CHANGE_JOURNAL_KEY) watch();
    });

    await connectRead(hook);
    const { view } = hook.result.current;
    expect(view.radio?.serial).toBe('TESTSERIAL01');
    expect(view.currentCode).toBe(3);
    expect(view.rangeRows).toHaveLength(19);
    expect(fake().allWrites()).toHaveLength(0);

    act(() => hook.result.current.actions.onReadNext());
    act(() => hook.result.current.actions.onPickTarget(7));
    act(() => hook.result.current.actions.onRangeNext());
    await backUp(hook);
    expect(hook.result.current.view.backUp.phase).toBe('saved');
    expect(hoisted.downloads).toHaveLength(2);
    // Next stays off until the tick.
    act(() => hook.result.current.actions.onBackUpNext());
    expect(hook.result.current.view.step).toBe('backUp');
    act(() => hook.result.current.actions.onSavedTick(true));
    act(() => hook.result.current.actions.onBackUpNext());
    expect(hook.result.current.view.step).toBe('confirm');

    // The red button needs the tick.
    await act(async () => hook.result.current.actions.onChange());
    expect(hook.result.current.view.step).toBe('confirm');
    expect(fake().allWrites()).toHaveLength(0);

    await change(hook);
    expect(hook.result.current.view.step).toBe('restart');
    expect(hook.result.current.view.wiped).toBe(true);
    expect(hook.result.current.view.restart.canReconnect).toBe(false);
    expect(journal()[0]?.stage).toBe('changed');
    expect(fake().band).toBe(7);

    await reconnect(hook);
    expect(hook.result.current.view.restart.verified).toBe(true);
    expect(hook.result.current.view.restart.checklist.every((c) => c.ok)).toBe(true);

    await act(async () => hook.result.current.actions.onRestore());
    await until(hook, () => hook.result.current.view.step === 'check');
    expect(journal()[0]?.stage).toBe('restored');
    expect(hook.result.current.view.wiped).toBe(false);

    // The final Check is never automatic: it has not run until the user presses it.
    expect(hook.result.current.view.check.result).toBeNull();
    await act(async () => hook.result.current.actions.onCheck());
    await until(hook, () => hook.result.current.view.step === 'done');
    expect(journal()[0]?.stage).toBe('done');
    expect(stages).toEqual(['sending', 'changed', 'restored', 'done']);

    // The wizard-wide proof: exactly one W ever went to the range address; none elsewhere in LocalInfo or the tune bank.
    const all = writes(fake());
    expect(all.filter((f) => f.address === 0x04f80000 && f.length === 0x10)).toHaveLength(1);
    expect(all.filter((f) => f.address! >= 0x04f00000 && f.address! <= 0x04ffffff)).toHaveLength(1);
    const sessionOfFrame = all.find((f) => f.address === 0x04f80000)!.session;
    // The change session never wrote anything else.
    expect(all.filter((f) => f.session === sessionOfFrame)).toHaveLength(1);
    // Session order: A (read, change), B (verify, restore), C (check, no W).
    const bySession = [...new Set(fake().frames.map((f) => f.session))];
    expect(bySession).toHaveLength(3);
    expect(writes(fake()).filter((f) => f.session === bySession[2])).toHaveLength(0);
    expect(hook.result.current.view.done.changeBackCode).toBe(3);
    vi.restoreAllMocks();
  }, 180_000);

  describe('refusals at connect', () => {
    it('not an AT-D890UV: says so, writes nothing, no journal', async () => {
      hoisted.openError = new RadioWrongIdentError('Unsupported Anytone ident');
      const hook = setup();
      await connectRead(hook);
      expect(hook.result.current.view.notice?.kind).toBe('not-d890');
      expect(fake().frames).toHaveLength(0);
      expect(journal()).toHaveLength(0);
    });

    it('a stun flag: refusal, no W, no END', async () => {
      const li = fake().getBytes(LOCAL_INFO, 0x100);
      li[0] = 1;
      fake().setBytes(LOCAL_INFO, li);
      const hook = setup();
      await connectRead(hook);
      expect(hook.result.current.view.notice?.kind).toBe('stun-kill');
      expect(hook.result.current.view.notice?.nothingChanged).toBe(true);
      expect(fake().allWrites()).toHaveLength(0);
      expect(fake().frames.filter((f) => f.kind === 'END')).toHaveLength(0);
    });

    it('an unreadable LocalInfo at connect: no END (stun/kill state unknown), power-cycle advice', async () => {
      // The connect check reads LocalInfo once; the identify read after it fails.
      fake().unreadableAddress = LOCAL_INFO;
      fake().unreadableAfterReads = 1;
      const hook = setup();
      await connectRead(hook);
      expect(hook.result.current.view.notice?.kind).toBe('unreadable');
      expect(hook.result.current.view.notice?.body).toContain('Switch the radio off and on');
      expect(fake().allWrites()).toHaveLength(0);
      expect(fake().frames.filter((f) => f.kind === 'END')).toHaveLength(0);
    });

    it('a LocalInfo that becomes unreadable during the backup: no END', async () => {
      const hook = setup();
      await toBackUp(hook, 7);
      fake().unreadableAddress = LOCAL_INFO;
      await backUp(hook);
      expect(hook.result.current.view.notice?.kind).toBe('unreadable');
      expect(hook.result.current.view.backUp.phase).toBe('idle');
      expect(fake().allWrites()).toHaveLength(0);
      expect(fake().frames.filter((f) => f.kind === 'END')).toHaveLength(0);
    });

    it('a blank serial is refused at the backup, nothing written', async () => {
      const li = fake().getBytes(LOCAL_INFO, 0x100);
      li.fill(0xff, 0x30, 0x40);
      fake().setBytes(LOCAL_INFO, li);
      const hook = setup();
      await connectRead(hook);
      // The identify step already refuses a blank serial.
      expect(hook.result.current.view.notice?.kind).toBe('backup-refused');
      expect(fake().allWrites()).toHaveLength(0);
    });

    it('an unfinished change for this serial offers Resume and writes nothing', async () => {
      const entry: RangeChangeJournalEntry = {
        serial: 'TESTSERIAL01',
        model: 'AT-D890UV',
        fromCode: 3,
        toCode: 7,
        stage: 'changed',
        backup: { fileName: 'b.zip', sha256: 'a'.repeat(64), savedAt: '2026-10-26T14:12:00Z' },
        vital: { fileName: 'v.zip', sha256: 'b'.repeat(64) },
        startedAt: '2026-10-26T14:10:00Z',
        updatedAt: '2026-10-26T14:14:00Z',
        studioVersion: 'test',
      };
      window.localStorage.setItem(RANGE_CHANGE_JOURNAL_KEY, JSON.stringify([entry]));
      resetRangeChangeJournalCache();
      const hook = setup();
      await connectRead(hook);
      expect(hook.result.current.view.notice?.kind).toBe('unfinished');
      act(() => hook.result.current.actions.onResumeFromNotice('TESTSERIAL01'));
      expect(navigations[0]?.path).toBe('export/danger-zone/frequency-range/resume');
      expect(fake().allWrites()).toHaveLength(0);
    });
  });

  describe('step 2 rows', () => {
    it('lists all 19 ranges, the current one disabled, 14 disabled without 890#, 6/9/12/15 allowed', async () => {
      const hook = setup();
      await connectRead(hook);
      const rows = hook.result.current.view.rangeRows;
      expect(rows.map((r) => r.code)).toEqual(Array.from({ length: 19 }, (_, i) => i));
      expect(rows.find((r) => r.code === 3)).toMatchObject({ current: true, selectable: false });
      expect(rows.find((r) => r.code === 14)).toMatchObject({ selectable: false });
      expect(rows.find((r) => r.code === 14)?.disabledReason).toMatch(/890#/);
      for (const code of [6, 9, 12, 15]) {
        expect(rows.find((r) => r.code === code)).toMatchObject({
          unlisted: true,
          selectable: true,
        });
      }
      act(() => hook.result.current.actions.onReadNext());
      // Next stays off until a different range is picked.
      act(() => hook.result.current.actions.onRangeNext());
      expect(hook.result.current.view.step).toBe('newRange');
      act(() => hook.result.current.actions.onPickTarget(3));
      act(() => hook.result.current.actions.onPickTarget(14));
      act(() => hook.result.current.actions.onRangeNext());
      expect(hook.result.current.view.step).toBe('newRange');
      act(() => hook.result.current.actions.onPickTarget(15));
      act(() => hook.result.current.actions.onRangeNext());
      expect(hook.result.current.view.step).toBe('backUp');
    });

    it('code 14 is selectable on a radio that already has 890#', async () => {
      const li = fake().getBytes(LOCAL_INFO, 0x100);
      li.set(new TextEncoder().encode('890#'), 0x0b);
      fake().setBytes(LOCAL_INFO, li);
      const hook = setup();
      await connectRead(hook);
      expect(hook.result.current.view.rangeRows.find((r) => r.code === 14)?.selectable).toBe(true);
    });

    it('a radio on an unlisted code is allowed, and the current range is flagged', async () => {
      const f = new FakeD890Radio(15);
      hoisted.fake = f;
      const hook = setup();
      await connectRead(hook);
      expect(hook.result.current.view.currentUnlisted).toBe(true);
      expect(hook.result.current.view.radio?.identCode).toBe(15);
    });

    it('a raw stored code the radio maps to 0 is said, and the frame uses the raw byte', async () => {
      const f = new FakeD890Radio(3);
      const li = f.getBytes(LOCAL_INFO, 0x100);
      li[3] = 14; // 14 without 890#: the ident says 0
      f.setBytes(LOCAL_INFO, li);
      f.band = 0;
      hoisted.fake = f;
      const hook = setup();
      await connectRead(hook);
      expect(hook.result.current.view.rawCodeNote).toBe('Stored as 14; the radio treats it as 0.');
      expect(hook.result.current.view.currentCode).toBe(0);
    });

    it('Change back preselects the old code', async () => {
      const hook = setup({ initialTarget: 7 });
      await connectRead(hook);
      await waitFor(() => expect(hook.result.current.view.target).toBe(7));
    });
  });

  describe('step 5 outcomes', () => {
    it('the radio changed since the backup: END, nothing changed, journal cleared', async () => {
      const hook = setup();
      await toConfirm(hook);
      const li = fake().getBytes(LOCAL_INFO, 0x100);
      li[0x80] = 0x42;
      fake().setBytes(LOCAL_INFO, li);
      await change(hook);
      expect(hook.result.current.view.notice?.kind).toBe('radio-changed');
      expect(hook.result.current.view.notice?.nothingChanged).toBe(true);
      expect(fake().allWrites()).toHaveLength(0);
      expect(journal()).toHaveLength(0);
      expect(hook.result.current.view.step).toBe('change');
    }, 120_000);

    it('a NAK: the journal written before the W is cleared, no END', async () => {
      const hook = setup();
      await toConfirm(hook);
      fake().nakAddress = LOCAL_INFO;
      await change(hook);
      expect(hook.result.current.view.notice?.kind).toBe('not-taken');
      expect(journal()).toHaveLength(0);
      const aSession = fake().allWrites()[0]!.session;
      expect(fake().frames.filter((f) => f.session === aSession && f.kind === 'END')).toHaveLength(
        0,
      );
      expect(fake().band).toBe(3);
    }, 120_000);

    it('a stun flag that appears now: no W, no END, no journal', async () => {
      const hook = setup();
      await toConfirm(hook);
      const li = fake().getBytes(LOCAL_INFO, 0x100);
      li[1] = 1;
      fake().setBytes(LOCAL_INFO, li);
      await change(hook);
      expect(hook.result.current.view.notice?.kind).toBe('stun-kill');
      expect(fake().allWrites()).toHaveLength(0);
      expect(journal()).toHaveLength(0);
    }, 120_000);

    it('leaving the page while the W is in flight sends no second END', async () => {
      const hook = setup();
      await toConfirm(hook);
      let aSession = 0;
      fake().onWrite = (f) => {
        aSession = f.session;
        hook.unmount();
      };
      act(() => hook.result.current.actions.onConfirmTick(true));
      await act(async () => hook.result.current.actions.onChange());
      await waitFor(() => expect(fake().endsIn(aSession || -1)).toBeGreaterThan(0), {
        timeout: 20_000,
      });
      // Let any stray close from the unmount cleanup land before counting.
      await new Promise((r) => setTimeout(r, 300));
      const frames = fake()
        .frames.filter((f) => f.session === aSession && (f.kind === 'W' || f.kind === 'END'))
        .map((f) => f.kind);
      expect(frames).toEqual(['W', 'END']);
      expect(['sending', 'changed']).toContain(journal()[0]?.stage);
    });

    it('the journal is written before the W', async () => {
      const hook = setup();
      await toConfirm(hook);
      const seen: { stage: string; writesSoFar: number }[] = [];
      const orig = Storage.prototype.setItem;
      const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (
        this: Storage,
        k: string,
        v: string,
      ) {
        if (k === RANGE_CHANGE_JOURNAL_KEY) {
          seen.push({ stage: JSON.parse(v)[0].stage, writesSoFar: fake().allWrites().length });
        }
        orig.call(this, k, v);
      });
      await change(hook);
      // 'sending' is on disk before the W; 'changed' after it.
      expect(seen[0]).toEqual({ stage: 'sending', writesSoFar: 0 });
      expect(seen[1]).toEqual({ stage: 'changed', writesSoFar: 1 });
      spy.mockRestore();
    }, 120_000);
  });

  describe('step 6 findings', () => {
    async function changed() {
      const hook = setup();
      await toConfirm(hook);
      await change(hook);
      expect(hook.result.current.view.step).toBe('restart');
      return hook;
    }

    it('no port: says what to do, Choose the port is offered', async () => {
      const hook = await changed();
      hoisted.openError = new Error('No port selected by the user.');
      await reconnect(hook);
      expect(hook.result.current.view.notice?.kind).toBe('no-port');
      expect(hook.result.current.view.wiped).toBe(true);
    }, 120_000);

    it('a different radio: refused, journal kept', async () => {
      const hook = await changed();
      const li = fake().getBytes(LOCAL_INFO, 0x100);
      li.set(new TextEncoder().encode('TESTSERIAL02'), 0x30);
      fake().setBytes(LOCAL_INFO, li);
      await reconnect(hook);
      expect(hook.result.current.view.notice?.kind).toBe('wrong-radio');
      expect(journal()[0]?.stage).toBe('changed');
    }, 120_000);

    it('still on the old range: nothing was wiped, journal cleared, Try again / Finish', async () => {
      const hook = setup();
      await toConfirm(hook);
      // The W is lost: the radio never commits.
      fake().nakAddress = undefined;
      await change(hook);
      // Put the old range back, as if the commit never happened.
      const li = fake().getBytes(LOCAL_INFO, 0x100);
      li[3] = 3;
      fake().setBytes(LOCAL_INFO, li);
      fake().band = 3;
      await reconnect(hook);
      expect(hook.result.current.view.notice?.kind).toBe('still-old');
      expect(journal()).toHaveLength(0);
      expect(hook.result.current.view.wiped).toBe(false);
    }, 120_000);

    it('an unexpected range: stops, Copy details', async () => {
      const hook = await changed();
      fake().band = 9;
      const li = fake().getBytes(LOCAL_INFO, 0x100);
      li[3] = 9;
      fake().setBytes(LOCAL_INFO, li);
      await reconnect(hook);
      expect(hook.result.current.view.notice).toMatchObject({
        kind: 'unexpected-range',
        details: expect.any(String),
      });
      expect(hook.result.current.view.restart.verified).toBe(false);
    }, 120_000);

    it('an extra identity byte: stops, offers Restore anyway behind a second confirm', async () => {
      const hook = await changed();
      const li = fake().getBytes(LOCAL_INFO, 0x100);
      li[0x90] ^= 0xff;
      fake().setBytes(LOCAL_INFO, li);
      await reconnect(hook);
      expect(hook.result.current.view.notice?.kind).toBe('identity-differs');
      expect(hook.result.current.view.restart.anywayAvailable).toBe(true);
      expect(hook.result.current.view.restart.verified).toBe(false);
      // Not restoring until the second confirm.
      expect(
        fake()
          .allWrites()
          .filter((f) => f.address !== 0x04f80000),
      ).toHaveLength(0);
      act(() => hook.result.current.actions.onRestoreAnywayOpen());
      expect(hook.result.current.view.restart.anywayOpen).toBe(true);
      act(() => hook.result.current.actions.onRestoreAnywayClose());
      expect(
        fake()
          .allWrites()
          .filter((f) => f.address !== 0x04f80000),
      ).toHaveLength(0);
      act(() => hook.result.current.actions.onRestoreAnywayOpen());
      await act(async () => hook.result.current.actions.onRestoreAnywayConfirm());
      await until(hook, () => hook.result.current.view.step === 'check');
      expect(journal()[0]?.stage).toBe('restored');
    }, 180_000);
  });

  describe('step 7 and 8', () => {
    async function toRestore() {
      const hook = setup();
      await toConfirm(hook);
      await change(hook);
      await reconnect(hook);
      return hook;
    }

    it('a restore that stops says so, keeps the radio marked wiped, and Restore again re-runs it all', async () => {
      const hook = await toRestore();
      const f = fake();
      // Fail the first restore write.
      const target = D890_MAP.ZoneSet;
      f.nakAddress = target;
      await act(async () => hook.result.current.actions.onRestore());
      await until(hook, () => !hook.result.current.view.busy);
      expect(hook.result.current.view.restore.failed).toBe(true);
      expect(hook.result.current.view.notice?.kind).toBe('restore-failed');
      expect(hook.result.current.view.wiped).toBe(true);
      expect(journal()[0]?.stage).toBe('changed');
      f.nakAddress = undefined;
      await act(async () => hook.result.current.actions.onRestoreAgain());
      await until(hook, () => hook.result.current.view.step === 'check');
      expect(journal()[0]?.stage).toBe('restored');
    }, 240_000);

    it('Check differences offer Restore again; Skip check finishes', async () => {
      const hook = await toRestore();
      await act(async () => hook.result.current.actions.onRestore());
      await until(hook, () => hook.result.current.view.step === 'check');
      const zone = fake().getBytes(D890_MAP.ZoneSet, 16);
      zone[0] ^= 0xff;
      fake().setBytes(D890_MAP.ZoneSet, zone);
      await act(async () => hook.result.current.actions.onCheck());
      await until(hook, () => !hook.result.current.view.busy);
      expect(hook.result.current.view.notice?.kind).toBe('check-differs');
      expect(hook.result.current.view.step).toBe('check');
      act(() => hook.result.current.actions.onSkipCheck());
      expect(hook.result.current.view.step).toBe('done');
      expect(hook.result.current.view.done.skipped).toBe(true);
      expect(journal()[0]?.stage).toBe('done');
    }, 240_000);

    it('while the radio is wiped the leave guard is on; before the frame it is off', async () => {
      const guards: boolean[] = [];
      const hook = setup({ onGuardChange: (a) => guards.push(a) });
      await toConfirm(hook);
      expect(guards.at(-1)).toBe(false);
      await change(hook);
      expect(guards.at(-1)).toBe(true);
      await reconnect(hook);
      await act(async () => hook.result.current.actions.onRestore());
      await until(hook, () => hook.result.current.view.step === 'check');
      expect(guards.at(-1)).toBe(false);
    }, 240_000);
  });
});

describe('useRangeChangeFlow resume', () => {
  let backupZip: Uint8Array;
  let vitalZip: Uint8Array;
  let entry: RangeChangeJournalEntry;

  /** One change, made through the flow, and its two files. Leaves a changed radio. */
  beforeAll(async () => {
    hoisted.fake = new FakeD890Radio(3);
    window.localStorage.clear();
    const { backupForRangeChange } =
      await import('../../../../services/dangerZone/atD890RangeChangeService.ts');
    const descriptor = getRadioDescriptor('AT-D890UV')!;
    const f = hoisted.fake as FakeD890Radio;
    const pipe = f.open();
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    const session = createRadioSession({ descriptor, pipe, radio });
    const pair = await backupForRangeChange(session, {});
    backupZip = pair.backup.zipBytes;
    vitalZip = pair.vital.zipBytes;
    entry = {
      serial: pair.serial,
      model: 'AT-D890UV',
      fromCode: 3,
      toCode: 7,
      stage: 'changed',
      backup: { fileName: pair.backupFileName, sha256: pair.backupSha256, savedAt: pair.savedAt },
      vital: { fileName: pair.vitalFileName, sha256: pair.vitalSha256 },
      startedAt: pair.savedAt,
      updatedAt: pair.savedAt,
      studioVersion: 'test',
    };
  }, 120_000);

  /** The radio after the change: new range, wiped. */
  function changedRadio(): FakeD890Radio {
    const f = new FakeD890Radio(3);
    const pipe = f.open();
    void pipe;
    // Apply the same commit the real radio does: range 7, wiped codeplug.
    const li = f.getBytes(LOCAL_INFO, 0x100);
    li[3] = 7;
    f.setBytes(LOCAL_INFO, li);
    f.band = 7;
    const tune = f.getBytes(0x04f00000, 0x2000);
    tune[0x28] = 7;
    f.setBytes(0x04f00000, tune);
    return f;
  }

  const file = (bytes: Uint8Array, name: string) =>
    new File([new Uint8Array(bytes)], name, { type: 'application/zip' });

  function seed(stage: RangeChangeJournalEntry['stage']) {
    window.localStorage.setItem(RANGE_CHANGE_JOURNAL_KEY, JSON.stringify([{ ...entry, stage }]));
    resetRangeChangeJournalCache();
  }

  async function pickBackup(hook: Hook, bytes = backupZip) {
    await act(async () => hook.result.current.actions.onResumeFile(file(bytes, 'b.zip')));
    await until(
      hook,
      () => hook.result.current.view.resume.fileOk || hook.result.current.view.notice !== null,
    );
  }

  it('from changed: the file hash is checked, then the step 6 checks, then Restore and Check', async () => {
    hoisted.fake = changedRadio();
    seed('changed');
    const hook = setup({ resume: { serial: entry.serial } });
    expect(hook.result.current.view.step).toBe('resume');
    expect(hook.result.current.view.resume.entry?.stage).toBe('changed');
    await pickBackup(hook);
    expect(hook.result.current.view.resume.fileOk).toBe(true);
    expect(hook.result.current.view.resume.next).toBe('connect');
    await act(async () => hook.result.current.actions.onResumeConnect());
    await until(hook, () => !hook.result.current.view.busy);
    expect(hook.result.current.view.step).toBe('restart');
    expect(hook.result.current.view.restart.verified).toBe(true);
    // Without the vital file the calibration is not compared.
    expect(
      hook.result.current.view.restart.checklist.find((c) => c.id === 'calibration')?.text,
    ).toMatch(/not compared/);
    await act(async () => hook.result.current.actions.onRestore());
    await until(hook, () => hook.result.current.view.step === 'check');
    expect(journal()[0]?.stage).toBe('restored');
    await act(async () => hook.result.current.actions.onCheck());
    await until(hook, () => hook.result.current.view.step === 'done');
    expect(journal()[0]?.stage).toBe('done');
    expect(
      (hoisted.fake as FakeD890Radio)
        .allWrites()
        .filter((f) => f.address! >= 0x04f00000 && f.address! <= 0x04ffffff),
    ).toHaveLength(0);
  }, 240_000);

  it('with the vital file the tune is compared too', async () => {
    hoisted.fake = changedRadio();
    seed('changed');
    const hook = setup({ resume: { serial: entry.serial } });
    await pickBackup(hook);
    await act(async () => hook.result.current.actions.onResumeVital(file(vitalZip, 'v.zip')));
    await until(hook, () => hook.result.current.view.resume.vitalName !== null);
    await act(async () => hook.result.current.actions.onResumeConnect());
    await until(hook, () => !hook.result.current.view.busy);
    expect(hook.result.current.view.restart.verified).toBe(true);
    expect(
      hook.result.current.view.restart.checklist.find((c) => c.id === 'calibration')?.text,
    ).toMatch(/Calibration unchanged/);
  }, 120_000);

  it('from sending, radio still on the old range: "Nothing changed after all", journal cleared', async () => {
    hoisted.fake = new FakeD890Radio(3);
    seed('sending');
    const hook = setup({ resume: { serial: entry.serial } });
    await pickBackup(hook);
    await act(async () => hook.result.current.actions.onResumeConnect());
    await until(hook, () => !hook.result.current.view.busy);
    expect(hook.result.current.view.notice?.kind).toBe('resume-nothing-changed');
    expect(journal()).toHaveLength(0);
    expect((hoisted.fake as FakeD890Radio).allWrites()).toHaveLength(0);
  }, 120_000);

  it('from restored: straight to Check, no connect needed', async () => {
    hoisted.fake = changedRadio();
    seed('restored');
    const hook = setup({ resume: { serial: entry.serial } });
    await pickBackup(hook);
    expect(hook.result.current.view.resume.next).toBe('check');
    act(() => hook.result.current.actions.onResumeToCheck());
    expect(hook.result.current.view.step).toBe('check');
    expect(hoisted.opens).toBe(0);
  }, 120_000);

  it('a file whose hash is not the journal one is refused', async () => {
    seed('changed');
    const hook = setup({ resume: { serial: entry.serial } });
    const tampered = backupZip.slice();
    // Same zip, different bytes: append a byte past the end of the archive.
    const longer = new Uint8Array(tampered.length + 1);
    longer.set(tampered);
    expect(await sha256Hex(longer)).not.toBe(entry.backup.sha256);
    await pickBackup(hook, longer);
    expect(hook.result.current.view.resume.fileOk).toBe(false);
    expect(hook.result.current.view.notice?.kind).toBe('resume-wrong-file');
  }, 120_000);

  it('a different serial in the journal than in the file is refused', async () => {
    window.localStorage.setItem(
      RANGE_CHANGE_JOURNAL_KEY,
      JSON.stringify([{ ...entry, serial: 'TESTSERIAL02' }]),
    );
    resetRangeChangeJournalCache();
    const hook = setup({ resume: { serial: 'TESTSERIAL02' } });
    await pickBackup(hook);
    expect(hook.result.current.view.notice?.kind).toBe('resume-wrong-serial');
  }, 120_000);

  it('a file that is not a backup is refused', async () => {
    seed('changed');
    const hook = setup({ resume: { serial: entry.serial } });
    await pickBackup(hook, new Uint8Array([1, 2, 3]));
    expect(hook.result.current.view.notice?.kind).toBe('resume-bad-file');
  });

  it('the wrong radio connected is refused', async () => {
    const f = changedRadio();
    const li = f.getBytes(LOCAL_INFO, 0x100);
    li.set(new TextEncoder().encode('TESTSERIAL02'), 0x30);
    f.setBytes(LOCAL_INFO, li);
    hoisted.fake = f;
    seed('changed');
    const hook = setup({ resume: { serial: entry.serial } });
    await pickBackup(hook);
    await act(async () => hook.result.current.actions.onResumeConnect());
    await until(hook, () => !hook.result.current.view.busy);
    expect(hook.result.current.view.notice?.kind).toBe('wrong-radio');
    expect(hook.result.current.view.step).toBe('resume');
  }, 120_000);

  describe('without a journal ("Finish a range change from a backup file")', () => {
    it('the radio is already on the zip range: use Backup / Restore', async () => {
      hoisted.fake = new FakeD890Radio(3);
      const hook = setup({ resume: { serial: 'file' } });
      await pickBackup(hook);
      await act(async () => hook.result.current.actions.onResumeConnect());
      await until(hook, () => !hook.result.current.view.busy);
      expect(hook.result.current.view.notice?.kind).toBe('resume-same-range');
      expect(hook.result.current.view.notice?.body).toMatch(/Use Backup \/ Restore/);
      expect((hoisted.fake as FakeD890Radio).allWrites()).toHaveLength(0);
    }, 120_000);

    it('a different range: the step 6 checklist (no tune check) and Restore', async () => {
      hoisted.fake = changedRadio();
      const hook = setup({ resume: { serial: 'file' } });
      await pickBackup(hook);
      await act(async () => hook.result.current.actions.onResumeConnect());
      await until(hook, () => !hook.result.current.view.busy);
      expect(hook.result.current.view.step).toBe('restart');
      expect(hook.result.current.view.restart.verified).toBe(true);
      expect(
        hook.result.current.view.restart.checklist.find((c) => c.id === 'calibration')?.text,
      ).toMatch(/not compared/);
      await act(async () => hook.result.current.actions.onRestore());
      await until(hook, () => hook.result.current.view.step === 'check');
      // No journal existed, so none is written.
      expect(journal()).toHaveLength(0);
    }, 180_000);

    it('the serial of the radio differs from the zip', async () => {
      const f = changedRadio();
      const li = f.getBytes(LOCAL_INFO, 0x100);
      li.set(new TextEncoder().encode('TESTSERIAL02'), 0x30);
      f.setBytes(LOCAL_INFO, li);
      hoisted.fake = f;
      const hook = setup({ resume: { serial: 'file' } });
      await pickBackup(hook);
      await act(async () => hook.result.current.actions.onResumeConnect());
      await until(hook, () => !hook.result.current.view.busy);
      expect(hook.result.current.view.notice?.kind).toBe('wrong-radio');
    }, 120_000);
  });
});
