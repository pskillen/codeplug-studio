import { describe, expect, it } from 'vitest';
import {
  activeContextualStripLabel,
  buildToolsStripItems,
  helpStripItems,
  libraryStripItems,
  resolveContextualStripItems,
  toolsStripItems,
  SHOW_PROPAGATION_VISUALISER,
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
      'Digital IDs',
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

  it('includes Tracking Dashboard in the Tools strip and hides the Propagation Visualiser by default', () => {
    expect(buildToolsStripItems(false).map((i) => i.label)).toEqual([
      'Maidenhead locator',
      'Band plan',
      'Tracking Dashboard',
    ]);
    expect(SHOW_PROPAGATION_VISUALISER).toBe(false);
    expect(toolsStripItems.find((i) => i.label === 'Tracking Dashboard')?.to).toBe('/tracking');
    expect(toolsStripItems.some((i) => i.label === 'Propagation Visualiser')).toBe(false);

    const withPropagation = buildToolsStripItems(false, true);
    const propagation = withPropagation.find((i) => i.label === 'Propagation Visualiser');
    expect(propagation?.to).toBe('https://propagation.mm9pdy.net/');
    expect(propagation?.external).toBe(true);

    expect(resolveContextualStripItems('/tracking')).toEqual(toolsStripItems);
    expect(resolveContextualStripItems('/reference/rf-propagation')).toEqual(toolsStripItems);
  });

  it('treats the tracking and firmware pages as part of the Tools tab', () => {
    const tools = primaryNavItems.find((i) => i.label === 'Tools');
    expect(tools?.alsoActiveFor).toEqual(['/tracking', '/firmware']);
  });

  it('adds the firmware flasher to the Tools strip only when a radio is offered', () => {
    expect(buildToolsStripItems(true).map((i) => i.label)).toEqual([
      'Maidenhead locator',
      'Band plan',
      'Tracking Dashboard',
      'Firmware flasher',
    ]);
    expect(buildToolsStripItems(false).some((i) => i.to === '/firmware')).toBe(false);
    // Tests run as the `local` build: the flasher is offered.
    expect(toolsStripItems.some((i) => i.to === '/firmware')).toBe(true);
    expect(resolveContextualStripItems('/firmware')).toEqual(toolsStripItems);
    expect(activeContextualStripLabel('/firmware', toolsStripItems)).toBe('Firmware flasher');
  });

  it('excludes external items from the active strip label', () => {
    expect(activeContextualStripLabel('/library/channels/defaults', libraryStripItems)).toBe(
      'Channels',
    );
    expect(activeContextualStripLabel('/reference/maidenhead', toolsStripItems)).toBe(
      'Maidenhead locator',
    );
    expect(
      activeContextualStripLabel('/reference/rf-propagation', buildToolsStripItems(false, true)),
    ).toBeNull();
  });
});
