import { useMemo, useState } from 'react';
import type { AprsChannelSlot, ChannelAprsBinding } from '@core/models/aprs.ts';
import type { AprsPttMode, AprsReportType } from '@core/models/libraryTypes.ts';
import type { Channel } from '@core/models/library.ts';
import { CHANNEL_APRS_OFF } from '@core/domain/aprs/defaults.ts';
import { Button, Checkbox, Group, Modal, Select, Stack, Text } from '@mantine/core';
import { APRS_SLOT_NONE_VALUE, aprsSlotSelectOptions } from '../../lib/aprsBindingHelpers.ts';

const REPORT_TYPE_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'digital', label: 'Digital' },
] satisfies { value: AprsReportType; label: string }[];

const PTT_MODE_OPTIONS = [
  { value: 'off', label: 'Off' },
  { value: 'on', label: 'On' },
] satisfies { value: AprsPttMode; label: string }[];

export interface AprsChannelBulkAssignModalProps {
  opened: boolean;
  onClose: () => void;
  selectedCount: number;
  channelSlots: AprsChannelSlot[];
  channels: Channel[];
  onApply: (patch: AprsChannelBulkPatch) => void;
}

export interface AprsChannelBulkPatch {
  clearBinding?: boolean;
  reportSlotIndex?: number | null;
  patchReportSlot?: boolean;
  reportType?: AprsReportType;
  patchReportType?: boolean;
  receiveEnabled?: boolean;
  patchReceiveEnabled?: boolean;
  digitalPttMode?: AprsPttMode;
  patchDigitalPttMode?: boolean;
}

export function applyAprsChannelBulkPatch(
  current: ChannelAprsBinding | undefined,
  patch: AprsChannelBulkPatch,
): ChannelAprsBinding | undefined {
  if (patch.clearBinding) return undefined;
  const base = current ?? { ...CHANNEL_APRS_OFF };
  return {
    receiveEnabled: patch.patchReceiveEnabled ? Boolean(patch.receiveEnabled) : base.receiveEnabled,
    reportType: patch.patchReportType ? (patch.reportType ?? 'off') : base.reportType,
    digitalPttMode: patch.patchDigitalPttMode
      ? (patch.digitalPttMode ?? 'off')
      : base.digitalPttMode,
    reportSlotIndex: patch.patchReportSlot ? (patch.reportSlotIndex ?? null) : base.reportSlotIndex,
  };
}

export default function AprsChannelBulkAssignModal({
  opened,
  onClose,
  selectedCount,
  channelSlots,
  channels,
  onApply,
}: AprsChannelBulkAssignModalProps) {
  const [clearBinding, setClearBinding] = useState(false);
  const [patchReportSlot, setPatchReportSlot] = useState(false);
  const [reportSlotValue, setReportSlotValue] = useState<string>(APRS_SLOT_NONE_VALUE);
  const [patchReportType, setPatchReportType] = useState(false);
  const [reportTypeValue, setReportTypeValue] = useState<AprsReportType>('digital');
  const [patchReceiveEnabled, setPatchReceiveEnabled] = useState(false);
  const [receiveEnabledValue, setReceiveEnabledValue] = useState(true);
  const [patchDigitalPttMode, setPatchDigitalPttMode] = useState(false);
  const [digitalPttModeValue, setDigitalPttModeValue] = useState<AprsPttMode>('on');

  const slotOptions = useMemo(
    () => aprsSlotSelectOptions(channelSlots, channels),
    [channelSlots, channels],
  );

  function handleApply() {
    onApply({
      clearBinding,
      patchReportSlot: clearBinding ? false : patchReportSlot,
      reportSlotIndex:
        reportSlotValue && reportSlotValue !== APRS_SLOT_NONE_VALUE
          ? Number.parseInt(reportSlotValue, 10)
          : null,
      patchReportType: clearBinding ? false : patchReportType,
      reportType: reportTypeValue,
      patchReceiveEnabled: clearBinding ? false : patchReceiveEnabled,
      receiveEnabled: receiveEnabledValue,
      patchDigitalPttMode: clearBinding ? false : patchDigitalPttMode,
      digitalPttMode: digitalPttModeValue,
    });
    onClose();
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Bulk set APRS bindings" centered>
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Apply to {selectedCount} selected channel{selectedCount === 1 ? '' : 's'}.
        </Text>
        <Checkbox
          label="Clear APRS binding"
          checked={clearBinding}
          onChange={(event) => setClearBinding(event.currentTarget.checked)}
        />
        <Checkbox
          label="Set report slot"
          checked={patchReportSlot}
          disabled={clearBinding}
          onChange={(event) => setPatchReportSlot(event.currentTarget.checked)}
        />
        <Select
          data={slotOptions}
          disabled={clearBinding || !patchReportSlot}
          value={reportSlotValue}
          onChange={(value) => setReportSlotValue(value ?? APRS_SLOT_NONE_VALUE)}
        />
        <Checkbox
          label="Set report type"
          checked={patchReportType}
          disabled={clearBinding}
          onChange={(event) => setPatchReportType(event.currentTarget.checked)}
        />
        <Select
          data={REPORT_TYPE_OPTIONS}
          disabled={clearBinding || !patchReportType}
          value={reportTypeValue}
          onChange={(value) => setReportTypeValue((value as AprsReportType | null) ?? 'off')}
        />
        <Checkbox
          label="Set receive enabled"
          checked={patchReceiveEnabled}
          disabled={clearBinding}
          onChange={(event) => setPatchReceiveEnabled(event.currentTarget.checked)}
        />
        <Checkbox
          label="APRS receive enabled"
          checked={receiveEnabledValue}
          disabled={clearBinding || !patchReceiveEnabled}
          onChange={(event) => setReceiveEnabledValue(event.currentTarget.checked)}
        />
        <Checkbox
          label="Set digital PTT mode"
          checked={patchDigitalPttMode}
          disabled={clearBinding}
          onChange={(event) => setPatchDigitalPttMode(event.currentTarget.checked)}
        />
        <Select
          data={PTT_MODE_OPTIONS}
          disabled={clearBinding || !patchDigitalPttMode}
          value={digitalPttModeValue}
          onChange={(value) => setDigitalPttModeValue((value as AprsPttMode | null) ?? 'off')}
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleApply}>Apply to {selectedCount}</Button>
        </Group>
      </Stack>
    </Modal>
  );
}
