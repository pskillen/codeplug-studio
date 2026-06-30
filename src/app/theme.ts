import { createTheme, type MantineColorsTuple } from '@mantine/core';

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
  },
});
