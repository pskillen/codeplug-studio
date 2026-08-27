import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Alert, Box, Collapse, Group, Select, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconChevronDown, IconChevronRight, IconPencil } from '@tabler/icons-react';
import type {
  AnalogSquelchModeOverride,
  ForbidTransmitOverride,
  SendTalkerAliasOverride,
  TxPermitOverride,
} from '@core/models/channelBehaviourDefaults.ts';
import type { AprsPttMode, AprsReportType } from '@core/models/libraryTypes.ts';
import type { Channel, ChannelTone, Library, ScanInclusion } from '@core/models/library.ts';
import { nestedOnlyZoneMembershipsForChannels } from '@core/domain/zoneMembership.ts';
import { isAnalogChannelModeProfile } from '@core/domain/modeProfiles.ts';
import {
  aprsChannelBulkPatchHasChanges,
  type AprsChannelBulkPatch,
} from '@core/domain/aprs/index.ts';
import {
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
import GradientSegmentedControl, {
  GRADIENT_SEGMENT_IDLE_VALUE,
} from '../ui/GradientSegmentedControl.tsx';
import { PercentLevelSlider } from '../v2/index.ts';
import { Button, ConfirmModal, ModalShell, Panel } from '../v2/index.ts';
import { ICON_SIZE_ACTION, ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import { persistChannelBulkEdit, type ChannelBulkApplyOutcome } from '../../lib/channelBulkEdit.ts';
import { persistChannelBulkZoneMembership } from '../../lib/channelBulkZoneMembership.ts';
import {
  persistChannelBulkDelete,
  type PersistChannelBulkDeleteOutcome,
} from '../../lib/channelBulkDelete.ts';
import {
  BULK_IDLE_OPTION,
  BULK_POWER_CUSTOM,
  BULK_POWER_DEFAULT,
  bulkPowerSegmentValue,
  bulkSegmentValue,
  changeBadge,
  sharedPowerSegmentValue,
} from '../../lib/bulkEditIdle.ts';
import { APRS_SLOT_NONE_VALUE, aprsSlotSelectOptions } from '../../lib/aprsBindingHelpers.ts';
import { NONE_TONE, toneSelectOptions } from '../../lib/channelFields/index.ts';
import { modalComboboxProps } from '../../theme.ts';
import type { DeleteOutcome } from '../../state/libraryService.ts';
import { persistence } from '../../state/persistence.ts';
import BulkEditField from './BulkEditField.tsx';
import BulkZonePickerColumn from './BulkZonePickerColumn.tsx';
import classes from './ChannelBulkEditModal.module.css';

export interface ChannelBulkEditModalProps {
  opened: boolean;
  onClose: () => void;
  channels: Channel[];
  projectId: string | null;
  library: Library;
  deleteEntity: (kind: 'channel', id: string) => Promise<DeleteOutcome>;
  reload: () => Promise<void>;
  onApplied?: (outcome: ChannelBulkApplyOutcome) => void;
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
  changeRxTone: boolean;
  rxTone: ChannelTone;
  changeTxTone: boolean;
  txTone: ChannelTone;
  changeAprsReceive: boolean;
  aprsReceiveEnabled: boolean;
  changeAprsReportType: boolean;
  aprsReportType: AprsReportType;
  changeAprsPtt: boolean;
  aprsDigitalPttMode: AprsPttMode;
  changeAprsSlot: boolean;
  aprsReportSlotIndex: number | null;
}

type ModalView = 'edit' | 'confirmDelete';

function initialFormFromChannels(channels: Channel[]): BulkEditFormState {
  return {
    changeScanInclusion: false,
    scanInclusion: sharedChannelField(channels, (channel) => channel.scanInclusion) ?? 'default',
    changeForbidTransmit: false,
    forbidTransmit: sharedChannelField(channels, (channel) => channel.forbidTransmit) ?? 'default',
    changeTxPermit: false,
    txPermit: sharedChannelField(channels, (channel) => channel.txPermit) ?? 'default',
    changeSendTalkerAlias: false,
    sendTalkerAlias:
      sharedDmrField(channels, (profile) => profile.sendTalkerAlias ?? 'default') ?? 'default',
    changeAnalogSquelchMode: false,
    analogSquelchMode:
      sharedAnalogField(channels, (profile) => profile.analogSquelchMode ?? 'default') ?? 'default',
    changePower: false,
    power: sharedChannelField(channels, (channel) => channel.power) ?? null,
    changeAnalogSquelch: false,
    analogSquelch: sharedAnalogField(channels, (profile) => profile.squelch) ?? null,
    changeRxTone: false,
    rxTone: sharedAnalogField(channels, (profile) => profile.rxTone) ?? NONE_TONE,
    changeTxTone: false,
    txTone: sharedAnalogField(channels, (profile) => profile.txTone) ?? NONE_TONE,
    changeAprsReceive: false,
    aprsReceiveEnabled:
      sharedChannelField(channels, (channel) => channel.aprs?.receiveEnabled ?? false) ?? false,
    changeAprsReportType: false,
    aprsReportType:
      sharedChannelField(channels, (channel) => channel.aprs?.reportType ?? 'off') ?? 'off',
    changeAprsPtt: false,
    aprsDigitalPttMode:
      sharedChannelField(channels, (channel) => channel.aprs?.digitalPttMode ?? 'off') ?? 'off',
    changeAprsSlot: false,
    aprsReportSlotIndex:
      sharedChannelField(channels, (channel) => channel.aprs?.reportSlotIndex ?? null) ?? null,
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
  if (form.changeRxTone) patch.rxTone = form.rxTone;
  if (form.changeTxTone) patch.txTone = form.txTone;
  const aprs = aprsPatchFromForm(form);
  if (aprs) patch.aprs = aprs;
  return patch;
}

function aprsPatchFromForm(form: BulkEditFormState): AprsChannelBulkPatch | undefined {
  const aprs: AprsChannelBulkPatch = {};
  if (form.changeAprsReceive) {
    aprs.patchReceiveEnabled = true;
    aprs.receiveEnabled = form.aprsReceiveEnabled;
  }
  if (form.changeAprsReportType) {
    aprs.patchReportType = true;
    aprs.reportType = form.aprsReportType;
  }
  if (form.changeAprsPtt) {
    aprs.patchDigitalPttMode = true;
    aprs.digitalPttMode = form.aprsDigitalPttMode;
  }
  if (form.changeAprsSlot) {
    aprs.patchReportSlot = true;
    aprs.reportSlotIndex = form.aprsReportSlotIndex;
  }
  return aprsChannelBulkPatchHasChanges(aprs) ? aprs : undefined;
}

function FieldGroup({ children }: { children: ReactNode }) {
  return <div className={classes.fieldGroup}>{children}</div>;
}

export default function ChannelBulkEditModal({
  opened,
  onClose,
  channels,
  projectId,
  library,
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
      library={library}
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
  library,
  deleteEntity,
  reload,
  onClose,
  onApplied,
  onDeleted,
}: {
  channels: Channel[];
  projectId: string | null;
  library: Library;
  deleteEntity: (kind: 'channel', id: string) => Promise<DeleteOutcome>;
  reload: () => Promise<void>;
  onClose: () => void;
  onApplied?: (outcome: ChannelBulkApplyOutcome) => void;
  onDeleted?: (outcome: PersistChannelBulkDeleteOutcome) => void;
}) {
  const [view, setView] = useState<ModalView>('edit');
  const [form, setForm] = useState<BulkEditFormState>(() => initialFormFromChannels(channels));
  const [addZoneIds, setAddZoneIds] = useState<string[]>([]);
  const [removeZoneIds, setRemoveZoneIds] = useState<string[]>([]);
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
      sendTalkerAlias: sharedDmrField(channels, (profile) => profile.sendTalkerAlias ?? 'default'),
      analogSquelchMode: sharedAnalogField(
        channels,
        (profile) => profile.analogSquelchMode ?? 'default',
      ),
      analogSquelch: sharedAnalogField(channels, (profile) => profile.squelch),
      rxTone: sharedAnalogField(channels, (profile) => profile.rxTone),
      txTone: sharedAnalogField(channels, (profile) => profile.txTone),
      aprsReceiveEnabled: sharedChannelField(
        channels,
        (channel) => channel.aprs?.receiveEnabled ?? false,
      ),
      aprsReportType: sharedChannelField(channels, (channel) => channel.aprs?.reportType ?? 'off'),
      aprsDigitalPttMode: sharedChannelField(
        channels,
        (channel) => channel.aprs?.digitalPttMode ?? 'off',
      ),
      aprsReportSlotIndex: sharedChannelField(
        channels,
        (channel) => channel.aprs?.reportSlotIndex ?? null,
      ),
    }),
    [channels],
  );

  const patch = useMemo(() => buildPatchFromForm(form), [form]);
  const hasChannelPatch = Object.keys(patch).length > 0;
  const hasZoneChanges = addZoneIds.length > 0 || removeZoneIds.length > 0;
  const hasChanges = hasChannelPatch || hasZoneChanges;
  const analogChannelCount = useMemo(() => countChannelsWithAnalogProfile(channels), [channels]);
  const dmrChannelCount = useMemo(() => countChannelsWithDmrProfile(channels), [channels]);
  const total = channels.length;
  const showAnalogFields = analogChannelCount > 0;
  const showDmrFields = dmrChannelCount > 0;
  const showModeSettings = showAnalogFields || showDmrFields;
  const busy = applying || deleting;

  const rfChangeCount =
    Number(form.changeForbidTransmit) + Number(form.changeTxPermit) + Number(form.changePower);
  const modeChangeCount =
    Number(form.changeSendTalkerAlias) +
    Number(form.changeAnalogSquelchMode) +
    Number(form.changeAnalogSquelch) +
    Number(form.changeRxTone) +
    Number(form.changeTxTone);
  const scanningChangeCount = Number(form.changeScanInclusion);
  const zoneChangeCount = addZoneIds.length + removeZoneIds.length;
  const aprsChangeCount =
    Number(form.changeAprsReceive) +
    Number(form.changeAprsReportType) +
    Number(form.changeAprsPtt) +
    Number(form.changeAprsSlot);

  const slotOptions = useMemo(
    () => aprsSlotSelectOptions(library.aprsConfiguration?.channelSlots ?? [], library.channels),
    [library.aprsConfiguration?.channelSlots, library.channels],
  );
  const slotsAvailable = (library.aprsConfiguration?.channelSlots.length ?? 0) > 0;
  const nestedOnlyZones = useMemo(
    () =>
      nestedOnlyZoneMembershipsForChannels(
        channels.map((channel) => channel.id),
        library,
      ),
    [channels, library],
  );

  const handleApply = async () => {
    if (!hasChanges || busy) return;
    setApplying(true);
    setErrorMessage(null);
    try {
      const applyOutcome: ChannelBulkApplyOutcome = {};
      if (hasChannelPatch) {
        const outcome = await persistChannelBulkEdit({
          persistence,
          channels,
          patch,
        });
        if (!outcome.ok) {
          setErrorMessage(outcome.message);
          return;
        }
        applyOutcome.channels = outcome;
      }
      if (hasZoneChanges) {
        const outcome = await persistChannelBulkZoneMembership({
          persistence,
          library,
          channelIds: channels.map((channel) => channel.id),
          addToZoneIds: addZoneIds,
          removeFromZoneIds: removeZoneIds,
        });
        if (!outcome.ok) {
          setErrorMessage(outcome.message);
          return;
        }
        applyOutcome.zones = outcome;
      }
      onApplied?.(applyOutcome);
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
        size="xl"
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
                {applying
                  ? 'Applying…'
                  : hasChanges
                    ? `Apply to ${total} channel${total === 1 ? '' : 's'}`
                    : 'No changes'}
              </Button>
            </div>
          </div>
        }
      >
        <div className={classes.banner}>
          <strong>
            {total} channel{total === 1 ? '' : 's'} selected.
          </strong>
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
            <div className={classes.pairRow}>
              <FieldGroup>
                <ForbidTransmitSegment
                  value={bulkSegmentValue(form.changeForbidTransmit, form.forbidTransmit)}
                  onChange={(forbidTransmit) =>
                    setForm((prev) => ({ ...prev, changeForbidTransmit: true, forbidTransmit }))
                  }
                  onIdle={() => setForm((prev) => ({ ...prev, changeForbidTransmit: false }))}
                  idleOption={BULK_IDLE_OPTION}
                  sharedValue={shared.forbidTransmit}
                  layout="column"
                />
              </FieldGroup>
              <FieldGroup>
                <TxPermitSegment
                  value={bulkSegmentValue(form.changeTxPermit, form.txPermit)}
                  onChange={(txPermit) =>
                    setForm((prev) => ({ ...prev, changeTxPermit: true, txPermit }))
                  }
                  onIdle={() => setForm((prev) => ({ ...prev, changeTxPermit: false }))}
                  idleOption={BULK_IDLE_OPTION}
                  sharedValue={shared.txPermit}
                  layout="column"
                />
              </FieldGroup>
              <FieldGroup>
                <GradientSegmentedControl
                  label="Power"
                  value={bulkPowerSegmentValue(form.changePower, form.power)}
                  onChange={(next) => {
                    if (next === GRADIENT_SEGMENT_IDLE_VALUE) {
                      setForm((prev) => ({ ...prev, changePower: false }));
                      return;
                    }
                    if (next === BULK_POWER_DEFAULT) {
                      setForm((prev) => ({ ...prev, changePower: true, power: null }));
                      return;
                    }
                    setForm((prev) => ({
                      ...prev,
                      changePower: true,
                      power: prev.power ?? 50,
                    }));
                  }}
                  idleOption={BULK_IDLE_OPTION}
                  sharedValue={sharedPowerSegmentValue(shared.power)}
                  data={[
                    { value: BULK_POWER_DEFAULT, label: 'Default' },
                    { value: BULK_POWER_CUSTOM, label: 'Custom' },
                  ]}
                  scheme="three"
                  layout="column"
                />
                <PercentLevelSlider
                  label="Level"
                  value={form.power}
                  onChange={(power) => setForm((prev) => ({ ...prev, changePower: true, power }))}
                  showValue={form.changePower && form.power != null}
                  showDefaultCheckbox={false}
                  previewValues={channels.map((channel) => channel.power)}
                />
              </FieldGroup>
            </div>
          </Panel>

          {showModeSettings ? (
            <Panel
              title="Mode settings"
              collapsible
              defaultCollapsed
              badge={changeBadge(modeChangeCount)}
            >
              <div className={classes.pairRow}>
                {showDmrFields ? (
                  <FieldGroup>
                    <SendTalkerAliasSegment
                      value={bulkSegmentValue(form.changeSendTalkerAlias, form.sendTalkerAlias)}
                      onChange={(sendTalkerAlias) =>
                        setForm((prev) => ({
                          ...prev,
                          changeSendTalkerAlias: true,
                          sendTalkerAlias,
                        }))
                      }
                      onIdle={() => setForm((prev) => ({ ...prev, changeSendTalkerAlias: false }))}
                      idleOption={BULK_IDLE_OPTION}
                      sharedValue={shared.sendTalkerAlias}
                      layout="column"
                    />
                  </FieldGroup>
                ) : null}
                {showAnalogFields ? (
                  <>
                    <div className={[classes.fieldGroup, classes.fieldGroupWide].join(' ')}>
                      <div className={classes.tonesHeading}>CTCSS/DCS</div>
                      <div className={classes.pairRow}>
                        <div>
                          <BulkEditField
                            label="RX tone"
                            optedIn={form.changeRxTone}
                            onOptedInChange={(changeRxTone) =>
                              setForm((prev) => ({ ...prev, changeRxTone }))
                            }
                            hasSharedValue={shared.rxTone !== undefined}
                          >
                            <Select
                              data={toneSelectOptions()}
                              value={form.rxTone}
                              onChange={(value) =>
                                setForm((prev) => ({
                                  ...prev,
                                  rxTone: (value ?? NONE_TONE) as ChannelTone,
                                }))
                              }
                              searchable
                              comboboxProps={modalComboboxProps()}
                              aria-label="RX tone"
                            />
                          </BulkEditField>
                        </div>
                        <div>
                          <BulkEditField
                            label="TX tone"
                            optedIn={form.changeTxTone}
                            onOptedInChange={(changeTxTone) =>
                              setForm((prev) => ({ ...prev, changeTxTone }))
                            }
                            hasSharedValue={shared.txTone !== undefined}
                          >
                            <Select
                              data={toneSelectOptions()}
                              value={form.txTone}
                              onChange={(value) =>
                                setForm((prev) => ({
                                  ...prev,
                                  txTone: (value ?? NONE_TONE) as ChannelTone,
                                }))
                              }
                              searchable
                              comboboxProps={modalComboboxProps()}
                              aria-label="TX tone"
                            />
                          </BulkEditField>
                        </div>
                      </div>
                    </div>
                    <FieldGroup>
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
                        layout="column"
                      />
                    </FieldGroup>
                    <FieldGroup>
                      <BulkEditField
                        label="Squelch"
                        optedIn={form.changeAnalogSquelch}
                        onOptedInChange={(changeAnalogSquelch) =>
                          setForm((prev) => ({ ...prev, changeAnalogSquelch }))
                        }
                        hasSharedValue={shared.analogSquelch !== undefined}
                      >
                        <PercentLevelSlider
                          label="Level"
                          value={form.analogSquelch}
                          onChange={(analogSquelch) =>
                            setForm((prev) => ({ ...prev, analogSquelch }))
                          }
                          zeroLabel="Open (0%)"
                          showValue={form.changeAnalogSquelch && form.analogSquelch != null}
                          previewValues={channels.flatMap((channel) =>
                            channel.modeProfiles
                              .filter(isAnalogChannelModeProfile)
                              .map((profile) => profile.squelch),
                          )}
                        />
                      </BulkEditField>
                    </FieldGroup>
                  </>
                ) : null}
              </div>
            </Panel>
          ) : null}

          <Panel title="Zones" collapsible defaultCollapsed badge={changeBadge(zoneChangeCount)}>
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                Add or remove the selected channels as direct members. Nested membership is not
                changed here.
              </Text>
              <div className={classes.pairRow}>
                <BulkZonePickerColumn
                  title="Remove from"
                  description="Apply removes these channels from the zone’s direct members."
                  searchPlaceholder="Search zones to remove from"
                  zones={library.zones}
                  selectedIds={removeZoneIds}
                  blockedIds={addZoneIds}
                  onSelectedIdsChange={setRemoveZoneIds}
                />
                <BulkZonePickerColumn
                  title="Add to"
                  description="Apply appends any selected channels that are not already members."
                  searchPlaceholder="Search zones to add to"
                  zones={library.zones}
                  selectedIds={addZoneIds}
                  blockedIds={removeZoneIds}
                  onSelectedIdsChange={setAddZoneIds}
                />
              </div>
              {nestedOnlyZones.length > 0 ? (
                <Stack gap="xs">
                  <Text size="xs" c="dimmed">
                    Some selected channels appear in zones only through nested zones. Remove from
                    does not change nested membership — open the zone to edit members.
                  </Text>
                  {nestedOnlyZones.map(({ zone, viaNestedZoneName }) => (
                    <Group key={zone.id} justify="space-between" wrap="nowrap">
                      <Text size="sm">
                        {zone.name}
                        {viaNestedZoneName ? ` (via ${viaNestedZoneName})` : ''}
                      </Text>
                      <Link to={`/library/zones/${zone.id}`} className={classes.openLink}>
                        Open zone
                      </Link>
                    </Group>
                  ))}
                </Stack>
              ) : null}
            </Stack>
          </Panel>

          <Panel title="Scanning" collapsible badge={changeBadge(scanningChangeCount)}>
            <div className={classes.pairRow}>
              <FieldGroup>
                <ScanInclusionSegment
                  value={bulkSegmentValue(form.changeScanInclusion, form.scanInclusion)}
                  onChange={(scanInclusion) =>
                    setForm((prev) => ({ ...prev, changeScanInclusion: true, scanInclusion }))
                  }
                  onIdle={() => setForm((prev) => ({ ...prev, changeScanInclusion: false }))}
                  idleOption={BULK_IDLE_OPTION}
                  sharedValue={shared.scanInclusion}
                  layout="column"
                />
              </FieldGroup>
            </div>
          </Panel>

          <Panel title="APRS" collapsible defaultCollapsed badge={changeBadge(aprsChangeCount)}>
            <Stack gap="md">
              <Text size="sm" c="dimmed">
                Per-channel digital APRS flags for CPS export. Analog AX.25 APRS is not supported
                yet.
              </Text>
              <div className={classes.pairRow}>
                <FieldGroup>
                  <GradientSegmentedControl
                    label="APRS receive"
                    value={bulkSegmentValue(
                      form.changeAprsReceive,
                      form.aprsReceiveEnabled ? 'on' : 'off',
                    )}
                    onChange={(next) => {
                      if (next === GRADIENT_SEGMENT_IDLE_VALUE) {
                        setForm((prev) => ({ ...prev, changeAprsReceive: false }));
                        return;
                      }
                      setForm((prev) => ({
                        ...prev,
                        changeAprsReceive: true,
                        aprsReceiveEnabled: next === 'on',
                      }));
                    }}
                    idleOption={BULK_IDLE_OPTION}
                    sharedValue={
                      shared.aprsReceiveEnabled === undefined
                        ? undefined
                        : shared.aprsReceiveEnabled
                          ? 'on'
                          : 'off'
                    }
                    data={[
                      { value: 'off', label: 'Off' },
                      { value: 'on', label: 'On' },
                    ]}
                    scheme="onOff"
                    layout="column"
                  />
                </FieldGroup>
                <FieldGroup>
                  <GradientSegmentedControl
                    label="Report type"
                    value={bulkSegmentValue(form.changeAprsReportType, form.aprsReportType)}
                    onChange={(next) => {
                      if (next === GRADIENT_SEGMENT_IDLE_VALUE) {
                        setForm((prev) => ({ ...prev, changeAprsReportType: false }));
                        return;
                      }
                      setForm((prev) => ({
                        ...prev,
                        changeAprsReportType: true,
                        aprsReportType: next as AprsReportType,
                      }));
                    }}
                    idleOption={BULK_IDLE_OPTION}
                    sharedValue={shared.aprsReportType}
                    data={[
                      { value: 'off', label: 'Off' },
                      { value: 'digital', label: 'Digital' },
                    ]}
                    scheme="onOff"
                    layout="column"
                  />
                </FieldGroup>
                <FieldGroup>
                  <GradientSegmentedControl
                    label="Digital APRS PTT"
                    value={bulkSegmentValue(form.changeAprsPtt, form.aprsDigitalPttMode)}
                    onChange={(next) => {
                      if (next === GRADIENT_SEGMENT_IDLE_VALUE) {
                        setForm((prev) => ({ ...prev, changeAprsPtt: false }));
                        return;
                      }
                      setForm((prev) => ({
                        ...prev,
                        changeAprsPtt: true,
                        aprsDigitalPttMode: next as AprsPttMode,
                      }));
                    }}
                    idleOption={BULK_IDLE_OPTION}
                    sharedValue={shared.aprsDigitalPttMode}
                    data={[
                      { value: 'off', label: 'Off' },
                      { value: 'on', label: 'On' },
                    ]}
                    scheme="onOff"
                    layout="column"
                  />
                </FieldGroup>
                <FieldGroup>
                  <BulkEditField
                    label="Report slot"
                    description={
                      slotsAvailable
                        ? 'Slot used for position reports at export.'
                        : 'Add channel slots on the APRS configuration page first.'
                    }
                    optedIn={form.changeAprsSlot}
                    onOptedInChange={(changeAprsSlot) =>
                      setForm((prev) => ({ ...prev, changeAprsSlot }))
                    }
                    hasSharedValue={shared.aprsReportSlotIndex !== undefined}
                  >
                    <Select
                      data={slotOptions}
                      disabled={!slotsAvailable}
                      value={
                        form.aprsReportSlotIndex != null
                          ? String(form.aprsReportSlotIndex)
                          : APRS_SLOT_NONE_VALUE
                      }
                      onChange={(next) =>
                        setForm((prev) => ({
                          ...prev,
                          aprsReportSlotIndex:
                            next && next !== APRS_SLOT_NONE_VALUE
                              ? Number.parseInt(next, 10)
                              : null,
                        }))
                      }
                      comboboxProps={modalComboboxProps()}
                      aria-label="Report slot"
                    />
                  </BulkEditField>
                </FieldGroup>
              </div>
            </Stack>
          </Panel>

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
