import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMediaQuery } from '@mantine/hooks';
import type { Library, Zone, ZoneMemberEntry } from '@core/models/library.ts';
import { newZone } from '@core/domain/factories.ts';
import { validateZoneMembership } from '@core/domain/validation.ts';
import { UnsavedChangesModal } from '../../components/v2/index.ts';
import {
  DesignSystemV2Provider,
  EditorHeader,
  FormField,
  Panel,
  StickyFooter,
  TextInput,
  ToggleSwitch,
} from '../../components/v2/index.ts';
import { MOBILE_MAX_WIDTH_MEDIA_QUERY } from '../../lib/breakpoints.ts';
import { useEntityEditorUnsavedGuard } from '../../hooks/useEntityFormDirty.ts';
import { zoneMembersFromSelectedIds } from '../../components/library/zoneMembers.ts';
import { persistence } from '../../state/persistence.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import { useEntitySave } from './useEntitySave.ts';
import { readInitialChannelIds } from './zoneEditorState.ts';
import classes from './zones/ZoneEditLayout.module.css';

/**
 * New-zone form: name, comment, export flag. Members are added on the zone's
 * edit page, which Save opens next — the create form has no member picker.
 * Channels preselected on the channels list (`initialChannelIds`) still seed
 * the zone's members.
 */
export default function ZoneEditor({
  projectId,
  library,
}: {
  projectId: string;
  library: Library;
}) {
  const base = useMemo(() => newZone(projectId, ''), [projectId]);
  const navigate = useNavigate();
  const isMobile = useMediaQuery(MOBILE_MAX_WIDTH_MEDIA_QUERY);
  const location = useLocation();
  const { reload } = useLibrary();
  const [name, setName] = useState(base.name);
  const [members] = useState<ZoneMemberEntry[]>(() =>
    zoneMembersFromSelectedIds(readInitialChannelIds(location.state)),
  );
  const [comment, setComment] = useState(base.comment);
  const [omitFromExport, setOmitFromExport] = useState(base.omitFromExport === true);
  const [validationError, setValidationError] = useState<string | null>(null);
  // Navigation is ours: land on the new zone's edit page, not the zones list.
  const { save, saving, error } = useEntitySave('zones', { navigateOnSave: false });

  function buildRow(): Zone {
    return {
      ...base,
      name: name.trim() || 'Untitled zone',
      members,
      comment,
      omitFromExport: omitFromExport ? true : undefined,
    };
  }

  const { permitNavigationOnce, modalOpen, stay, leave } = useEntityEditorUnsavedGuard(buildRow);

  async function handleSave() {
    const row = buildRow();
    try {
      validateZoneMembership(row.id, members, { ...library, zones: [...library.zones, row] });
      setValidationError(null);
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : 'Invalid zone membership');
      return;
    }
    const saved = await save(() => persistence.putZone(row, null), {
      permitNavigation: permitNavigationOnce,
    });
    if (!saved) return;
    // The edit page looks the zone up in library state; make sure it is there before opening it.
    await reload();
    // An empty zone opens straight into the add-members screen: that is the next step.
    navigate(`/library/zones/${row.id}${members.length === 0 ? '?add=members' : ''}`);
  }

  const displayError = validationError ?? error;

  return (
    <DesignSystemV2Provider>
      <div className={classes.root}>
        <EditorHeader
          compact={isMobile}
          crumb="Zones"
          crumbTo="/library/zones"
          title={name.trim() || 'Untitled zone'}
          subtitle="New zone"
        />

        {displayError ? <p className={classes.error}>{displayError}</p> : null}

        <div
          className={[classes.createScrollBody, isMobile ? classes.createScrollBodyCompact : '']
            .filter(Boolean)
            .join(' ')}
        >
          <Panel title="Identity">
            <div className={classes.fieldStack}>
              <FormField label="Name">
                <TextInput
                  variant="plain"
                  value={name}
                  onChange={(e) => setName(e.currentTarget.value)}
                  aria-label="Name"
                />
              </FormField>
              <FormField label="Comment">
                <TextInput
                  variant="plain"
                  value={comment}
                  onChange={(e) => setComment(e.currentTarget.value)}
                  aria-label="Comment"
                />
              </FormField>
              <ToggleSwitch
                label="Don't export as its own zone"
                checked={omitFromExport}
                onChange={(checked) => setOmitFromExport(checked)}
              />
              <p className={classes.hint}>
                Enable when this zone is only a building block for other zones — for example a
                PMR446 simplex set you nest inside every city zone. Its channels still export inside
                parent zones; this zone will not get its own row in Zones.csv.
              </p>
              <p className={classes.hint}>
                {members.length > 0
                  ? `${members.length} channel${members.length === 1 ? '' : 's'} selected on the channels list will be added to this zone.`
                  : "You'll add members on the next page, after the zone is saved."}
              </p>
            </div>
          </Panel>
        </div>

        <StickyFooter
          compact={isMobile}
          saveLabel="Save zone"
          onCancel={() => navigate('/library/zones')}
          onSave={() => void handleSave()}
          saving={saving}
        />

        <UnsavedChangesModal opened={modalOpen} onStay={stay} onLeave={leave} />
      </div>
    </DesignSystemV2Provider>
  );
}
