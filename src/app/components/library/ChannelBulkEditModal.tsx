import { useMemo, useState } from 'react';
import {
  Accordion,
  Alert,
  Badge,
  Box,
  Button,
  Checkbox,
  Collapse,
  Group,
  Modal,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
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
  type ChannelBulkEditPatch,
} from '@core/domain/channelBulkEdit.ts';
import ForbidTransmitSegment from '../channels/ForbidTransmitSegment.tsx';
import TxPermitSegment from '../channels/TxPermitSegment.tsx';
import SendTalkerAliasSegment from '../channels/SendTalkerAliasSegment.tsx';
import AnalogSquelchModeSegment from '../channels/AnalogSquelchModeSegment.tsx';
import ScanInclusionSegment from '../channels/ScanInclusionSegment.tsx';
import { PercentLevelSlider } from '../ui/index.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import {
  persistChannelBulkEdit,
  type PersistChannelBulkEditSuccess,
} from '../../lib/channelBulkEdit.ts';
import {
  persistChannelBulkDelete,
  type PersistChannelBulkDeleteOutcome,
} from '../../lib/channelBulkDelete.ts';
import type { DeleteOutcome } from '../../state/libraryService.ts';
import { persistence } from '../../state/persistence.ts';

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

const INITIAL_FORM: BulkEditFormState = {
  changeScanInclusion: false,
  scanInclusion: 'default',
  changeForbidTransmit: false,
  forbidTransmit: 'default',
  changeTxPermit: false,
  txPermit: 'default',
  changeSendTalkerAlias: false,
  sendTalkerAlias: 'default',
  changeAnalogSquelchMode: false,
  analogSquelchMode: 'default',
  changePower: false,
  power: null,
  changeAnalogSquelch: false,
  analogSquelch: null,
};

type ModalView = 'edit' | 'confirmDelete';

