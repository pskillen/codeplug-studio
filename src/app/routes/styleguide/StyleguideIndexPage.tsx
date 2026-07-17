import { Stack, Text } from '@mantine/core';
import { Link } from 'react-router-dom';
import { Page, PageHeader } from '../../components/ui/index.ts';

const SECTIONS = [
  {
    to: '/styleguide/layout',
    title: 'Layout',
    description: 'Page, PageHeader, PageSection, ListPage, FormPage shells.',
  },
  {
    to: '/styleguide/data-table',
    title: 'DataTable (roles A + D)',
    description: 'Entity list and extreme-scale inventory demos.',
  },
  {
    to: '/styleguide/membership',
    title: 'Membership (roles B + C)',
    description: 'AvailableItemPicker, SelectedItemList, and paired pick-members demo.',
  },
  {
    to: '/styleguide/controls',
    title: 'Controls',
    description: 'Gradient segments, pills, buttons, EmptyState, Modal, SoftWarning.',
  },
] as const;

export default function StyleguideIndexPage() {
  return (
    <Page width="default">
      <PageHeader
        title="UI styleguide"
        description="Hidden dev hub — demos shared kit primitives. Not linked from navigation. See list-kit-roles.md for A/B/C/D."
      />
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Role legend: <strong>A</strong> entity list · <strong>B</strong> member picker ·{' '}
          <strong>C</strong> membership list · <strong>D</strong> extreme inventory (same face as
          A).
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
