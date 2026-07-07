import { useMemo, useState } from 'react';
import {
  Accordion,
  Alert,
  Badge,
  Button,
  Checkbox,
  Collapse,
  Group,
  Modal,
  ScrollArea,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import { IconChevronDown, IconChevronRight } from '@tabler/icons-react';
import type { Channel, ScanInclusion } from '@core/models/library.ts';
import {
  analyzeChannelBulkEditImpact,
  countChannelsWithAnalogProfile,
  type ChannelBulkEditPatch,
} from '@core/domain/channelBulkEdit.ts';
import ForbidTransmitSegment from '../channels/ForbidTransmitSegment.tsx';
import ScanInclusionSegment from '../channels/ScanInclusionSegment.tsx';
import { PercentLevelSlider } from '../ui/index.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../lib/iconSizes.ts';
import {
  persistChannelBulkEdit,
  type PersistChannelBulkEditSuccess,
} from '../../lib/channelBulkEdit.ts';
import { persistence } from '../../state/persistence.ts';

export interface ChannelBulkEditModalProps {
  opened: boolean;
  onClose: () => void;
  channels: Channel[];
  onApplied?: (outcome: PersistChannelBulkEditSuccess) => void;
}

interface BulkEditFormState {
  changeScanInclusion: boolean;
  scanInclusion: ScanInclusion;
  changeForbidTransmit: boolean;
  forbidTransmit: boolean;
  changePower: boolean;
  power: number | null;
  changeAnalogSquelch: boolean;
  analogSquelch: number | null;
}

const INITIAL_FORM: BulkEditFormState = {
  changeScanInclusion: false,
  scanInclusion: 'default',
  changeForbidTransmit: false,
  forbidTransmit: false,
  changePower: false,
  power: null,
  changeAnalogSquelch: false,
  analogSquelch: null,
};

function buildPatchFromForm(form: BulkEditFormState): ChannelBulkEditPatch {
  const patch: ChannelBulkEditPatch = {};
  if (form.changeScanInclusion) {
    patch.scanInclusion = form.scanInclusion;
  }
  if (form.changeForbidTransmit) {
    patch.forbidTransmit = form.forbidTransmit;
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
  onApplied,
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
          onClose={onClose}
          onApplied={onApplied}
        />
      ) : null}
    </Modal>
  );
}

function ChannelBulkEditModalBody({
  channels,
  onClose,
  onApplied,
}: {
  channels: Channel[];
  onClose: () => void;
  onApplied?: (outcome: PersistChannelBulkEditSuccess) => void;
}) {
  const [form, setForm] = useState<BulkEditFormState>(INITIAL_FORM);
  const [showChannelList, setShowChannelList] = useState(false);
  const [applying, setApplying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const patch = useMemo(() => buildPatchFromForm(form), [form]);
  const hasChanges = Object.keys(patch).length > 0;
  const impact = useMemo(
    () => (hasChanges ? analyzeChannelBulkEditImpact(channels, patch) : {}),
    [channels, hasChanges, patch],
  );
  const analogChannelCount = useMemo(() => countChannelsWithAnalogProfile(channels), [channels]);
  const showAnalogSection = analogChannelCount > 0;

  const handleApply = async () => {
    if (!hasChanges || applying) return;
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

  const total = channels.length;

  return (
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

        <Collapse in={showChannelList}>
          <ScrollArea.Autosize mah={160} offsetScrollbars>
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
          </ScrollArea.Autosize>
        </Collapse>

        <Stack gap="sm">
          <Checkbox
            label="Change scan inclusion"
            checked={form.changeScanInclusion}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, changeScanInclusion: e.currentTarget.checked }))
            }
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
            onChange={(e) =>
              setForm((prev) => ({ ...prev, changeForbidTransmit: e.currentTarget.checked }))
            }
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
            label="Change power"
            checked={form.changePower}
            onChange={(e) => setForm((prev) => ({ ...prev, changePower: e.currentTarget.checked }))}
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
              <Accordion.Control description="Updates squelch on existing analog mode profiles only. Does not add or remove modes.">
                Analog mode settings
              </Accordion.Control>
              <Accordion.Panel>
                <Stack gap="sm">
                  <Checkbox
                    label="Change squelch"
                    checked={form.changeAnalogSquelch}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        changeAnalogSquelch: e.currentTarget.checked,
                      }))
                    }
                  />
                  <fieldset
                    disabled={!form.changeAnalogSquelch}
                    style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
                  >
                    <PercentLevelSlider
                      label="Squelch"
                      value={form.analogSquelch}
                      onChange={(analogSquelch) =>
                        setForm((prev) => ({ ...prev, analogSquelch }))
                      }
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

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={applying}>
            Cancel
          </Button>
          <Button onClick={() => void handleApply()} loading={applying} disabled={!hasChanges}>
            Apply
          </Button>
        </Group>
    </Stack>
  );
}
