import { describe, expect, it } from 'vitest';
import { cutawayPlaneNormal, latLonToGlobeCartesian } from './cutawayPlane.ts';

function mag(v: { x: number; y: number; z: number }): number {
  return Math.hypot(v.x, v.y, v.z);
}

function dot(
  a: { x: number; y: number; z: number },
  b: { x: number; y: number; z: number },
): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

describe('latLonToGlobeCartesian', () => {
  it('matches three-globe polar2Cartesian at equator lon 0 (+Z)', () => {
    const v = latLonToGlobeCartesian(0, 0);
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(0);
    expect(v.z).toBeCloseTo(1);
  });

  it('maps the north pole to +Y', () => {
    const v = latLonToGlobeCartesian(90, 0);
    expect(v.x).toBeCloseTo(0);
    expect(v.y).toBeCloseTo(1);
    expect(v.z).toBeCloseTo(0);
  });
});

describe('cutawayPlaneNormal', () => {
  it('is a unit vector', () => {
    const n = cutawayPlaneNormal(0, 0, 0);
    expect(mag(n)).toBeCloseTo(1);
  });

  it('at equator/prime meridian with due-north bearing is −X (YZ meridional plane)', () => {
    const n = cutawayPlaneNormal(0, 0, 0);
    expect(n.x).toBeCloseTo(-1);
    expect(n.y).toBeCloseTo(0);
    expect(n.z).toBeCloseTo(0);
  });

  it('at equator/prime meridian with due-east bearing is +Y (equatorial plane)', () => {
    const n = cutawayPlaneNormal(0, 0, 90);
    expect(n.x).toBeCloseTo(0);
    expect(n.y).toBeCloseTo(1);
    expect(n.z).toBeCloseTo(0);
  });

  it('is orthogonal to the transmitter and a point along the bearing', () => {
    const txLat = 51.5;
    const txLon = -0.13;
    const bearingDeg = 96;
    const n = cutawayPlaneNormal(txLat, txLon, bearingDeg);
    const tx = latLonToGlobeCartesian(txLat, txLon);
    expect(dot(n, tx)).toBeCloseTo(0, 5);
    expect(mag(n)).toBeCloseTo(1);
  });
});
