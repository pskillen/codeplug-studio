import { Stack, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { Page, PageHeader } from '../../../components/ui/index.ts';

const SECTIONS = [
  {
    to: '/styleguide/v2/forms',
    title: 'Forms',
    description: 'Button variants and OverrideField.',
  },
  {
    to: '/styleguide/v2/data-display',
    title: 'Data display',
    description: 'Pill (incl. semantic), re-skinned DataTable, MapPanel placeholder.',
  },
  {
    to: '/styleguide/v2/navigation',
    title: 'Navigation',
    description: 'AppShell and BottomTabBar (fixture-driven).',
  },
  {
    to: '/styleguide/v2/patterns',
    title: 'Patterns',
    description: 'ShuttleList family over the existing list-kit.',
  },
] as const;

export default function StyleguideV2IndexPage() {
  return (
    <Page width="default">
      <PageHeader
        title="Design system v2 (preview)"
        description="Isolated preview of #916 foundations. Does not affect live app chrome. Narrow the viewport to check mobile behaviour."
      />
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          <Link to="/styleguide">← Back to v1 styleguide</Link>
        </Text>
        {SECTIONS.map((section) => (
          <Text key={section.to} size="sm">
            <Link to={section.to}>{section.title}</Link> — {section.description}
          </Text>
        ))}
      </Stack>
    </Page>
  );
}
