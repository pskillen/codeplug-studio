import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ChannelTone } from '@core/models/libraryTypes.ts';
import { NONE_TONE } from '../../lib/channelFields/index.ts';
import { DesignSystemV2Provider } from '../v2/index.ts';
import ChannelToneField from './ChannelToneField.tsx';

function ControlledField({
  initialValue,
  onChangeSpy,
}: {
  initialValue: ChannelTone;
  onChangeSpy: (tone: ChannelTone) => void;
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <ChannelToneField
      label="RX tone"
      value={value}
      onChange={(tone) => {
        onChangeSpy(tone);
        setValue(tone);
      }}
    />
  );
}

function renderField(initialValue: ChannelTone) {
  const onChange = vi.fn<(tone: ChannelTone) => void>();
  render(
    <DesignSystemV2Provider>
      <ControlledField initialValue={initialValue} onChangeSpy={onChange} />
    </DesignSystemV2Provider>,
  );
  return onChange;
}

function clickKind(name: 'Off' | 'CTCSS' | 'DCS') {
  fireEvent.click(screen.getByRole('radio', { name }));
}

describe('ChannelToneField tone memory', () => {
  it('CTCSS → Off → CTCSS restores the last Hz', () => {
    const onChange = renderField('94.8');
    onChange.mockClear();

    clickKind('Off');
    expect(onChange).toHaveBeenCalledWith(NONE_TONE);

    clickKind('CTCSS');
    expect(onChange).toHaveBeenCalledWith('94.8');
    expect(screen.getByLabelText('RX tone frequency', { selector: 'input' })).toHaveValue(
      '94.8 Hz',
    );
  });

  it('DCS D023I → CTCSS → DCS restores D023I', () => {
    const onChange = renderField('D023I');
    onChange.mockClear();

    clickKind('CTCSS');
    expect(onChange).toHaveBeenCalledWith('none');

    clickKind('DCS');
    expect(onChange).toHaveBeenLastCalledWith('D023I');
    expect(screen.getByLabelText('RX tone code', { selector: 'input' })).toHaveValue('D023');
    expect(screen.getByRole('radio', { name: 'Inverted' })).toBeChecked();
  });

  it('CTCSS → DCS → CTCSS restores the last Hz', () => {
    const onChange = renderField('88.5');
    onChange.mockClear();

    clickKind('DCS');
    expect(onChange).toHaveBeenCalledWith('none');

    clickKind('CTCSS');
    expect(onChange).toHaveBeenLastCalledWith('88.5');
    expect(screen.getByLabelText('RX tone frequency', { selector: 'input' })).toHaveValue(
      '88.5 Hz',
    );
  });

  it('fresh Off → CTCSS shows an empty frequency select', () => {
    const onChange = renderField('none');
    onChange.mockClear();

    clickKind('CTCSS');
    expect(onChange).not.toHaveBeenCalled();
    const frequency = screen.getByLabelText('RX tone frequency', { selector: 'input' });
    expect(frequency).toHaveValue('');
  });
});

describe('ChannelToneField legacy D023P', () => {
  it('shows inverted DCS without rewriting storage until the field changes', () => {
    const onChange = renderField('D023P');
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: 'DCS' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Inverted' })).toBeChecked();
    expect(screen.getByLabelText('RX tone code', { selector: 'input' })).toHaveValue('D023');
  });
});
