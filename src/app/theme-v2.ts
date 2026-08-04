import {
  createTheme,
  DEFAULT_THEME,
  defaultCssVariablesResolver,
  mergeMantineTheme,
  type CSSVariablesResolver,
  type MantineColorsTuple,
} from '@mantine/core';
import { theme } from './theme.ts';

/** Scopes v2 CSS variables to the nested provider wrapper — never `:root`. */
export const DSV2_SCOPE_SELECTOR = '.dsv2-scope';

/**
 * Design system v2 tokens (Claude Design "Codeplug Studio Design System").
 * Source of truth for Phase 1 foundations (#916); net-new v2 components reference
 * these directly (and via `--dsv2-*` CSS vars) rather than remapping Mantine spacing.
 */
export const DSV2_TOKENS = {
  colors: {
    bg: '#0b0f14',
    surface: '#141b24',
    surfaceQuiet: '#0d1218',
    border: '#232b36',
    borderQuiet: '#1a2129',
    textPrimary: '#e8ecf1',
    textSecondary: '#93a1b0',
    textTertiary: '#5b6b7c',
    textDisabled: '#3a4451',
    accent: '#4f8cff',
    accentHover: '#6f9fff',
    success: '#4fae8a',
    warning: '#d7a34f',
    destructive: '#d1665c',
    band2m: '#4a87fd',
    band70cm: '#20c997',
    band23cm: '#9c36b5',
    modeFm: '#f0c419',
    modeAm: '#fab005',
    modeSsb: '#fd7e14',
    modeDmr: '#e03131',
    modeYsf: '#339af0',
    modeDstar: '#7950f2',
    modeP25: '#12b886',
    modeNxdn: '#868e96',
    modeM17: '#20c997',
    modeTetra: '#6741d9',
    modeOther: '#9c36b5',
  },
  typography: {
    fontFamily: 'system-ui, sans-serif',
    sizes: {
      display: '22px',
      title: '16px',
      body: '13px',
      bodyStrong: '13px',
      label: '12.5px',
      caption: '11px',
      micro: '10.5px',
    },
    weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },
  spacing: {
    '1': '4px',
    '2': '6px',
    '3': '8px',
    '4': '10px',
    '5': '12px',
    '6': '14px',
    '7': '16px',
    '8': '20px',
    '9': '24px',
    '10': '32px',
    pagePaddingX: '32px',
    pagePaddingY: '26px',
    panelPaddingX: '18px',
    panelPaddingY: '20px',
    rowPaddingY: '11px',
    rowPaddingX: '16px',
  },
  radii: {
    control: '8px',
    panel: '10px',
    pill: '999px',
    sm: '6px',
  },
  shadows: {
    popover: '0 8px 24px rgba(0,0,0,.35)',
  },
} as const;

/** Accent blue ladder seeded from DSV2 accent `#4f8cff`. */
const brandV2: MantineColorsTuple = [
  '#e8f1ff',
  '#cfe0ff',
  '#9dbdff',
  '#6f9fff',
  '#4f8cff',
  '#4f8cff',
  '#3d7aef',
  '#2f6fd6',
  '#2257ad',
  '#06285e',
];

/**
 * Dark ladder aligned to v2 surfaces (bg / surface / borders).
 * Index 7 ≈ page bg; 6 ≈ surface; 4–5 ≈ borders.
 */
const darkV2: MantineColorsTuple = [
  '#e8ecf1',
  '#93a1b0',
  '#5b6b7c',
  '#3a4451',
  '#232b36',
  '#1a2129',
  '#141b24',
  '#0b0f14',
  '#0d1218',
  '#05070a',
];

/**
 * Radius remap so stock Mantine size props (`sm`/`md`/…) resolve to design-system
 * corners inside the v2 subtree. Custom keys (`control`/`panel`/`pill`) match the
 * design system names for net-new components.
 */
const themeV2Override = createTheme({
  primaryColor: 'brand',
  primaryShade: 5,
  colors: {
    brand: brandV2,
    dark: darkV2,
  },
  fontFamily: DSV2_TOKENS.typography.fontFamily,
  defaultRadius: 'md',
  radius: {
    xs: '4px',
    sm: DSV2_TOKENS.radii.sm,
    md: DSV2_TOKENS.radii.panel,
    lg: DSV2_TOKENS.radii.panel,
    xl: DSV2_TOKENS.radii.pill,
    control: DSV2_TOKENS.radii.control,
    panel: DSV2_TOKENS.radii.panel,
    pill: DSV2_TOKENS.radii.pill,
  },
  shadows: {
    xs: 'none',
    sm: 'none',
    md: 'none',
    lg: DSV2_TOKENS.shadows.popover,
    xl: DSV2_TOKENS.shadows.popover,
  },
  white: DSV2_TOKENS.colors.textPrimary,
  black: DSV2_TOKENS.colors.bg,
  components: {
    Paper: {
      defaultProps: {
        radius: 'panel',
        shadow: 'none',
      },
    },
  },
});

/**
 * Full v2 theme: DEFAULT_THEME ← existing app `theme` (combobox / z-index plumbing)
 * ← v2 token overrides. Keeps #902 `hideDetached` and modal/drawer z-index defaults.
 */
