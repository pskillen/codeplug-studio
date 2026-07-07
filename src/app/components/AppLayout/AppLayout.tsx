import { AppShell, Box, Divider, Group } from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import { Outlet } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import AppNav from '../AppNav/AppNav.tsx';
import SectionNav from '../SectionNav/SectionNav.tsx';
import AppHeader from '../ui/AppHeader.tsx';
import BuildFooter from '../BuildFooter/BuildFooter.tsx';
import CookieConsentBanner from '../CookieConsentBanner/CookieConsentBanner.tsx';
import {
  NAVBAR_WIDTH_WITH_SECONDARY,
  PRIMARY_NAV_WIDTH,
  SECONDARY_NAV_WIDTH,
} from '../../nav/navWidths.ts';
import { shouldShowSecondaryNav } from '../../nav/sectionNavRegistry.ts';
import { useProjects } from '../../state/useProjects.ts';

export default function AppLayout() {
  const [opened, { toggle, close }] = useDisclosure();
  const isDesktopNav = useMediaQuery('(min-width: 48em)');
  const location = useLocation();
  const { activeProjectId } = useProjects();
  const hasActiveProject = activeProjectId != null;
  const showSecondary = shouldShowSecondaryNav(location.pathname, hasActiveProject);
  const navbarWidth = showSecondary ? NAVBAR_WIDTH_WITH_SECONDARY : PRIMARY_NAV_WIDTH;

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{
        width: navbarWidth,
        breakpoint: 'sm',
        collapsed: { mobile: !opened },
      }}
      padding="md"
    >
      <AppShell.Header>
        <AppHeader opened={opened} onToggle={toggle} />
      </AppShell.Header>

      <AppShell.Navbar p={0}>
        <Group wrap="nowrap" align="stretch" gap={0} style={{ height: '100%' }}>
          <Box w={PRIMARY_NAV_WIDTH} p="md" style={{ flexShrink: 0 }}>
            <AppNav onNavClick={close} />
          </Box>
          {showSecondary && isDesktopNav ? (
            <>
              <Divider orientation="vertical" />
              <Box w={SECONDARY_NAV_WIDTH} p="md" style={{ flexShrink: 0, overflow: 'hidden' }}>
                <SectionNav variant="sidebar" />
              </Box>
            </>
          ) : null}
        </Group>
      </AppShell.Navbar>

      <AppShell.Main>
        {showSecondary && !isDesktopNav ? (
          <Box mb="md">
            <SectionNav variant="toolbar" />
          </Box>
        ) : null}
        <CookieConsentBanner />
        <Outlet />
        <BuildFooter />
      </AppShell.Main>
    </AppShell>
  );
}
