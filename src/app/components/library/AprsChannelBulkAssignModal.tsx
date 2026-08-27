import { useMemo, useState } from 'react';
import type { AprsChannelSlot } from '@core/models/aprs.ts';
import type { AprsPttMode, AprsReportType } from '@core/models/libraryTypes.ts';
import type { Channel } from '@core/models/library.ts';
import { applyAprsChannelBulkPatch, type AprsChannelBulkPatch } from '@core/domain/aprs/index.ts';
import { Checkbox, Select, Stack, Text } from '@mantine/core';
import { IconAntenna } from '@tabler/icons-react';
import { APRS_SLOT_NONE_VALUE, aprsSlotSelectOptions } from '../../lib/aprsBindingHelpers.ts';
import { modalComboboxProps } from '../../theme.ts';
import { Button, ModalShell } from '../v2/index.ts';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../lib/iconSizes.ts';
import classes from './ChannelBulkEditModal.module.css';

export { applyAprsChannelBulkPatch, type AprsChannelBulkPatch };

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
    <ModalShell
      open={opened}
      onClose={onClose}
      title="Assign APRS slot"
      icon={<IconAntenna size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />}
      iconTone="accent"
      size="lg"
      footer={
        <div className={classes.footerActions}>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" size="sm" onClick={handleApply}>
            Apply to {selectedCount} channel{selectedCount === 1 ? '' : 's'}
          </Button>
        </div>
      }
    >
      <div className={classes.banner}>
        <strong>
          {selectedCount} channel{selectedCount === 1 ? '' : 's'} selected.
        </strong>{' '}
        Enable only the fields you want to change.
      </div>

      <Stack gap="md">
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
          comboboxProps={modalComboboxProps()}
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
          comboboxProps={modalComboboxProps()}
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
          comboboxProps={modalComboboxProps()}
          value={digitalPttModeValue}
          onChange={(value) => setDigitalPttModeValue((value as AprsPttMode | null) ?? 'off')}
        />
        <Text size="sm" c="dimmed">
          Blank fields keep current values on each channel unless cleared above.
        </Text>
      </Stack>
    </ModalShell>
  );
}
