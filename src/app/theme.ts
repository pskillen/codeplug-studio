import { createTheme, type ComboboxProps, type MantineColorsTuple } from '@mantine/core';

const brand: MantineColorsTuple = [
  '#e8f1ff',
  '#cfe0ff',
  '#9dbdff',
  '#6a9bff',
  '#4a87fd',
  '#4289fc',
  '#3d8bfd',
  '#2f6fd6',
  '#2257ad',
  '#06285e',
];

const dark: MantineColorsTuple = [
  '#e7ecf3',
  '#c7cfdb',
  '#8b9cb3',
  '#64748b',
  '#2d3a4f',
  '#212c3e',
  '#1a2332',
  '#0f1419',
  '#0a0e13',
  '#05070a',
];

/** Above Leaflet map panes (`.leaflet-top` uses z-index 1000). */
export const MODAL_ABOVE_MAP_Z_INDEX = 1200;

/** Combobox dropdowns on map pages (same band as Leaflet controls). */
export const MAP_COMBOBOX_Z_INDEX = 1000;

/** Select/Autocomplete dropdowns rendered inside modals. */
export const MODAL_COMBOBOX_Z_INDEX = MODAL_ABOVE_MAP_Z_INDEX + 100;

/**
 * Mantine Popover defaults `hideDetached: true`, which hides the dropdown when the
 * trigger is near the viewport edge. On long scrollable pages (Settings, mobile
 * WebView) that can scroll the trigger off-screen when the menu opens — see #902.
 */
export const COMBOBOX_DEFAULT_PROPS = {
  hideDetached: false,
} as const satisfies Partial<ComboboxProps>;

/** Merge combobox defaults with per-control overrides (theme shallow-merges `comboboxProps`). */
export function comboboxProps(overrides?: ComboboxProps): ComboboxProps {
  return { ...COMBOBOX_DEFAULT_PROPS, ...overrides };
}

export function mapComboboxProps(overrides?: ComboboxProps): ComboboxProps {
  return comboboxProps({ zIndex: MAP_COMBOBOX_Z_INDEX, ...overrides });
}

export function modalComboboxProps(overrides?: ComboboxProps): ComboboxProps {
  return comboboxProps({ zIndex: MODAL_COMBOBOX_Z_INDEX, ...overrides });
}

const comboboxComponentDefaults = {
  comboboxProps: COMBOBOX_DEFAULT_PROPS,
} as const;

export const theme = createTheme({
  primaryColor: 'brand',
  primaryShade: 6,
  colors: { brand, dark },
  fontFamily: 'system-ui, sans-serif',
  defaultRadius: 'md',
  spacing: {
    xs: '0.5rem',
    sm: '0.75rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
  },
  components: {
    Modal: {
      defaultProps: {
        zIndex: MODAL_ABOVE_MAP_Z_INDEX,
      },
    },
    Drawer: {
      defaultProps: {
        zIndex: MODAL_ABOVE_MAP_Z_INDEX,
      },
    },
    Paper: {
      defaultProps: {
        radius: 'md',
      },
    },
    Container: {
      defaultProps: {
        sizes: {
          sm: 540,
          md: 720,
          lg: 960,
          xl: 1140,
        },
      },
    },
    Select: {
      defaultProps: comboboxComponentDefaults,
    },
    Autocomplete: {
      defaultProps: comboboxComponentDefaults,
    },
    MultiSelect: {
      defaultProps: comboboxComponentDefaults,
    },
  },
});
