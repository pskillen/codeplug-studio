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
 * Design system v2 tokens — mirrored from
 * `Codeplug Studio Design System/tokens/{colors,typography,spacing,radii,shadows}.css`.
 */
export const DSV2_TOKENS = {
  colors: {
    bg: '#0b0f14',
    surface: '#141b24',
    surfaceQuiet: '#0d1218',
    border: '#232b36',
    borderQuiet: '#1a2129',
    borderStrip: '#1c232d',
    textPrimary: '#e8ecf1',
    textSecondary: '#93a1b0',
    textTertiary: '#5b6b7c',
    textDisabled: '#3a4451',
    accent: '#4f8cff',
    accentHover: '#6f9fff',
    accentTint06: 'rgba(79,140,255,.06)',
    accentTint10: 'rgba(79,140,255,.10)',
    accentTint12: 'rgba(79,140,255,.12)',
    accentTint14: 'rgba(79,140,255,.14)',
    accentBorder: 'rgba(79,140,255,.4)',
    success: '#4fae8a',
    successTint: 'rgba(79,174,138,.07)',
    successBorder: '#2a3a30',
    warning: '#d7a34f',
    warningTint: 'rgba(215,163,79,.12)',
    warningBorder: '#3a3320',
    destructive: '#d1665c',
    destructiveTint: 'rgba(209,102,92,.12)',
    pillTextDark: '#14161a',
    pillTextLight: '#fff',
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
    fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
    fontFamilyMono: 'ui-monospace, Menlo, monospace',
    sizes: {
      /** `--text-heading-lg` */
      headingLg: '22px',
      /** `--text-heading` */
      heading: '16px',
      /** `--text-section-label` / `--text-body` */
      sectionLabel: '13px',
      body: '13px',
      /** `--text-body-sm` */
      bodySm: '12.5px',
      /** `--text-micro` */
      micro: '11px',
      /** `--text-eyebrow` */
      eyebrow: '10.5px',
    },
    weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    trackingEyebrow: '0.05em',
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
    /** DS `--panel-padding: 18px 20px` → y x */
    panelPaddingY: '18px',
    panelPaddingX: '20px',
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
  /**
   * Two-step icon scale: `nav` for primary navigation/chrome icons, `action` for
   * denser in-row action icons (e.g. `RowActionIcon`). The mk2 DS export never
   * formalized a second size token (ad hoc 11.5–20px observed, no consistent
   * nav/action split) — these values come from the pre-existing app constants
   * in `lib/iconSizes.ts`, not invented from the unsettled DS bundle.
   */
  iconSize: {
    nav: 16,
    action: 18,
    stroke: 1.5,
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
  fontFamilyMonospace: DSV2_TOKENS.typography.fontFamilyMono,
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
  const { colors, typography, spacing, radii, shadows, iconSize } = DSV2_TOKENS;

  const dsv2Variables: Record<string, string> = {
    '--dsv2-bg': colors.bg,
    '--dsv2-surface': colors.surface,
    '--dsv2-surface-quiet': colors.surfaceQuiet,
    '--dsv2-border': colors.border,
    '--dsv2-border-quiet': colors.borderQuiet,
    '--dsv2-border-strip': colors.borderStrip,
    '--dsv2-text-primary': colors.textPrimary,
    '--dsv2-text-secondary': colors.textSecondary,
    '--dsv2-text-tertiary': colors.textTertiary,
    '--dsv2-text-disabled': colors.textDisabled,
    '--dsv2-accent': colors.accent,
    '--dsv2-accent-hover': colors.accentHover,
    '--dsv2-accent-tint-06': colors.accentTint06,
    '--dsv2-accent-tint-10': colors.accentTint10,
    '--dsv2-accent-tint-12': colors.accentTint12,
    '--dsv2-accent-tint-14': colors.accentTint14,
    '--dsv2-accent-border': colors.accentBorder,
    '--dsv2-success': colors.success,
    '--dsv2-success-tint': colors.successTint,
    '--dsv2-success-border': colors.successBorder,
    '--dsv2-warning': colors.warning,
    '--dsv2-warning-tint': colors.warningTint,
    '--dsv2-warning-border': colors.warningBorder,
    '--dsv2-destructive': colors.destructive,
    '--dsv2-destructive-tint': colors.destructiveTint,
    '--dsv2-pill-text-dark': colors.pillTextDark,
    '--dsv2-pill-text-light': colors.pillTextLight,
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
    '--dsv2-font-mono': typography.fontFamilyMono,
    '--dsv2-font-heading-lg': typography.sizes.headingLg,
    '--dsv2-font-heading': typography.sizes.heading,
    '--dsv2-font-section-label': typography.sizes.sectionLabel,
    '--dsv2-font-body': typography.sizes.body,
    '--dsv2-font-body-sm': typography.sizes.bodySm,
    '--dsv2-font-micro': typography.sizes.micro,
    '--dsv2-font-eyebrow': typography.sizes.eyebrow,
    '--dsv2-tracking-eyebrow': typography.trackingEyebrow,
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
    '--dsv2-icon-size-nav': `${iconSize.nav}px`,
    '--dsv2-icon-size-action': `${iconSize.action}px`,
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
