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
  it('orders tabs with Tools immediately before Help', () => {
    expect(primaryNavItems.map((i) => i.label)).toEqual([
      'Summary',
      'Library',
      'Export for radio',
      'Tools',
      'Help',
    ]);
  });

  it('keeps Tools on /reference and marks project-scoped tabs', () => {
    const tools = primaryNavItems.find((i) => i.label === 'Tools');
    expect(tools?.to).toBe('/reference');
    expect(tools?.requiresProject).toBeFalsy();
    expect(projectNavItems.map((i) => i.label)).toEqual(['Summary', 'Library', 'Export for radio']);
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

  it('includes Tracking Dashboard and an external Propagation Visualiser link in the Tools strip, on every env', () => {
    expect(toolsStripItems.map((i) => i.label)).toEqual([
      'Maidenhead locator',
      'Band plan',
      'Tracking Dashboard',
      'Propagation Visualiser',
    ]);
    expect(toolsStripItems.find((i) => i.label === 'Tracking Dashboard')?.to).toBe('/tracking');
    const propagation = toolsStripItems.find((i) => i.label === 'Propagation Visualiser');
    expect(propagation?.to).toBe('https://propagation.mm9pdy.net/');
    expect(propagation?.external).toBe(true);

    expect(resolveContextualStripItems('/tracking')).toEqual(toolsStripItems);
    expect(resolveContextualStripItems('/reference/rf-propagation')).toEqual(toolsStripItems);
  });

  it('excludes external items from the active strip label', () => {
    expect(activeContextualStripLabel('/library/channels/defaults', libraryStripItems)).toBe(
      'Channels',
    );
    expect(activeContextualStripLabel('/reference/maidenhead', toolsStripItems)).toBe(
      'Maidenhead locator',
    );
    expect(activeContextualStripLabel('/reference/rf-propagation', toolsStripItems)).toBeNull();
  });
});
