/** Selected profiles describe expectations, never observed radio identity. */
export interface RadioDebugDescriptor {
  slug: string;
  model: string;
  family: string;
  capabilities: readonly { name: string; status: 'Not yet available' }[];
}

const unavailable = ['Backup', 'Calibration', 'Memory'].map((name) => ({
  name,
  status: 'Not yet available' as const,
}));

export const radioDebugDescriptors: readonly RadioDebugDescriptor[] = [
  {
    slug: 'at-d890uv',
    model: 'AT-D890UV',
    family: 'AnyTone · stock / MM9PDY',
    capabilities: unavailable,
  },
  {
    slug: 'dm-32uv',
    model: 'DM-32UV',
    family: 'Baofeng · stock / MM9PDY',
    capabilities: unavailable,
  },
  {
    slug: 'dm-32uv-radiofoundry',
    model: 'DM-32UV',
    family: 'RadioFoundry',
    capabilities: unavailable,
  },
  { slug: 'dm-1701-opengd77', model: 'DM-1701', family: 'OpenGD77', capabilities: unavailable },
  { slug: 'md-9600-opengd77', model: 'MD-9600', family: 'OpenGD77', capabilities: unavailable },
  { slug: 'rt95', model: 'RT95', family: 'Stock / MM9PDY', capabilities: unavailable },
  {
    slug: 'uv-21-pro-v2',
    model: 'UV-21 Pro V2',
    family: 'Stock family',
    capabilities: unavailable,
  },
  { slug: 'uv-5r-mini', model: 'UV-5R Mini', family: 'Stock / MM9PDY', capabilities: unavailable },
];
