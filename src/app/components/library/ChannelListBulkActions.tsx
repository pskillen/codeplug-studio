import { Button } from '../v2/index.ts';

export interface ChannelListBulkActionsProps {
  selectedCount: number;
  onBulkEdit: () => void;
  onCreateZoneFromSelected: () => void;
}

export default function ChannelListBulkActions({
  selectedCount,
  onBulkEdit,
  onCreateZoneFromSelected,
}: ChannelListBulkActionsProps) {
  return (
    <>
      <Button variant="secondary" size="sm" disabled={selectedCount === 0} onClick={onBulkEdit}>
        Bulk edit
      </Button>
      <Button
        variant="secondary"
        size="sm"
        disabled={selectedCount === 0}
        onClick={onCreateZoneFromSelected}
      >
        New zone from selection
      </Button>
    </>
  );
}
