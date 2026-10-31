/**
 * RT95 Review sections (#1476): radio settings now → after, backup reminder, MM9PDY zones block.
 */

import { useSyncExternalStore, type ReactNode } from 'react';
import { Text } from '@mantine/core';
import { Button, SegmentedControl } from '../../../v2/index.ts';
import { useRt95RadioSettingsSession } from '../../../../state/rt95RadioSettingsSession.ts';
import { changesLabel } from '../../../../lib/rt95RadioSettingsText.ts';
import Rt95ZoneKeyNudge from '../../Rt95ZoneKeyNudge.tsx';
import { Section } from '../reviewSectionParts.tsx';
import type { ReviewContext } from '../reviewSections.tsx';
import {
  createRt95ReviewController,
  type Rt95ReviewController,
  type Rt95ReviewState,
} from './rt95ReviewController.ts';
import { rt95SettingChanges } from './rt95ReviewFacts.ts';
import dClasses from '../d890/AtD890ReviewSections.module.css';

function useReviewState(controller: Rt95ReviewController): Rt95ReviewState {
  return useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
}

function SettingsSection({ controller }: { controller: Rt95ReviewController }) {
  const state = useReviewState(controller);
  const store = useRt95RadioSettingsSession(controller.init.buildId);
  const init = controller.init;
  if (!state.settingsTicked) return null;
  const overrides = [...store.overrides].map(([fieldId, value]) => ({ fieldId, value }));
  const changes = rt95SettingChanges(init.snapshot, init.target, overrides);
  return (
    <Section title="Radio settings">
      <div className={dClasses.stack} data-testid="rt95-settings-review">
        {changes.length === 0 ? (
          <Text size="sm">This radio already has the settings you chose.</Text>
        ) : (
          <>
            <Text size="sm">{changesLabel(changes.length)} on this radio:</Text>
            <ul className={dClasses.changes}>
              {changes.map((c) => (
                <li key={c.fieldId}>
                  <span className={dClasses.changeLabel}>
                    {c.label}
                    {c.advanced ? ' (advanced)' : ''}
                  </span>
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
            This radio matches the band limit of the settings you read (RT95 has no serial in
            Studio).
          </Text>
        ) : (
          <div className={dClasses.choice} data-testid="rt95-settings-choice">
            <Text size="sm">
              {!store.read
                ? "You haven't read a radio's settings this session."
                : "This radio's band limit code does not match the settings you read."}{' '}
              (read: {store.read?.bandlimit ?? '—'}, this radio: {init.bandlimit})
            </Text>
            <SegmentedControl
              size="sm"
              aria-label="Radio settings for this radio"
              value={state.choice}
              onChange={(value) => controller.setChoice(value as 'apply' | 'keep')}
              options={[
                { value: 'apply', label: 'Apply' },
                { value: 'keep', label: 'Keep its settings' },
              ]}
            />
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
        <Text size="xs" c="dimmed">
          Back up the radio before changing advanced settings (password, remote stun/kill).
        </Text>
      </div>
    </Section>
  );
}

function BackupSection({ controller }: { controller: Rt95ReviewController }) {
  const state = useReviewState(controller);
  const b = state.backup;
  if (b.status === 'saved') {
    return (
      <Section title="Backup">
        <Text size="sm" data-testid="rt95-backup-saved">
          ✓ Backup saved{' '}
          {new Date(b.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </Section>
    );
  }
  return (
    <Section title="Backup">
      <Text size="sm">No backup of this radio this session.</Text>
      <Text size="xs" c="dimmed">
        Use Backup / Restore on this build before writing password or remote-control codes.
      </Text>
    </Section>
  );
}

function Mm9pdyModDataSection({
  modData,
}: {
  modData: NonNullable<NonNullable<ReviewContext['rt95']>['modData']>;
}) {
  return (
    <Section key="rt95-mmd1" title="Zones and descriptions">
      <Text size="sm">Radio memory: 32 KiB, zones and descriptions can be written.</Text>
      <Text size="sm">
        {modData.zones === 1 ? '1 zone' : `${modData.zones} zones`} and{' '}
        {modData.descriptions === 1
          ? '1 channel description'
          : `${modData.descriptions} channel descriptions`}{' '}
        will be written.
      </Text>
      {modData.zoneKey ? (
        <Text size="sm">
          Zone key: P{modData.zoneKey.key}, FUNC group {modData.zoneKey.group}. Written as DIR; the
          radio shows ZON.
        </Text>
      ) : null}
      <Rt95ZoneKeyNudge zones={modData.zones} zoneKeySet={modData.zoneKey !== undefined} />
    </Section>
  );
}

export function rt95ReviewSections(ctx: ReviewContext): ReactNode[] {
  const rt95 = ctx.rt95;
  if (!rt95) return [];
  const out: ReactNode[] = [];
  if (rt95.settings) {
    out.push(<SettingsSection key="settings" controller={rt95.settings} />);
    out.push(<BackupSection key="backup" controller={rt95.settings} />);
  }
  if (rt95.modData) {
    out.push(<Mm9pdyModDataSection key="mmd1" modData={rt95.modData} />);
  }
  return out;
}

export { createRt95ReviewController };
