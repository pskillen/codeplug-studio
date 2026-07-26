import EditorActions from '../EditorActions.tsx';
import { UnsavedChangesModal } from '../../../components/ui/index.ts';
import { useZoneEdit } from './ZoneEditContext.tsx';

export default function ZoneEditActions() {
  const { saving, error, validationError, handleSave, modalOpen, stay, leave } = useZoneEdit();

  return (
    <>
      <EditorActions
        saving={saving}
        error={validationError ?? error}
        onSave={handleSave}
        cancelPath="/library/zones"
      />
      <UnsavedChangesModal opened={modalOpen} onStay={stay} onLeave={leave} />
    </>
  );
}