function buildPatchFromForm(form: BulkEditFormState): ChannelBulkEditPatch {
  const patch: ChannelBulkEditPatch = {};
  if (form.changeScanInclusion) {
    patch.scanInclusion = form.scanInclusion;
  }
  if (form.changeForbidTransmit) {
    patch.forbidTransmit = form.forbidTransmit;
  }
  if (form.changeTxPermit) {
    patch.txPermit = form.txPermit;
  }
  if (form.changeSendTalkerAlias) {
    patch.sendTalkerAlias = form.sendTalkerAlias;
  }
  if (form.changeAnalogSquelchMode) {
    patch.analogSquelchMode = form.analogSquelchMode;
  }
  if (form.changePower) {
    patch.power = form.power;
  }
  if (form.changeAnalogSquelch) {
    patch.analogSquelch = form.analogSquelch;
  }
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
  const total = channels.length;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm" wrap="nowrap">
          <Text fw={600} component="span">
            Bulk edit
          </Text>
          <Badge size="lg" variant="light">
            {total} channel{total === 1 ? '' : 's'}
          </Badge>
        </Group>
      }
      size="lg"
    >
      {opened ? (
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
      ) : null}
    </Modal>
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
  const [form, setForm] = useState<BulkEditFormState>(INITIAL_FORM);
  const [showChannelList, setShowChannelList] = useState(false);
  const [applying, setApplying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const patch = useMemo(() => buildPatchFromForm(form), [form]);
  const hasChanges = Object.keys(patch).length > 0;
  const impact = useMemo(
    () => (hasChanges ? analyzeChannelBulkEditImpact(channels, patch) : {}),
    [channels, hasChanges, patch],
  );
  const analogChannelCount = useMemo(() => countChannelsWithAnalogProfile(channels), [channels]);
  const showAnalogSection = analogChannelCount > 0;
  const busy = applying || deleting;
  const total = channels.length;

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

  if (view === 'confirmDelete') {
    return (
      <Stack gap="md">
        <Text>
          Delete {total} channel{total === 1 ? '' : 's'}? This cannot be undone.
        </Text>
        <Text size="sm" c="dimmed">
          Channels that are only in zones will be removed from those zones first. Channels
          referenced by scan lists or other entities cannot be deleted until those references are
          cleared.
        </Text>

        {errorMessage ? <Alert color="red">{errorMessage}</Alert> : null}

        <Group justify="space-between">
          <Button variant="default" onClick={() => setView('edit')} disabled={busy}>
            Back
          </Button>
          <Button color="red" onClick={() => void handleConfirmDelete()} loading={deleting}>
            Delete {total} channel{total === 1 ? '' : 's'}
          </Button>
        </Group>
      </Stack>
    );
  }

  return (
    <Stack gap="md">
      <UnstyledButton onClick={() => setShowChannelList((v) => !v)} aria-expanded={showChannelList}>
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

      <Stack gap="sm">
        <Checkbox
          label="Change scan inclusion"
          checked={form.changeScanInclusion}
          onChange={(e) => {
            const checked = e.currentTarget.checked;
            setForm((prev) => ({ ...prev, changeScanInclusion: checked }));
          }}
        />
        <fieldset
          disabled={!form.changeScanInclusion}
          style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
        >
          <ScanInclusionSegment
            value={form.scanInclusion}
            onChange={(scanInclusion) => setForm((prev) => ({ ...prev, scanInclusion }))}
          />
        </fieldset>
        {form.changeScanInclusion && impact.scanInclusion ? (
          <Text size="xs" c="dimmed">
            {channelLevelImpactText(impact.scanInclusion.appliesTo)}
          </Text>
        ) : null}

        <Checkbox
          label="Change transmit permission"
          checked={form.changeForbidTransmit}
          onChange={(e) => {
            const checked = e.currentTarget.checked;
            setForm((prev) => ({ ...prev, changeForbidTransmit: checked }));
          }}
        />
        <fieldset
          disabled={!form.changeForbidTransmit}
          style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
        >
          <ForbidTransmitSegment
            value={form.forbidTransmit}
            onChange={(forbidTransmit) => setForm((prev) => ({ ...prev, forbidTransmit }))}
          />
        </fieldset>
        {form.changeForbidTransmit && impact.forbidTransmit ? (
          <Text size="xs" c="dimmed">
            {channelLevelImpactText(impact.forbidTransmit.appliesTo)}
          </Text>
        ) : null}

        <Checkbox
          label="Change TX permit"
          checked={form.changeTxPermit}
          onChange={(e) => {
            const checked = e.currentTarget.checked;
            setForm((prev) => ({ ...prev, changeTxPermit: checked }));
          }}
        />
        <fieldset
          disabled={!form.changeTxPermit}
          style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
        >
          <TxPermitSegment
            value={form.txPermit}
            onChange={(txPermit) => setForm((prev) => ({ ...prev, txPermit }))}
          />
        </fieldset>
        {form.changeTxPermit && impact.txPermit ? (
          <Text size="xs" c="dimmed">
            {channelLevelImpactText(impact.txPermit.appliesTo)}
          </Text>
        ) : null}

        <Checkbox
          label="Change send talker alias"
          checked={form.changeSendTalkerAlias}
          onChange={(e) => {
            const checked = e.currentTarget.checked;
            setForm((prev) => ({ ...prev, changeSendTalkerAlias: checked }));
          }}
        />
        <fieldset
          disabled={!form.changeSendTalkerAlias}
          style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
        >
          <SendTalkerAliasSegment
            value={form.sendTalkerAlias}
            onChange={(sendTalkerAlias) => setForm((prev) => ({ ...prev, sendTalkerAlias }))}
          />
        </fieldset>
        {form.changeSendTalkerAlias && impact.sendTalkerAlias ? (
          <Text size="xs" c="dimmed">
            {channelLevelImpactText(impact.sendTalkerAlias.appliesTo)}
          </Text>
        ) : null}

        <Checkbox
          label="Change analog squelch mode"
          checked={form.changeAnalogSquelchMode}
          onChange={(e) => {
            const checked = e.currentTarget.checked;
            setForm((prev) => ({ ...prev, changeAnalogSquelchMode: checked }));
          }}
        />
        <fieldset
          disabled={!form.changeAnalogSquelchMode}
          style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
        >
          <AnalogSquelchModeSegment
            value={form.analogSquelchMode}
            onChange={(analogSquelchMode) => setForm((prev) => ({ ...prev, analogSquelchMode }))}
          />
        </fieldset>
        {form.changeAnalogSquelchMode && impact.analogSquelchMode ? (
          <Text size="xs" c="dimmed">
            {channelLevelImpactText(impact.analogSquelchMode.appliesTo)}
          </Text>
        ) : null}

        <Checkbox
          label="Change power"
          checked={form.changePower}
          onChange={(e) => {
            const checked = e.currentTarget.checked;
            setForm((prev) => ({ ...prev, changePower: checked }));
          }}
        />
        <fieldset
          disabled={!form.changePower}
          style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
        >
          <PercentLevelSlider
            label="Power"
            value={form.power}
            onChange={(power) => setForm((prev) => ({ ...prev, power }))}
          />
        </fieldset>
        {form.changePower && impact.power ? (
          <Text size="xs" c="dimmed">
            {channelLevelImpactText(impact.power.appliesTo)}
          </Text>
        ) : null}
      </Stack>

      {showAnalogSection ? (
        <Accordion variant="separated">
          <Accordion.Item value="analog">
            <Accordion.Control>
              Analog mode settings
              <Text size="xs" c="dimmed">
                Updates squelch on existing analog mode profiles only. Does not add or remove modes.
              </Text>
            </Accordion.Control>

            <Accordion.Panel>
              <Stack gap="sm">
                <Checkbox
                  label="Change squelch"
                  checked={form.changeAnalogSquelch}
                  onChange={(e) => {
                    const checked = e.currentTarget.checked;
                    setForm((prev) => ({ ...prev, changeAnalogSquelch: checked }));
                  }}
                />
                <fieldset
                  disabled={!form.changeAnalogSquelch}
                  style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
                >
                  <PercentLevelSlider
                    label="Squelch"
                    value={form.analogSquelch}
                    onChange={(analogSquelch) => setForm((prev) => ({ ...prev, analogSquelch }))}
                    zeroLabel="Open (0%)"
                  />
                </fieldset>
                {form.changeAnalogSquelch && impact.analogSquelch ? (
                  <Text size="xs" c="dimmed">
                    {analogImpactText(
                      impact.analogSquelch.appliesTo,
                      impact.analogSquelch.skipped,
                      total,
                    )}
                  </Text>
                ) : null}
              </Stack>
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      ) : null}

      {!hasChanges ? (
        <Text size="sm" c="dimmed">
          Enable at least one change above to apply.
        </Text>
      ) : null}

      {errorMessage ? <Alert color="red">{errorMessage}</Alert> : null}

      <Group justify="space-between">
        <Button
          variant="subtle"
          color="red"
          onClick={() => {
            setErrorMessage(null);
            setView('confirmDelete');
          }}
          disabled={busy || !projectId}
        >
          Delete {total} channel{total === 1 ? '' : 's'}
        </Button>
        <Group gap="xs">
          <Button variant="default" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            onClick={() => void handleApply()}
            loading={applying}
            disabled={!hasChanges || busy}
          >
            Apply
          </Button>
        </Group>
      </Group>
    </Stack>
  );
}
