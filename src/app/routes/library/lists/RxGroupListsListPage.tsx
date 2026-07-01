import { Text } from '@mantine/core';
import LibraryEntityList from '../../../components/library/LibraryEntityList.tsx';
import { ListPage } from '../../../components/ui/index.ts';
import { useLibraryDelete } from '../../../hooks/useLibraryDelete.ts';
import { useLibrary } from '../../../state/useLibrary.ts';

export default function RxGroupListsListPage() {
  const { library, loading } = useLibrary();
  const handleDelete = useLibraryDelete();

  if (loading) {
    return (
      <ListPage title="RX group lists">
        <Text>Loading library…</Text>
      </ListPage>
    );
  }

  return (
    <ListPage title="RX group lists">
      <LibraryEntityList
        library={library}
        kind="rxGroupList"
        slug="rx-group-lists"
        plural="RX group lists"
        label="RX group list"
        onDelete={handleDelete}
      />
    </ListPage>
  );
}
