import { Text } from '@mantine/core';
import LibraryEntityList from '../../../components/library/LibraryEntityList.tsx';
import { ListPage, PageSection } from '../../../components/ui/index.ts';
import { useLibraryDelete } from '../../../hooks/useLibraryDelete.ts';
import { useLibrary } from '../../../state/useLibrary.ts';

export default function ContactsListPage() {
  const { library, loading } = useLibrary();
  const handleDelete = useLibraryDelete();

  if (loading) {
    return (
      <ListPage title="Contacts">
        <Text>Loading library…</Text>
      </ListPage>
    );
  }

  return (
    <ListPage title="Contacts" description="Digital and analog contacts in one inventory.">
      <PageSection title={`Digital contacts (${library.digitalContacts.length})`}>
        <LibraryEntityList
          library={library}
          kind="digitalContact"
          slug="digital-contacts"
          plural="Digital contacts"
          label="Digital contact"
          onDelete={handleDelete}
        />
      </PageSection>

      <PageSection title={`Analog contacts (${library.analogContacts.length})`}>
        <LibraryEntityList
          library={library}
          kind="analogContact"
          slug="analog-contacts"
          plural="Analog contacts"
          label="Analog contact"
          onDelete={handleDelete}
        />
      </PageSection>
    </ListPage>
  );
}
