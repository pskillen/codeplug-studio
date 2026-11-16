import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import type { ValueTableView } from '@integrations/radio-io/debugView';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import ValueTable from './ValueTable.tsx';

const wrap = (ui: ReactNode) => render(<DesignSystemV2Provider>{ui}</DesignSystemV2Provider>);

const single: ValueTableView = {
  id: 't',
  title: 'Fields',
  layout: 'single',
  rows: [
    {
      id: 'a',
      label: 'Version',
      group: 'Header',
      cells: [{ decoded: 'V1.61', raw: new Uint8Array([1, 0x3d]), availability: 'captured' }],
      confidence: { layout: 'traced', meaning: 'inferred' },
      source: 'fw 1.6',
    },
    { id: 'b', label: 'Gain', cells: [{ value: 26, availability: 'captured' }] },
    { id: 'c', label: 'Missing', cells: [{ availability: 'not-captured' }] },
    {
      id: 'd',
      label: 'Secret',
      cells: [{ value: 7, raw: new Uint8Array([7]), sensitive: true, availability: 'captured' }],
    },
  ],
};

describe('ValueTable', () => {
  it('renders decoded, raw integers, not captured and two badges', () => {
    wrap(<ValueTable table={single} />);
    expect(screen.getByText('V1.61')).toBeInTheDocument();
    expect(screen.getByText('01 3D')).toBeInTheDocument();
    expect(screen.getByText('0x1A (26)')).toBeInTheDocument();
    expect(screen.getAllByText('Not captured').length).toBeGreaterThan(0);
    expect(screen.getAllByText('traced').length).toBeGreaterThan(0);
    expect(screen.getAllByText('inferred').length).toBeGreaterThan(0);
  });

  it('leaves Raw empty for a captured value with no raw bytes; Not captured only where it was', () => {
    wrap(<ValueTable table={single} />);
    // Only the "Missing" row: its Value and its Raw cell.
    expect(screen.getAllByText('Not captured')).toHaveLength(2);
  });

  it('masks sensitive cells until revealed', () => {
    const { unmount } = wrap(<ValueTable table={single} />);
    expect(screen.getAllByText('••').length).toBe(2);
    unmount();
    wrap(<ValueTable table={single} revealed />);
    expect(screen.queryByText('••')).toBeNull();
    expect(screen.getByText('0x07 (7)')).toBeInTheDocument();
  });

  it('marks changed overlay cells', () => {
    const overlay: ValueTableView = {
      ...single,
      rows: single.rows.map((r) =>
        r.id === 'b' ? { ...r, cells: [{ value: 30, availability: 'captured' as const }] } : r,
      ),
    };
    const { container } = wrap(<ValueTable table={single} overlay={overlay} />);
    expect(screen.getByText('Overlay')).toBeInTheDocument();
    expect(container.querySelectorAll('[data-changed="true"]').length).toBe(1);
  });

  it('puts one Value and Raw pair per band in a row', () => {
    const banded: ValueTableView = {
      id: 'b',
      title: 'Bands',
      layout: { bands: ['VHF', 'UHF'] },
      rows: [
        {
          id: 'p',
          label: 'Power',
          cells: [
            { decoded: '5', availability: 'captured' },
            { decoded: '4', availability: 'captured' },
          ],
        },
      ],
    };
    wrap(<ValueTable table={banded} />);
    expect(screen.getByText('VHF')).toBeInTheDocument();
    expect(screen.getByText('UHF')).toBeInTheDocument();
    expect(screen.getAllByText('Value')).toHaveLength(2);
    expect(screen.getAllByText('Raw')).toHaveLength(2);
  });

  it('labels the two confidence pills and does not repeat hex in Raw', () => {
    const view: ValueTableView = {
      id: 'h',
      title: 'Hex',
      layout: 'single',
      rows: [
        {
          id: 'x',
          label: 'Byte',
          cells: [{ value: 26, raw: new Uint8Array([0x1a]), availability: 'captured' }],
          confidence: { layout: 'traced', meaning: 'traced' },
        },
        {
          id: 'y',
          label: 'Freq',
          cells: [
            { value: 26, raw: new Uint8Array([0x1a]), format: 'decimal', availability: 'captured' },
          ],
        },
      ],
    };
    wrap(<ValueTable table={view} />);
    expect(screen.getAllByText('Layout').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Meaning').length).toBeGreaterThan(0);
    // 0x1A (26) already shows the byte; the decimal row keeps its raw hex.
    expect(screen.queryAllByText('1A')).toHaveLength(1);
  });
});
