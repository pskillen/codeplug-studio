import { describe, expect, it } from 'vitest';
import {
  activeContextualStripLabel,
  helpStripItems,
  libraryStripItems,
  resolveContextualStripItems,
  toolsStripItems,
} from './contextualStripItems.ts';
import { primaryNavItems, projectNavItems } from './primaryNavItems.ts';

describe('primaryNavItems', () => {
  it('uses design-system tab order including Tools and Help', () => {
    expect(primaryNavItems.map((i) => i.label)).toEqual([
      'Summary',
      'Library',
      'Tools',
      'Export for radio',
      'Tracking Dashboard',
      'Help',
    ]);
  });

  it('keeps Tools on /reference and marks project-scoped tabs', () => {
    const tools = primaryNavItems.find((i) => i.label === 'Tools');
    expect(tools?.to).toBe('/reference');
    expect(tools?.requiresProject).toBeFalsy();
    expect(projectNavItems.map((i) => i.label)).toEqual([
      'Summary',
      'Library',
      'Export for radio',
      'Tracking Dashboard',
    ]);
  });
});

describe('contextualStripItems', () => {
  it('resolves library strip with design-system labels', () => {
    expect(resolveContextualStripItems('/library/channels')).toEqual(libraryStripItems);
    expect(libraryStripItems.map((i) => i.label)).toEqual([
      'Channels',
      'Zones',
      'Talk groups',
      'Contacts',
      'Receive group lists',
      'Scan lists',
      'APRS setup',
      'Satellite Keps',
    ]);
  });

  it('resolves Tools and Help strips', () => {
    expect(resolveContextualStripItems('/reference/bands')).toEqual(toolsStripItems);
    expect(resolveContextualStripItems('/attributions')).toEqual(helpStripItems);
  });

  it('picks the active strip label by longest path match', () => {
    expect(activeContextualStripLabel('/library/channels/defaults', libraryStripItems)).toBe(
      'Channels',
    );
    expect(activeContextualStripLabel('/reference/maidenhead', toolsStripItems)).toBe(
      'Maidenhead locator',
    );
  });
});
