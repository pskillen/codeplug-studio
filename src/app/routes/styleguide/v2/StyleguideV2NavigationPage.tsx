import { Stack, Text } from '@mantine/core';
import { IconBooks, IconChartBar, IconHammer, IconHome } from '@tabler/icons-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Page, PageHeader, PageSection } from '../../../components/ui/index.ts';
import {
  AppShell,
  BottomTabBar,
  ContextualStrip,
  EditorHeader,
  SectionNav,
  StickyFooter,
} from '../../../components/v2/index.ts';
import { ICON_SIZE_NAV, ICON_STROKE } from '../../../lib/iconSizes.ts';

const TABS = ['Summary', 'Library', 'Tools', 'Export for radio'] as const;
const LIB_STRIP = ['Channels', 'Zones', 'Talk groups', 'Contacts', 'Receive group lists'] as const;

const BOTTOM = [
  {
    id: 'library',
    label: 'Library',
    icon: <IconBooks size={ICON_SIZE_NAV} stroke={ICON_STROKE} />,
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
  const [activeTab, setActiveTab] = useState<string>('Library');
  const [strip, setStrip] = useState<string>('Channels');
  const [section, setSection] = useState<string>('Identity');
  const [bottom, setBottom] = useState<string>('library');

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
        title="AppShell + ContextualStrip"
        description="Design-system top header (not a sidebar shell). Narrow viewports hide top tabs — use BottomTabBar."
      >
        <Stack gap="md">
          <div
            style={{ border: '1px solid var(--dsv2-border)', borderRadius: 10, overflow: 'hidden' }}
          >
            <AppShell
              tabs={[...TABS]}
              activeTab={activeTab}
              onTabChange={setActiveTab}
              projectName="Skywarn Repeaters"
              rightExtra={
                <Text size="sm" c="dimmed">
                  Help
                </Text>
              }
            />
            {activeTab === 'Library' ? (
              <ContextualStrip items={[...LIB_STRIP]} active={strip} onChange={setStrip} />
            ) : null}
            <div style={{ padding: 20 }}>
              <Text size="sm">
                Active: <strong>{activeTab}</strong>
                {activeTab === 'Library' ? (
                  <>
                    {' '}
                    / <strong>{strip}</strong>
                  </>
                ) : null}
              </Text>
            </div>
          </div>
        </Stack>
      </PageSection>

      <PageSection
        title="EditorHeader + StickyFooter"
        description="Batch 3 editor chrome — title crumb block and sticky save bar (E1–E8)."
      >
        <div
          style={{
            position: 'relative',
            border: '1px solid var(--dsv2-border)',
            borderRadius: 10,
            overflow: 'hidden',
            minHeight: 280,
          }}
        >
          <EditorHeader
            crumb="Channels"
            crumbTo="/styleguide/v2/navigation"
            title="New channel"
            subtitle="Set up the identity, frequency and mode for this channel."
          />
          <div style={{ padding: '16px 32px', color: 'var(--dsv2-text-tertiary)', fontSize: 13 }}>
            Scrollable editor panels…
          </div>
          <StickyFooter
            saveLabel="Save channel"
            dirty
            onCancel={() => {}}
            onSave={() => {}}
          />
        </div>
      </PageSection>

      <PageSection title="SectionNav" description="Legacy in-page section rail (superseded by E1 scroll layout).">
        <div
          style={{
            display: 'flex',
            border: '1px solid var(--dsv2-border)',
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          <SectionNav
            items={['Identity', 'Frequencies', 'Modes', 'Location']}
            active={section}
            onChange={setSection}
          />
          <div style={{ padding: 20, flex: 1 }}>
            <Text size="sm">
              Section: <strong>{section}</strong>
            </Text>
          </div>
        </div>
      </PageSection>

      <PageSection title="BottomTabBar" description="Mobile primary nav.">
        <div
          style={{
            maxWidth: 420,
            border: '1px solid var(--dsv2-border)',
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          <BottomTabBar items={[...BOTTOM]} activeId={bottom} onChange={setBottom} />
        </div>
      </PageSection>
    </Page>
  );
}
