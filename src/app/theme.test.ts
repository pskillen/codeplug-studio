import { describe, expect, it } from 'vitest';
import {
  COMBOBOX_DEFAULT_PROPS,
  MAP_COMBOBOX_Z_INDEX,
  MODAL_COMBOBOX_Z_INDEX,
  comboboxProps,
  mapComboboxProps,
  modalComboboxProps,
} from './theme.ts';

describe('comboboxProps helpers', () => {
  it('keeps hideDetached false in defaults', () => {
    expect(COMBOBOX_DEFAULT_PROPS.hideDetached).toBe(false);
  });

  it('merges overrides without dropping hideDetached', () => {
    expect(comboboxProps({ zIndex: 42 })).toEqual({
      hideDetached: false,
      zIndex: 42,
    });
  });

  it('provides map and modal z-index presets', () => {
    expect(mapComboboxProps()).toEqual({
      hideDetached: false,
      zIndex: MAP_COMBOBOX_Z_INDEX,
    });
    expect(modalComboboxProps()).toEqual({
      hideDetached: false,
      zIndex: MODAL_COMBOBOX_Z_INDEX,
    });
  });
});
