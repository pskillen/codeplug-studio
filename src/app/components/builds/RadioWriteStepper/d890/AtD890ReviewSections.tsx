/**
 * AT-D890UV Review sections (#1393, workflow design §2.4): the frequency range row, the
 * receive-only channel warning, Radio settings (now → after, with the fleet choice), the backup
 * nudge and the MM9PDY step-key nudge. Registered for the D890 descriptor when this module loads.
 */

import { useSyncExternalStore, type ReactNode } from 'react';
import { Text } from '@mantine/core';
import { Button, SegmentedControl, StatusBanner } from '../../../v2/index.ts';
import { useAtD890RadioSettingsSession } from '../../../../state/atD890RadioSettingsSession.ts';
import { changesLabel } from '../../../../lib/atD890RadioSettingsText.ts';
import Mm9pdyStepKeysNudge from '../../Mm9pdyStepKeysNudge.tsx';
import { Section } from '../reviewSectionParts.tsx';
import type { ReviewContext } from '../reviewSections.tsx';
import { type AtD890ReviewController, type AtD890ReviewState } from './atD890ReviewController.ts';
import { atD890SettingChanges } from './atD890ReviewFacts.ts';
import dClasses from './AtD890ReviewSections.module.css';

function useReviewState(controller: AtD890ReviewController): AtD890ReviewState {
  return useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
}

/** "⚠ M channels are receive-only on this radio (range: …)" with an expandable list. */
export function AtD890ReceiveOnlyNote({ controller }: { controller: AtD890ReviewController }) {
  const { receiveOnly, range } = controller.init;
  if (receiveOnly.length === 0) return null;
  return (
    <div className={dClasses.warn} data-testid="d890-receive-only">
      <StatusBanner tone="warning">
        {receiveOnly.length === 1
          ? `⚠ 1 channel is receive-only on this radio (range: ${range.caption}).`
          : `⚠ ${receiveOnly.length} channels are receive-only on this radio (range: ${range.caption}).`}{' '}
        They are written anyway: the radio listens on them and refuses to transmit.
      </StatusBanner>
      <details className={dClasses.list}>
        <summary>Show the channels</summary>
        <ul>
          {receiveOnly.map((c) => (
            <li key={c.slotIndex}>
              {c.slotIndex} {c.name} · TX {c.txMhz.toFixed(5)} MHz
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

function SettingsSection({ controller }: { controller: AtD890ReviewController }) {
  const state = useReviewState(controller);
  const store = useAtD890RadioSettingsSession(controller.init.buildId);
  const init = controller.init;
  if (!state.settingsTicked) return null;
  const overrides = [...store.overrides].map(([fieldId, value]) => ({ fieldId, value }));
  const changes = atD890SettingChanges(init.snapshot, init.target, overrides);
  return (
    <Section title="Radio settings">
      <div className={dClasses.stack} data-testid="d890-settings-review">
        {changes.length === 0 ? (
          <Text size="sm">This radio already has the settings you chose.</Text>
        ) : (
          <>
            <Text size="sm">{changesLabel(changes.length)} on this radio:</Text>
            <ul className={dClasses.changes}>
              {changes.map((c) => (
                <li key={c.fieldId}>
                  <span className={dClasses.changeLabel}>{c.label}</span>
                  <span className={dClasses.changeValues}>
                    {c.now} → {c.after}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        {init.sameRadio ? (
          <Text size="xs" c="dimmed">
            This is the radio you read the settings from.
          </Text>
        ) : (
          <div className={dClasses.choice} data-testid="d890-settings-choice">
            <Text size="sm">
              {store.read
                ? "This isn't the radio you read settings from."
                : "You haven't read a radio's settings this session."}{' '}
              {init.masterIdName ? `${init.masterIdName} ` : ''}({init.serial})
            </Text>
            <SegmentedControl
              size="sm"
              aria-label="Radio settings for this radio"
              value={state.choice}
              onChange={(value) => controller.setChoice(value)}
              options={[
                { value: 'apply', label: 'Apply' },
                { value: 'keep', label: 'Keep its settings' },
              ]}
            />
            {init.applyToEveryRadio ? (
              <Text size="xs" c="dimmed">
                Apply is preselected because you chose not to be asked again until you reload.
              </Text>
            ) : null}
            {init.settingsOnly && state.choice === 'keep' ? (
              <Text size="xs" c="dimmed">
                Radio settings is the only part ticked, so Keep writes nothing. Choose Apply to
                write them.
              </Text>
            ) : null}
            <div className={dClasses.actions}>
              <Button variant="outline" size="sm" onClick={init.onReviewSettings}>
                Review its settings
              </Button>
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

function StepKeysNudge({ controller }: { controller: AtD890ReviewController }) {
  const init = controller.init;
  const store = useAtD890RadioSettingsSession(init.buildId);
  const decoded = init.decoded;
  const num = (v: unknown) => (typeof v === 'number' ? v : undefined);
  return (
    <Mm9pdyStepKeysNudge
      target={init.target}
      hasRead
      readP1={num(decoded.keyShortP1?.value)}
      readP2={num(decoded.keyShortP2?.value)}
      overrideP1={store.overrides.get('keyShortP1')}
      overrideP2={store.overrides.get('keyShortP2')}
      onUse={init.onUseStepKeys}
    />
  );
}

function BackupSection({ controller }: { controller: AtD890ReviewController }) {
  const state = useReviewState(controller);
  const init = controller.init;
  const b = state.backup;
  let body: ReactNode;
  if (b.status === 'saved') {
    body = (
      <Text size="sm" data-testid="d890-backup-saved">
        ✓ Backup saved{' '}
        {new Date(b.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </Text>
    );
  } else {
    const label = init.fullReadHeld
      ? 'Save backup now'
      : `Read the rest of the radio and save a backup${
          init.readRestSeconds != null ? ` (about ${init.readRestSeconds} s)` : ''
        }`;
    const busy = b.status === 'reading' || b.status === 'saving';
    body = (
      <>
        <Text size="sm">No backup of this radio this session.</Text>
        <div className={dClasses.actions}>
          <Button variant="outline" size="sm" disabled={busy} onClick={init.onSaveBackup}>
            {b.status === 'reading'
              ? 'Reading the radio…'
              : b.status === 'saving'
                ? 'Saving…'
                : label}
          </Button>
        </div>
        {b.status === 'error' ? (
          <Text size="xs" c="red">
            {b.message}
          </Text>
        ) : null}
      </>
    );
  }
  return (
    <Section title="Backup">
      <div className={dClasses.stack}>{body}</div>
    </Section>
  );
}

/** The D890's extra sections, in order. The nudge hides itself on the stock target. */
export function atD890ReviewSections(ctx: ReviewContext): ReactNode[] {
  const controller = ctx.atD890;
  if (!controller) return [];
  return [
    <StepKeysNudge key="nudge" controller={controller} />,
    <SettingsSection key="settings" controller={controller} />,
    <BackupSection key="backup" controller={controller} />,
  ];
}
