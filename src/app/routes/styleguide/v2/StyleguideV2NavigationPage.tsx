import { Stack, Text } from '@mantine/core';
import { IconBooks, IconChartBar, IconHammer, IconHome } from '@tabler/icons-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Page, PageHeader, PageSection } from '../../../components/ui/index.ts';
import { AppShell, BottomTabBar } from '../../../components/v2/index.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../../lib/iconSizes.ts';

const TABS = [
  {
    id: 'library',
    label: 'Library',
    icon: <IconBooks size={ICON_SIZE_NAV} stroke={ICON_STROKE} />,
    badge: 12,
  },
  {
    id: 'summary',
    label: 'Summary',
    icon: <IconChartBar size={ICON_SIZE_NAV} stroke={ICON_STROKE} />,
  },
  {
    id: 'builds',
    label: 'Builds',
    icon: <IconHammer size={ICON_SIZE_NAV} stroke={ICON_STROKE} />,
  },
  {
    id: 'home',
    label: 'Projects',
    icon: <IconHome size={ICON_SIZE_NAV} stroke={ICON_STROKE} />,
  },
] as const;

export default function StyleguideV2NavigationPage() {
  const [activeId, setActiveId] = useState<string>('library');

  return (
    <Page width="wide">
      <PageHeader
        title="Navigation"
        description={
          <>
            <Link to="/styleguide/v2">← Design system v2</Link>
          </>
        }
      />

      <PageSection
        title="AppShell + BottomTabBar"
        description="Presentational only — not wired to real routes (#917)."
      >
        <AppShell
          header={
            <Text fw={600} size="sm">
              Codeplug Studio
            </Text>
          }
          nav={
            <Stack gap={6}>
              {TABS.map((tab) => (
                <Text
                  key={tab.id}
                  size="sm"
                  c={tab.id === activeId ? undefined : 'dimmed'}
                  fw={tab.id === activeId ? 600 : 400}
                >
                  {tab.label}
                </Text>
              ))}
            </Stack>
          }
          contextualStrip={<Text size="sm">Channels</Text>}
          bottomBar={<BottomTabBar items={[...TABS]} activeId={activeId} onChange={setActiveId} />}
        >
          <Text size="sm">
            Main content for <strong>{activeId}</strong>. Narrow the viewport to hide the side nav
            and rely on the bottom tab bar.
          </Text>
        </AppShell>
      </PageSection>
    </Page>
  );
}