export const themeV2 = mergeMantineTheme(mergeMantineTheme(DEFAULT_THEME, theme), themeV2Override);

/**
 * Composes over `defaultCssVariablesResolver` so stock Mantine `--mantine-*` vars
 * still exist inside `.dsv2-scope`. Adds `--dsv2-*` mirrors of the design-system
 * token names and a few semantic Mantine overrides for free re-skinning.
 */
export const dsv2CssVariablesResolver: CSSVariablesResolver = (mantineTheme) => {
  const base = defaultCssVariablesResolver(mantineTheme);
  const { colors, typography, spacing, radii, shadows } = DSV2_TOKENS;

  const dsv2Variables: Record<string, string> = {
    '--dsv2-bg': colors.bg,
    '--dsv2-surface': colors.surface,
    '--dsv2-surface-quiet': colors.surfaceQuiet,
    '--dsv2-border': colors.border,
    '--dsv2-border-quiet': colors.borderQuiet,
    '--dsv2-text-primary': colors.textPrimary,
    '--dsv2-text-secondary': colors.textSecondary,
    '--dsv2-text-tertiary': colors.textTertiary,
    '--dsv2-text-disabled': colors.textDisabled,
    '--dsv2-accent': colors.accent,
    '--dsv2-accent-hover': colors.accentHover,
    '--dsv2-success': colors.success,
    '--dsv2-warning': colors.warning,
    '--dsv2-destructive': colors.destructive,
    '--dsv2-band-2m': colors.band2m,
    '--dsv2-band-70cm': colors.band70cm,
    '--dsv2-band-23cm': colors.band23cm,
    '--dsv2-mode-fm': colors.modeFm,
    '--dsv2-mode-am': colors.modeAm,
    '--dsv2-mode-ssb': colors.modeSsb,
    '--dsv2-mode-dmr': colors.modeDmr,
    '--dsv2-mode-ysf': colors.modeYsf,
    '--dsv2-mode-dstar': colors.modeDstar,
    '--dsv2-mode-p25': colors.modeP25,
    '--dsv2-mode-nxdn': colors.modeNxdn,
    '--dsv2-mode-m17': colors.modeM17,
    '--dsv2-mode-tetra': colors.modeTetra,
    '--dsv2-mode-other': colors.modeOther,
    '--dsv2-font-family': typography.fontFamily,
    '--dsv2-font-display': typography.sizes.display,
    '--dsv2-font-title': typography.sizes.title,
    '--dsv2-font-body': typography.sizes.body,
    '--dsv2-font-label': typography.sizes.label,
    '--dsv2-font-caption': typography.sizes.caption,
    '--dsv2-font-micro': typography.sizes.micro,
    '--dsv2-space-1': spacing['1'],
    '--dsv2-space-2': spacing['2'],
    '--dsv2-space-3': spacing['3'],
    '--dsv2-space-4': spacing['4'],
    '--dsv2-space-5': spacing['5'],
    '--dsv2-space-6': spacing['6'],
    '--dsv2-space-7': spacing['7'],
    '--dsv2-space-8': spacing['8'],
    '--dsv2-space-9': spacing['9'],
    '--dsv2-space-10': spacing['10'],
    '--dsv2-page-padding-x': spacing.pagePaddingX,
    '--dsv2-page-padding-y': spacing.pagePaddingY,
    '--dsv2-panel-padding-x': spacing.panelPaddingX,
    '--dsv2-panel-padding-y': spacing.panelPaddingY,
    '--dsv2-row-padding-y': spacing.rowPaddingY,
    '--dsv2-row-padding-x': spacing.rowPaddingX,
    '--dsv2-radius-control': radii.control,
    '--dsv2-radius-panel': radii.panel,
    '--dsv2-radius-pill': radii.pill,
    '--dsv2-radius-sm': radii.sm,
    '--dsv2-shadow-popover': shadows.popover,
  };

  return {
    variables: {
      ...base.variables,
      ...dsv2Variables,
    },
    light: {
      ...base.light,
      '--mantine-color-body': colors.bg,
      '--mantine-color-text': colors.textPrimary,
      '--mantine-color-dimmed': colors.textSecondary,
      '--mantine-color-placeholder': colors.textTertiary,
      '--mantine-color-default': colors.surface,
      '--mantine-color-default-hover': colors.surfaceQuiet,
      '--mantine-color-default-color': colors.textPrimary,
      '--mantine-color-default-border': colors.border,
      '--mantine-color-error': colors.destructive,
      '--mantine-color-success': colors.success,
      '--mantine-color-anchor': colors.accent,
    },
    dark: {
      ...base.dark,
      '--mantine-color-body': colors.bg,
      '--mantine-color-text': colors.textPrimary,
      '--mantine-color-dimmed': colors.textSecondary,
      '--mantine-color-placeholder': colors.textTertiary,
      '--mantine-color-default': colors.surface,
      '--mantine-color-default-hover': colors.surfaceQuiet,
      '--mantine-color-default-color': colors.textPrimary,
      '--mantine-color-default-border': colors.border,
      '--mantine-color-error': colors.destructive,
      '--mantine-color-success': colors.success,
      '--mantine-color-anchor': colors.accent,
    },
  };
};
