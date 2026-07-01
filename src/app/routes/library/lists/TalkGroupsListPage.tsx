import { Text } from '@mantine/core';
import LibraryEntityList from '../../../components/library/LibraryEntityList.tsx';
import { ListPage } from '../../../components/ui/index.ts';
import { useLibraryDelete } from '../../../hooks/useLibraryDelete.ts';
import { useLibrary } from '../../../state/useLibrary.ts';

export default function TalkGroupsListPage() {
  const { library, loading } = useLibrary();
  const handleDelete = useLibraryDelete();

  if (loading) {
    return (
      <ListPage title="Talk groups">
        <Text>Loading library…</Text>
      </ListPage>
    );
  }

  return (
    <ListPage title="Talk groups">
      <LibraryEntityList
        library={library}
        kind="talkGroup"
        slug="talk-groups"
        plural="Talk groups"
        label="Talk group"
        onDelete={handleDelete}
      />
    </ListPage>
  );
}
