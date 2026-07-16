import type { LibraryForbidTransmitDefault } from '@core/models/channelBehaviourDefaults.ts';
import GradientSegmentedControl from '../ui/GradientSegmentedControl.tsx';

export interface LibraryForbidTransmitDefaultSegmentProps {
  value: LibraryForbidTransmitDefault;
  onChange: (value: LibraryForbidTransmitDefault) => void;
  disabled?: boolean;
}

const OPTIONS = [
  { value: 'false', label: 'Allow TX' },
  { value: 'true', label: 'RX only' },
] as const;

export default function LibraryForbidTransmitDefaultSegment({
  value,
  onChange,
  disabled = false,
}: LibraryForbidTransmitDefaultSegmentProps) {
  return (
    <GradientSegmentedControl
      label="Transmit"
      description="Default for channels set to Default on the channel editor. Build export can still override."
      value={value ? 'true' : 'false'}
      onChange={(next) => onChange(next === 'true')}
      data={[...OPTIONS]}
      scheme="allowForbid"
      fullWidth
      disabled={disabled}
    />
  );
}
