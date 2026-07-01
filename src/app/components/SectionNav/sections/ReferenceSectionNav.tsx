import { NavLink, Stack } from '@mantine/core';
import { IconChartBar, IconGridDots } from '@tabler/icons-react';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../../lib/iconSizes.ts';
import { scrollToPageSection } from '../../../lib/scrollToPageSection.ts';

export default function ReferenceSectionNav() {
  return (
    <Stack gap={4}>
      <NavLink
        component="button"
        type="button"
        label="Maidenhead locator"
        leftSection={<IconGridDots size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
        onClick={() => scrollToPageSection('reference-maidenhead')}
      />
      <NavLink
        component="button"
        type="button"
        label="Frequency → band"
        leftSection={<IconChartBar size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
        onClick={() => scrollToPageSection('reference-frequency')}
      />
      <NavLink
        component="button"
        type="button"
        label="Band plan"
        leftSection={<IconChartBar size={ICON_SIZE_NAV} stroke={ICON_STROKE} />}
        onClick={() => scrollToPageSection('reference-band-plan')}
      />
    </Stack>
  );
}
