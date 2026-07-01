function frequencyHzToMhz(hz: number | null): number | null {
  if (hz == null || !Number.isFinite(hz)) return null;
  return hz / 1_000_000;
}

export function formatFrequencyHz(hz: number | null): string {
  if (hz == null || hz <= 0) return '';
  const mhz = frequencyHzToMhz(hz);
  if (mhz == null) return '';
  return `${formatMhzNumber(mhz)} MHz`;
}

export function formatMhzNumber(mhz: number): string {
  if (!Number.isFinite(mhz)) return String(mhz);

  const khzRounded = Math.round(mhz * 1000);
  const isKhzAligned = Math.abs(mhz * 1000 - khzRounded) < 1e-9;

  if (isKhzAligned) {
    return (khzRounded / 1000).toFixed(3);
  }

  for (let decimals = 4; decimals <= 9; decimals++) {
    const formatted = mhz.toFixed(decimals);
    if (Math.abs(parseFloat(formatted) - mhz) < 1e-12) {
      return formatted.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
    }
  }

  return mhz.toFixed(9);
}

export function formatBandRangeMhz(minMhz: number, maxMhz: number): string {
  return `${formatMhzNumber(minMhz)}–${formatMhzNumber(maxMhz)} MHz`;
}

export function formatChannelRxTxListCell(rxHz: number | null, txHz: number | null): string {
  const fmt = (hz: number | null) =>
    hz != null && hz > 0 ? formatFrequencyHz(hz).replace(' MHz', '') : null;
  const rx = fmt(rxHz);
  const tx = fmt(txHz);
  if (!rx && !tx) return '—';
  if (rx && tx && rxHz === txHz) return rx;
  if (rx && tx) return `${rx} / ${tx}`;
  return rx ?? tx ?? '—';
}
