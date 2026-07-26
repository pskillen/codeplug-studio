import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Library, Zone, ZoneMemberEntry } from '@core/models/library.ts';
import { validateZoneMembership } from '@core/domain/validation.ts';
import type { ZoneMemberEditorMapFilters } from '../../../components/library/ZoneMemberEditor.tsx';
import { useEntityEditorUnsavedGuard } from '../../../hooks/useEntityFormDirty.ts';
import { persistence } from '../../../state/persistence.ts';
import { useEntitySave } from '../useEntitySave.ts';

export interface ZoneEditContextValue {
  entity: Zone;
  library: Library;
  projectId: string;
  name: string;
  setName: (value: string) => void;
  comment: string;
  setComment: (value: string) => void;
  omitFromExport: boolean;
  setOmitFromExport: (value: boolean) => void;
  members: ZoneMemberEntry[];
  setMembers: (members: ZoneMemberEntry[]) => void;
  previewZone: Zone;
  mapFilters: ZoneMemberEditorMapFilters;
  setMapFilters: (filters: ZoneMemberEditorMapFilters) => void;
  saving: boolean;
  error: string | null;
  validationError: string | null;
  handleSave: () => void;
  modalOpen: boolean;
  stay: () => void;
  leave: () => void;
}

const ZoneEditContext = createContext<ZoneEditContextValue | null>(null);

export function useZoneEdit(): ZoneEditContextValue {
  const ctx = useContext(ZoneEditContext);
  if (!ctx) {
    throw new Error('useZoneEdit must be used within ZoneEditProvider');
  }
  return ctx;
}

export function ZoneEditProvider({
  entity,
  library,
  projectId,
  children,
}: {
  entity: Zone;
  library: Library;
  projectId: string;
  children: ReactNode;
}) {
  const [name, setName] = useState(entity.name);
  const [members, setMembers] = useState<ZoneMemberEntry[]>(entity.members);
  const [comment, setComment] = useState(entity.comment);
  const [omitFromExport, setOmitFromExport] = useState(entity.omitFromExport === true);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [mapFilters, setMapFilters] = useState<ZoneMemberEditorMapFilters>({
    hiddenMarkerChannelIds: [],
    hiddenZoneMemberIds: [],
  });
  const { save, saving, error } = useEntitySave('zones', { navigateOnSave: false });

  const previewZone = useMemo((): Zone => {
    return {
      ...entity,
      name: name.trim() || 'Untitled zone',
      members,
      comment,
      omitFromExport: omitFromExport ? true : undefined,
    };
  }, [entity, name, members, comment, omitFromExport]);

  const buildRow = useCallback((): Zone => previewZone, [previewZone]);

  const { permitNavigationOnce, modalOpen, stay, leave } = useEntityEditorUnsavedGuard(buildRow);

  const handleSave = useCallback(() => {
    const row = buildRow();
    try {
      const libraryForValidation = {
        ...library,
        zones: library.zones.map((zone) => (zone.id === row.id ? row : zone)),
      };
      validateZoneMembership(row.id, members, libraryForValidation);
      setValidationError(null);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Invalid zone membership');
      return;
    }
    void save(() => persistence.putZone(row, entity.revision), {
      permitNavigation: permitNavigationOnce,
    });
  }, [buildRow, library, members, save, entity.revision, permitNavigationOnce]);

  const value = useMemo(
    (): ZoneEditContextValue => ({
      entity,
      library,
      projectId,
      name,
      setName,
      comment,
      setComment,
      omitFromExport,
      setOmitFromExport,
      members,
      setMembers,
      previewZone,
      mapFilters,
      setMapFilters,
      saving,
      error,
      validationError,
      handleSave,
      modalOpen,
      stay,
      leave,
    }),
    [
      entity,
      library,
      projectId,
      name,
      comment,
      omitFromExport,
      members,
      previewZone,
      mapFilters,
      saving,
      error,
      validationError,
      handleSave,
      modalOpen,
      stay,
      leave,
    ],
  );

  return <ZoneEditContext.Provider value={value}>{children}</ZoneEditContext.Provider>;
}
