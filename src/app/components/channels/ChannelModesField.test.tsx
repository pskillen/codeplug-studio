import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import DesignSystemV2Provider from '../v2/DesignSystemV2Provider.tsx';
import ChannelModesField from './ChannelModesField.tsx';
import { modeColor } from '../../lib/channelModes.ts';

describe('ChannelModesField', () => {
  it('toggles mode selection', () => {
    const onChange = vi.fn();
    render(
      <DesignSystemV2Provider>
        <ChannelModesField selectedModes={['fm']} onChange={onChange} />
      </DesignSystemV2Provider>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'DMR' }));
    expect(onChange).toHaveBeenCalledWith(['fm', 'dmr']);
  });

  it('uses mode pill colours on selected chips', () => {
    render(
      <DesignSystemV2Provider>
        <ChannelModesField selectedModes={['dmr']} onChange={() => {}} />
      </DesignSystemV2Provider>,
    );

    expect(screen.getByRole('button', { name: 'DMR' })).toHaveStyle({
      backgroundColor: modeColor('dmr'),
    });
  });
});
