import { Button, Text, TextInput } from '@mantine/core';
import { Link } from 'react-router-dom';
import {
  DataTable,
  FormPage,
  ListPage,
  Page,
  PageHeader,
  PageSection,
  PageSectionGrid,
} from '../../components/ui/index.ts';
import { SAMPLE_ROWS } from './fixtures.ts';

export default function StyleguideLayoutPage() {
  return (
    <Page width="default">
      <PageHeader
        title="Styleguide — layout"
        description={
          <>
            <Link to="/styleguide">← Styleguide</Link> · Page / ListPage / FormPage shells
          </>
        }
      />

      <PageSection title="Page layout" description="PageHeader, PageSection, PageSectionGrid">
        <PageSectionGrid>
          <PageSection title="Card A" description="Bordered section panel">
            <Text size="sm">Section body content.</Text>
          </PageSection>
          <PageSection title="Card B" description="Second column from md breakpoint">
            <Text size="sm">Mirrors import/export layout.</Text>
          </PageSection>
        </PageSectionGrid>
      </PageSection>

      <PageSection title="ListPage sample">
        <ListPage
          title="Channels (sample)"
          description="Composed list shell inside a section for demo."
        >
          <DataTable
            variant="list"
            rows={SAMPLE_ROWS}
            totalRowCount={SAMPLE_ROWS.length}
            rowKey={(row) => row.id}
            nameColumn={{
              getName: (row) => row.name,
              getPath: (row) => `/library/channels/${row.id}`,
            }}
            columns={[{ key: 'band', header: 'Band', render: () => '2m' }]}
          />
        </ListPage>
      </PageSection>

      <PageSection title="FormPage sample">
        <FormPage
          title="Edit channel (sample)"
          description="Sticky footer on mobile viewports."
          footer={
            <>
              <Button variant="light">Cancel</Button>
              <Button>Save</Button>
            </>
          }
        >
          <TextInput label="Name" defaultValue="Demo channel" />
        </FormPage>
      </PageSection>
    </Page>
  );
}
