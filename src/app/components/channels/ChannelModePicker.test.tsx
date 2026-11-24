import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import ChannelModePicker, { AddModeMenu } from './ChannelModePicker.tsx';
import { MODE_PRESETS } from '../../lib/channelModes.ts';

function renderPicker(
  props: Partial<ComponentProps<typeof ChannelModePicker>> & {
    modes?: ComponentProps<typeof ChannelModePicker>['modes'];
  } = {},
) {
  const onSwitch = vi.fn();
  const onAdd = vi.fn();
  const onRemove = vi.fn();
  const onPreset = vi.fn();
  render(
    <DesignSystemV2Provider>
      <ChannelModePicker
        modes={props.modes ?? []}
        onSwitch={onSwitch}
        onAdd={onAdd}
        onRemove={onRemove}
        onPreset={onPreset}
        {...props}
      />
    </DesignSystemV2Provider>,
  );
  return { onSwitch, onAdd, onRemove, onPreset };
}

describe('ChannelModePicker', () => {
  it('shows placeholder presets and other modes with no modes selected', () => {
    renderPicker();
    expect(screen.getByRole('group', { name: 'Which mode does this channel use?' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'FMAnalogue' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'DMRDigital' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /FM \+ DMR/ })).toBeTruthy();
    expect(screen.getByText('Analogue')).toBeTruthy();
    expect(screen.getByText('Dual-mode repeater')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'AM' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'NXDN' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'P25' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'M17' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /More/ })).toBeTruthy();
  });

  it('calls onPreset for FM + DMR', () => {
    const { onPreset } = renderPicker();
    fireEvent.click(screen.getByRole('button', { name: /FM \+ DMR/ }));
    expect(onPreset).toHaveBeenCalledWith(MODE_PRESETS.find((p) => p.id === 'fm-dmr'));
  });

  it('opens More under placeholder and switches to YSF', async () => {
    const { onSwitch } = renderPicker();
    fireEvent.click(screen.getByRole('radio', { name: /More/ }));
    fireEvent.click(await screen.findByRole('menuitem', { name: 'YSF' }));
    expect(onSwitch).toHaveBeenCalledWith('ysf');
  });

  it('single mode DMR: FM switches, DMR does not', () => {
    const { onSwitch } = renderPicker({ modes: ['dmr'] });
    const group = screen.getByRole('radiogroup', { name: 'Mode' });
    expect(within(group).getByRole('radio', { name: 'DMR' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    fireEvent.click(within(group).getByRole('radio', { name: 'FM' }));
    expect(onSwitch).toHaveBeenCalledWith('fm');
    onSwitch.mockClear();
    fireEvent.click(within(group).getByRole('radio', { name: 'DMR' }));
    expect(onSwitch).not.toHaveBeenCalled();
  });

  it('single mode YSF: More chip shows YSF checked', () => {
    renderPicker({ modes: ['ysf'] });
    const more = screen.getByRole('radio', { name: /YSF/ });
    expect(more).toHaveAttribute('aria-checked', 'true');
  });

  it('two modes: remove and add menus', async () => {
    const { onRemove, onAdd } = renderPicker({ modes: ['fm', 'dmr'] });
    fireEvent.click(screen.getByRole('button', { name: 'Remove FM' }));
    expect(onRemove).toHaveBeenCalledWith('fm');
    fireEvent.click(screen.getByRole('button', { name: '+ Add another mode' }));
    const items = (await screen.findAllByRole('menuitem', { hidden: true })).map(
      (el) => el.textContent,
    );
    expect(items).toEqual(['AM', 'NXDN', 'P25', 'M17', 'SSB', 'D-STAR', 'YSF', 'Tetra']);
    const nxdn = (await screen.findAllByRole('menuitem', { hidden: true })).find(
      (el) => el.textContent === 'NXDN',
    );
    fireEvent.click(nxdn!);
    expect(onAdd).toHaveBeenCalledWith('nxdn');
  });
});

describe('AddModeMenu', () => {
  it('renders link variant', () => {
    render(
      <DesignSystemV2Provider>
        <AddModeMenu modes={['fm']} onAdd={() => {}} variant="link" />
      </DesignSystemV2Provider>,
    );
    expect(screen.getByRole('button', { name: '+ Also runs another mode' })).toBeTruthy();
  });
});
