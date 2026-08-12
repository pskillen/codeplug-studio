import { Stack, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { StyleguidePageShell } from './StyleguidePageShell.tsx';

const SECTIONS = [
  {
    to: '/styleguide/forms',
    title: 'Forms',
    description: 'Button variants, OverrideField, PercentLevelSlider, Combobox, FileDropzone.',
  },
  {
    to: '/styleguide/data-display',
    title: 'Data display',
    description: 'CountTile, Panel, Pill, DataTable v2, MapPanel, WirePreviewTable.',
  },
  {
    to: '/styleguide/feedback',
    title: 'Feedback',
    description: 'StatusBanner, StatusDot, DismissibleNotice.',
  },
  {
    to: '/styleguide/overlays',
    title: 'Overlays',
    description: 'ModalShell, ConfirmModal, ProgressModal.',
  },
  {
    to: '/styleguide/membership',
    title: 'Membership',
    description: 'MembershipPanel, AddMembersScreen, pool rows.',
  },
  {
    to: '/styleguide/navigation',
    title: 'Navigation',
    description: 'AppShell, ContextualStrip, EditorHeader, StickyFooter, BottomTabBar.',
  },
  {
    to: '/styleguide/containers',
    title: 'Containers',
    description: 'Panel (default + danger) for section blocks.',
  },
  {
    to: '/styleguide/patterns',
    title: 'Patterns',
    description: 'FacetBar, build list cards, NextPassCard.',
  },
] as const;

export default function StyleguideIndexPage() {
  return (
    <StyleguidePageShell
      title="Design system"
      description="Interactive component kit for Codeplug Studio. Narrow the viewport to check mobile behaviour."
    >
      <Stack gap="md">
        {SECTIONS.map((section) => (
          <Text key={section.to} size="sm">
            <Link to={section.to}>{section.title}</Link> — {section.description}
          </Text>
        ))}
      </Stack>
    </StyleguidePageShell>
  );
}
