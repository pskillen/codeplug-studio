import { formatNumber, type NumberFormat } from '@integrations/radio-io/debugView';

export interface HexDecValueProps {
  /** Undefined prints the not-captured dash. */
  value: number | undefined;
  /** Bytes, for hex padding. Default 1. */
  width?: 1 | 2 | 3 | 4;
  /**
   * `hex-dec` (default): `0x1A (26)`, for raw bytes, enums and codes. `decimal`: counts,
   * frequencies and physical values, with `unit`. `hex`: addresses.
   */
  format?: NumberFormat;
  unit?: string;
  /** Sensitive and not revealed: prints `••`. */
  masked?: boolean;
}

export const MASKED_TEXT = '••';

/** One number in the owner's number format. Radio-neutral; the caller picks the format. */
export default function HexDecValue({
  value,
  width = 1,
  format = 'hex-dec',
  unit,
  masked = false,
}: HexDecValueProps) {
  const text = masked ? MASKED_TEXT : formatNumber(value, format, width, unit);
  return (
    <span style={{ fontFamily: 'var(--mantine-font-family-monospace, monospace)' }}>{text}</span>
  );
}
