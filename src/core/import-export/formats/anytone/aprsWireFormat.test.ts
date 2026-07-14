import { describe, expect, it } from 'vitest';
import {
  formatAnytoneAprsCallType,
  formatAnytoneAprsChannelSlot,
  formatAnytoneAprsIntervalSec,
  formatAnytoneAprsOnOff,
  formatAnytoneAprsPttMode,
  formatAnytoneAprsReportChannel,
  formatAnytoneAprsReportType,
  formatAnytoneAprsTargetDmrId,
  formatAnytoneAprsTimeslot,
  formatAnytoneFixedLocation,
  formatAnytonePositionSource,
} from './aprsWireFormat.ts';

describe('anytone aprsWireFormat', () => {
  it('maps on/off booleans and enums', () => {
    expect(formatAnytoneAprsOnOff(true)).toBe('On');
    expect(formatAnytoneAprsOnOff(false)).toBe('Off');
    expect(formatAnytoneAprsReportType('digital')).toBe('Digital');
    expect(formatAnytoneAprsReportType('off')).toBe('Off');
    expect(formatAnytoneAprsPttMode('on')).toBe('On');
    expect(formatAnytoneAprsPttMode('off')).toBe('Off');
    expect(formatAnytoneAprsCallType('private')).toBe('0');
    expect(formatAnytoneAprsCallType('group')).toBe('1');
  });

  it('maps intervals, slots, and DMR IDs', () => {
    expect(formatAnytoneAprsIntervalSec(null)).toBe('0');
    expect(formatAnytoneAprsIntervalSec(9)).toBe('9');
    expect(formatAnytoneAprsTimeslot(null)).toBe('0');
    expect(formatAnytoneAprsTimeslot(2)).toBe('2');
    expect(formatAnytoneAprsChannelSlot(null)).toBe('0');
    expect(formatAnytoneAprsChannelSlot(3)).toBe('3');
    expect(formatAnytoneAprsTargetDmrId(null)).toBe('0');
    expect(formatAnytoneAprsTargetDmrId(2355)).toBe('2355');
    expect(formatAnytoneAprsReportChannel('off', null)).toBe('1');
    expect(formatAnytoneAprsReportChannel('digital', null)).toBe('1');
    expect(formatAnytoneAprsReportChannel('digital', 2)).toBe('2');
    expect(formatAnytoneAprsReportChannel('off', 2)).toBe('1');
  });

  it('decomposes fixed latitude and longitude', () => {
    const wire = formatAnytoneFixedLocation({ lat: 23.5, lon: -113.25 });
    expect(wire.fixedLocationBeacon).toBe('1');
    expect(wire.latitude).toEqual({
      degrees: '23',
      minInt: '30',
      minMark: '0',
      hemisphere: '0',
    });
    expect(wire.longitude).toEqual({
      degrees: '113',
      minInt: '15',
      minMark: '0',
      hemisphere: '1',
    });
  });

  it('clears coordinates for GNSS position sources', () => {
    const wire = formatAnytonePositionSource('allGnss', { lat: 55.9, lon: -3.2 });
    expect(wire.fixedLocationBeacon).toBe('0');
    expect(wire.latitude.degrees).toBe('0');
    expect(wire.longitude.degrees).toBe('0');
  });

  it('uses fixed location when position source is fixed', () => {
    const wire = formatAnytonePositionSource('fixed', { lat: 51.5, lon: 0.1 });
    expect(wire.fixedLocationBeacon).toBe('1');
    expect(wire.latitude.degrees).toBe('51');
    expect(wire.longitude.degrees).toBe('0');
  });
});
