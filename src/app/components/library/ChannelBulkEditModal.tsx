import { useMemo, useState } from 'react';
import { Alert, Box, Collapse, Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconChevronDown, IconChevronRight, IconPencil } from '@tabler/icons-react';
import type {
  AnalogSquelchModeOverride,
  ForbidTransmitOverride,
  SendTalkerAliasOverride,
  TxPermitOverride,
} from '@core/models/channelBehaviourDefaults.ts';
import type { Channel, ScanInclusion } from '@core/models/library.ts';
import {
  analyzeChannelBulkEditImpact,
  countChannelsWithAnalogProfile,
  countChannelsWithDmrProfile,
  sharedAnalogField,
  sharedChannelField,
  sharedDmrField,
  type ChannelBulkEditPatch,
} from '@core/domain/channelBulkEdit.ts';
import ForbidTransmitSegment from '../channels/ForbidTransmitSegment.tsx';
import TxPermitSegment from '../channels/TxPermitSegment.tsx';
import SendTalkerAliasSegment from '../channels/SendTalkerAliasSegment.tsx';
import AnalogSquelchModeSegment from '../channels/AnalogSquelchModeSegment.tsx';
import ScanInclusionSegment from '../channels/ScanInclusionSegment.tsx';
import { PercentLevelSlider, formatPercentLevelLabel } from '../v2/index.ts';
import { Button, ConfirmModal, ModalShell, Panel } from '../v2/index.ts';
import { ICON_SIZE_ACTION, ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import {
  persistChannelBulkEdit,
  type PersistChannelBulkEditSuccess,
} from '../../lib/channelBulkEdit.ts';
import {
  persistChannelBulkDelete,
  type PersistChannelBulkDeleteOutcome,
} from '../../lib/channelBulkDelete.ts';
import { BULK_IDLE_OPTION, bulkSegmentValue, changeBadge } from '../../lib/bulkEditIdle.ts';
import type { DeleteOutcome } from '../../state/libraryService.ts';
import { persistence } from '../../state/persistence.ts';
import BulkEditField from './BulkEditField.tsx';
import classes from './ChannelBulkEditModal.module.css';

export interface ChannelBulkEditModalProps {
  opened: boolean;
  onClose: () => void;
  channels: Channel[];
  projectId: string | null;
  deleteEntity: (kind: 'channel', id: string) => Promise<DeleteOutcome>;
  reload: () => Promise<void>;
  onApplied?: (outcome: PersistChannelBulkEditSuccess) => void;
  onDeleted?: (outcome: PersistChannelBulkDeleteOutcome) => void;
}

interface BulkEditFormState {
  changeScanInclusion: boolean;
  scanInclusion: ScanInclusion;
  changeForbidTransmit: boolean;
  forbidTransmit: ForbidTransmitOverride;
  changeTxPermit: boolean;
  txPermit: TxPermitOverride;
  changeSendTalkerAlias: boolean;
  sendTalkerAlias: SendTalkerAliasOverride;
  changeAnalogSquelchMode: boolean;
  analogSquelchMode: AnalogSquelchModeOverride;
  changePower: boolean;
  power: number | null;
  changeAnalogSquelch: boolean;
  analogSquelch: number | null;
}

type ModalView = 'edit' | 'confirmDelete';

function initialFormFromChannels(channels: Channel[]): BulkEditFormState {
  return {
    changeScanInclusion: false,
    scanInclusion: sharedChannelField(channels, (channel) => channel.scanInclusion) ?? 'default',
    changeForbidTransmit: false,
    forbidTransmit:
      sharedChannelField(channels, (channel) => channel.forbidTransmit) ?? 'default',
    changeTxPermit: false,
    txPermit: sharedChannelField(channels, (channel) => channel.txPermit) ?? 'default',
    changeSendTalkerAlias: false,
    sendTalkerAlias:
      sharedDmrField(channels, (profile) => profile.sendTalkerAlias ?? 'default') ?? 'default',
    changeAnalogSquelchMode: false,
    analogSquelchMode:
      sharedAnalogField(channels, (profile) => profile.analogSquelchMode ?? 'default') ??
      'default',
    changePower: false,
    power: sharedChannelField(channels, (channel) => channel.power) ?? null,
    changeAnalogSquelch: false,
    analogSquelch: sharedAnalogField(channels, (profile) => profile.squelch) ?? null,
  };
}

function buildPatchFromForm(form: BulkEditFormState): ChannelBulkEditPatch {
  const patch: ChannelBulkEditPatch = {};
  if (form.changeScanInclusion) patch.scanInclusion = form.scanInclusion;
  if (form.changeForbidTransmit) patch.forbidTransmit = form.forbidTransmit;
  if (form.changeTxPermit) patch.txPermit = form.txPermit;
  if (form.changeSendTalkerAlias) patch.sendTalkerAlias = form.sendTalkerAlias;
  if (form.changeAnalogSquelchMode) patch.analogSquelchMode = form.analogSquelchMode;
  if (form.changePower) patch.power = form.power;
  if (form.changeAnalogSquelch) patch.analogSquelch = form.analogSquelch;
  return patch;
}

function channelLevelImpactText(appliesTo: number): string {
  return `Applies to all ${appliesTo} selected channel${appliesTo === 1 ? '' : 's'}`;
}

function analogImpactText(appliesTo: number, skipped: number, total: number): string {
  const base = `Applies to ${appliesTo} of ${total} selected channel${total === 1 ? '' : 's'}`;
  if (skipped <= 0) return base;
  return `${base}. ${skipped} channel${skipped === 1 ? '' : 's'} have no analog mode and will be skipped`;
}

function dmrImpactText(appliesTo: number, skipped: number, total: number): string {
  const base = `Applies to ${appliesTo} of ${total} selected channel${total === 1 ? '' : 's'}`;
  if (skipped <= 0) return base;
  return `${base}. ${skipped} channel${skipped === 1 ? '' : 's'} have no DMR mode and will be skipped`;
}

export default function ChannelBulkEditModal({
  opened,
  onClose,
  channels,
  projectId,
  deleteEntity,
  reload,
  onApplied,
  onDeleted,
}: ChannelBulkEditModalProps) {
  const sessionKey = channels.map((channel) => channel.id).join(',');

  if (!opened) return null;

  return (
    <ChannelBulkEditModalBody
      key={sessionKey}
      channels={channels}
      projectId={projectId}
      deleteEntity={deleteEntity}
      reload={reload}
      onClose={onClose}
      onApplied={onApplied}
      onDeleted={onDeleted}
    />
  );
}

function ChannelBulkEditModalBody({
  channels,
  projectId,
  deleteEntity,
  reload,
  onClose,
  onApplied,
  onDeleted,
}: {
  channels: Channel[];
  projectId: string | null;
  deleteEntity: (kind: 'channel', id: string) => Promise<DeleteOutcome>;
  reload: () => Promise<void>;
  onClose: () => void;
  onApplied?: (outcome: PersistChannelBulkEditSuccess) => void;
  onDeleted?: (outcome: PersistChannelBulkDeleteOutcome) => void;
}) {
  const [view, setView] = useState<ModalView>('edit');
  const [form, setForm] = useState<BulkEditFormState>(() => initialFormFromChannels(channels));
  const [showChannelList, setShowChannelList] = useState(false);
  const [applying, setApplying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const shared = useMemo(
    () => ({
      scanInclusion: sharedChannelField(channels, (channel) => channel.scanInclusion),
      forbidTransmit: sharedChannelField(channels, (channel) => channel.forbidTransmit),
      txPermit: sharedChannelField(channels, (channel) => channel.txPermit),
      power: sharedChannelField(channels, (channel) => channel.power),
      sendTalkerAlias: sharedDmrField(
        channels,
        (profile) => profile.sendTalkerAlias ?? 'default',
      ),
      analogSquelchMode: sharedAnalogField(
        channels,
        (profile) => profile.analogSquelchMode ?? 'default',
      ),
      analogSquelch: sharedAnalogField(channels, (profile) => profile.squelch),
    }),
    [channels],
  );

  const patch = useMemo(() => buildPatchFromForm(form), [form]);
  const hasChanges = Object.keys(patch).length > 0;
  const impact = useMemo(
    () => (hasChanges ? analyzeChannelBulkEditImpact(channels, patch) : {}),
    [channels, hasChanges, patch],
  );
  const analogChannelCount = useMemo(() => countChannelsWithAnalogProfile(channels), [channels]);
  const dmrChannelCount = useMemo(() => countChannelsWithDmrProfile(channels), [channels]);
  const showAnalogFields = analogChannelCount > 0;
  const showDmrFields = dmrChannelCount > 0;
  const showModeSettings = showAnalogFields || showDmrFields;
  const busy = applying || deleting;
  const total = channels.length;

  const rfChangeCount =
    Number(form.changeForbidTransmit) + Number(form.changeTxPermit) + Number(form.changePower);
  const modeChangeCount =
    Number(form.changeSendTalkerAlias) +
    Number(form.changeAnalogSquelchMode) +
    Number(form.changeAnalogSquelch);
  const scanningChangeCount = Number(form.changeScanInclusion);

  const handleApply = async () => {
    if (!hasChanges || busy) return;
    setApplying(true);
    setErrorMessage(null);
    try {
      const outcome = await persistChannelBulkEdit({
        persistence,
        channels,
        patch,
      });
      if (!outcome.ok) {
        setErrorMessage(outcome.message);
        return;
      }
      onApplied?.(outcome);
      onClose();
    } finally {
      setApplying(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!projectId || busy) return;
    setDeleting(true);
    setErrorMessage(null);
    try {
      const outcome = await persistChannelBulkDelete({
        projectId,
        channels,
        deleteEntity,
        reload,
      });

      if (outcome.deletedCount > 0) {
        onDeleted?.(outcome);
      }

      if (outcome.failures.length === 0) {
        onClose();
        return;
      }

      if (outcome.deletedCount === 0) {
        setErrorMessage(
          outcome.failures.map((failure) => `${failure.channelName}: ${failure.message}`).join(' '),
        );
        setView('edit');
        return;
      }

      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <ModalShell
        open={view === 'edit'}
        onClose={onClose}
        title="Bulk edit channels"
        icon={<IconPencil size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />}
        iconTone="accent"
        size="lg"
        dismissible={!busy}
        footer={
          <div className={classes.footer}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setErrorMessage(null);
                setView('confirmDelete');
              }}
              disabled={busy || !projectId}
            >
              Delete {total} channel{total === 1 ? '' : 's'}
            </Button>
            <div className={classes.footerActions}>
              <Button variant="secondary" size="sm" onClick={onClose} disabled={busy}>
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => void handleApply()}
                disabled={!hasChanges || busy}
              >
                {applying ? 'Applying…' : `Apply to ${total} channel${total === 1 ? '' : 's'}`}
              </Button>
            </div>
          </div>
        }
      >
        <div className={classes.banner}>
          <strong>
            {total} channel{total === 1 ? '' : 's'} selected.
          </strong>{' '}
          Fields start as <strong>No change</strong>. Pick a value to apply it — an outline marks a
          setting every selected channel already shares.
        </div>

        <Stack gap="md">
          <UnstyledButton
            onClick={() => setShowChannelList((v) => !v)}
            aria-expanded={showChannelList}
          >
            <Group gap={6} wrap="nowrap">
              {showChannelList ? (
                <IconChevronDown size={ICON_SIZE_NAV} stroke={ICON_STROKE} />
              ) : (
                <IconChevronRight size={ICON_SIZE_NAV} stroke={ICON_STROKE} />
              )}
              <Text size="sm" c="dimmed">
                View selected channels
              </Text>
            </Group>
          </UnstyledButton>

          <Collapse expanded={showChannelList}>
            <Box mah={160} style={{ overflowY: 'auto' }} pt="xs">
              <Stack gap={4}>
                {channels.map((channel) => (
                  <Text key={channel.id} size="sm">
                    {channel.name || 'Untitled'}
                    {channel.callsign ? (
                      <Text component="span" c="dimmed" inherit>
                        {' '}
                        · {channel.callsign}
                      </Text>
                    ) : null}
                  </Text>
                ))}
              </Stack>
            </Box>
          </Collapse>

          <Panel title="RF" collapsible badge={changeBadge(rfChangeCount)}>
            <Stack gap="md">
            <div className={classes.pairRow}>
              <ForbidTransmitSegment
                value={bulkSegmentValue(form.changeForbidTransmit, form.forbidTransmit)}
                onChange={(forbidTransmit) =>
                  setForm((prev) => ({ ...prev, changeForbidTransmit: true, forbidTransmit }))
                }
                onIdle={() => setForm((prev) => ({ ...prev, changeForbidTransmit: false }))}
                idleOption={BULK_IDLE_OPTION}
                sharedValue={shared.forbidTransmit}
                layout="row"
              />
              <TxPermitSegment
                value={bulkSegmentValue(form.changeTxPermit, form.txPermit)}
                onChange={(txPermit) =>
                  setForm((prev) => ({ ...prev, changeTxPermit: true, txPermit }))
                }
                onIdle={() => setForm((prev) => ({ ...prev, changeTxPermit: false }))}
                idleOption={BULK_IDLE_OPTION}
                sharedValue={shared.txPermit}
                layout="row"
              />
            </div>
            {form.changeForbidTransmit && impact.forbidTransmit ? (
              <Text size="xs" c="dimmed">
                {channelLevelImpactText(impact.forbidTransmit.appliesTo)}
              </Text>
            ) : null}
            {form.changeTxPermit && impact.txPermit ? (
              <Text size="xs" c="dimmed">
                {channelLevelImpactText(impact.txPermit.appliesTo)}
              </Text>
            ) : null}
            <BulkEditField
              optedIn={form.changePower}
              onOptedInChange={(changePower) => setForm((prev) => ({ ...prev, changePower }))}
              sharedHint={
                shared.power !== undefined
                  ? formatPercentLevelLabel(shared.power)
                  : undefined
              }
            >
              <PercentLevelSlider
                label="Power"
                value={form.power}
                onChange={(power) => setForm((prev) => ({ ...prev, power }))}
              />
            </BulkEditField>
            {form.changePower && impact.power ? (
              <Text size="xs" c="dimmed">
                {channelLevelImpactText(impact.power.appliesTo)}
              </Text>
            ) : null}
            </Stack>
          </Panel>

          {showModeSettings ? (
            <Panel
              title="Mode settings"
              collapsible
              defaultCollapsed
              badge={changeBadge(modeChangeCount)}
            >
              <Stack gap="md">
                {showDmrFields ? (
                  <>
                    <SendTalkerAliasSegment
                      value={bulkSegmentValue(form.changeSendTalkerAlias, form.sendTalkerAlias)}
                      onChange={(sendTalkerAlias) =>
                        setForm((prev) => ({
                          ...prev,
                          changeSendTalkerAlias: true,
                          sendTalkerAlias,
                        }))
                      }
                      onIdle={() =>
                        setForm((prev) => ({ ...prev, changeSendTalkerAlias: false }))
                      }
                      idleOption={BULK_IDLE_OPTION}
                      sharedValue={shared.sendTalkerAlias}
                      layout="row"
                    />
                    {form.changeSendTalkerAlias && impact.sendTalkerAlias ? (
                      <Text size="xs" c="dimmed">
                        {dmrImpactText(
                          impact.sendTalkerAlias.appliesTo,
                          impact.sendTalkerAlias.skipped,
                          total,
                        )}
                      </Text>
                    ) : null}
                  </>
                ) : null}
                {showAnalogFields ? (
                  <>
                    <AnalogSquelchModeSegment
                      value={bulkSegmentValue(
                        form.changeAnalogSquelchMode,
                        form.analogSquelchMode,
                      )}
                      onChange={(analogSquelchMode) =>
                        setForm((prev) => ({
                          ...prev,
                          changeAnalogSquelchMode: true,
                          analogSquelchMode,
                        }))
                      }
                      onIdle={() =>
                        setForm((prev) => ({ ...prev, changeAnalogSquelchMode: false }))
                      }
                      idleOption={BULK_IDLE_OPTION}
                      sharedValue={shared.analogSquelchMode}
                      layout="row"
                    />
                    {form.changeAnalogSquelchMode && impact.analogSquelchMode ? (
                      <Text size="xs" c="dimmed">
                        {analogImpactText(
                          impact.analogSquelchMode.appliesTo,
                          impact.analogSquelchMode.skipped,
                          total,
                        )}
                      </Text>
                    ) : null}
                    <BulkEditField
                      optedIn={form.changeAnalogSquelch}
                      onOptedInChange={(changeAnalogSquelch) =>
                        setForm((prev) => ({ ...prev, changeAnalogSquelch }))
                      }
                      sharedHint={
                        shared.analogSquelch !== undefined
                          ? formatPercentLevelLabel(shared.analogSquelch, {
                              zeroLabel: 'Open (0%)',
                            })
                          : undefined
                      }
                    >
                      <PercentLevelSlider
                        label="Squelch"
                        value={form.analogSquelch}
                        onChange={(analogSquelch) =>
                          setForm((prev) => ({ ...prev, analogSquelch }))
                        }
                        zeroLabel="Open (0%)"
                      />
                    </BulkEditField>
                    {form.changeAnalogSquelch && impact.analogSquelch ? (
                      <Text size="xs" c="dimmed">
                        {analogImpactText(
                          impact.analogSquelch.appliesTo,
                          impact.analogSquelch.skipped,
                          total,
                        )}
                      </Text>
                    ) : null}
                  </>
                ) : null}
              </Stack>
            </Panel>
          ) : null}

          <Panel title="Scanning" collapsible badge={changeBadge(scanningChangeCount)}>
            <Stack gap="md">
            <ScanInclusionSegment
              value={bulkSegmentValue(form.changeScanInclusion, form.scanInclusion)}
              onChange={(scanInclusion) =>
                setForm((prev) => ({ ...prev, changeScanInclusion: true, scanInclusion }))
              }
              onIdle={() => setForm((prev) => ({ ...prev, changeScanInclusion: false }))}
              idleOption={BULK_IDLE_OPTION}
              sharedValue={shared.scanInclusion}
              layout="row"
            />
            {form.changeScanInclusion && impact.scanInclusion ? (
              <Text size="xs" c="dimmed">
                {channelLevelImpactText(impact.scanInclusion.appliesTo)}
              </Text>
            ) : null}
            </Stack>
          </Panel>

          {!hasChanges ? (
            <Text size="sm" c="dimmed">
              Choose at least one value above to apply. Leave the rest on No change.
            </Text>
          ) : null}

          {errorMessage ? <Alert color="red">{errorMessage}</Alert> : null}
        </Stack>
      </ModalShell>

      <ConfirmModal
        open={view === 'confirmDelete'}
        onClose={() => setView('edit')}
        onConfirm={() => void handleConfirmDelete()}
        title={`Delete ${total} channel${total === 1 ? '' : 's'}?`}
        tone="destructive"
        busy={deleting}
        confirmLabel={`Delete ${total} channel${total === 1 ? '' : 's'}`}
      >
        <Stack gap="sm">
          <Text size="sm">This cannot be undone.</Text>
          <Text size="sm" c="dimmed">
            Channels that are only in zones will be removed from those zones first. Channels
            referenced by scan lists or other entities cannot be deleted until those references are
            cleared.
          </Text>
          {errorMessage ? <Alert color="red">{errorMessage}</Alert> : null}
        </Stack>
      </ConfirmModal>
    </>
  );
}
