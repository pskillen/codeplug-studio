import { useMemo, useState } from 'react';
import { useMediaQuery } from '@mantine/hooks';
import { useNavigate } from 'react-router-dom';
import type { OwnDigitalId, OwnDigitalIdProtocol } from '@core/models/library.ts';
import { newOwnDigitalId } from '@core/domain/factories.ts';
import {
  OWN_ID_RANGE,
  ownDigitalIdLabel,
  ownDigitalIdProtocolLabel,
  validateOwnDigitalId,
} from '@core/domain/ownDigitalIds.ts';
import EntityDeleteButton from '../../components/library/EntityDeleteButton.tsx';
import {
  DesignSystemV2Provider,
  EditorHeader,
  FormField,
  Panel,
  SegmentedControl,
  StickyFooter,
  TextInput,
  UnsavedChangesModal,
} from '../../components/v2/index.ts';
import { useEntityEditorUnsavedGuard } from '../../hooks/useEntityFormDirty.ts';
import { MOBILE_MAX_WIDTH_MEDIA_QUERY } from '../../lib/breakpoints.ts';
import { referenceCount } from '../../lib/listReferences.ts';
import { parseOptionalInt } from '../../lib/units.ts';
import { LibraryService } from '../../state/libraryService.ts';
import { persistence } from '../../state/persistence.ts';
import { useLibrary } from '../../state/useLibrary.ts';
import { useEntitySave } from './useEntitySave.ts';
import classes from './CompactFormEditor.module.css';

const PROTOCOL_OPTIONS = [
  { value: 'dmr', label: 'DMR' },
  { value: 'nxdn', label: 'NXDN' },
] as const;

const service = new LibraryService(persistence);

function numberHint(protocol: OwnDigitalIdProtocol): string {
  const [min, max] = OWN_ID_RANGE[protocol];
  return `${ownDigitalIdProtocolLabel(protocol)} ID, ${min}–${max}`;
}

export function OwnDigitalIdEditor({
  projectId,
  entity,
}: {
  projectId: string;
  entity: OwnDigitalId | null;
}) {
  const base = entity ?? newOwnDigitalId(projectId);
  const [name, setName] = useState(base.name);
  const [protocol, setProtocol] = useState<OwnDigitalIdProtocol>(base.protocol);
  const [number, setNumber] = useState(base.number > 0 ? String(base.number) : '');
  const [saveAttempted, setSaveAttempted] = useState(false);
  const { save, saving, error } = useEntitySave('digital-ids');
  const { library } = useLibrary();
  const navigate = useNavigate();
  const isMobile = useMediaQuery(MOBILE_MAX_WIDTH_MEDIA_QUERY);

  const usageCount = useMemo(
    () => (entity ? referenceCount(library, { kind: 'ownDigitalId', id: entity.id }) : 0),
    [entity, library],
  );
  // The protocol is fixed once channels choose the ID: a DMR channel cannot name an NXDN ID.
  const protocolLocked = usageCount > 0;

  function buildRow(): OwnDigitalId {
    return {
      ...base,
      name: name.trim(),
      protocol,
      number: parseOptionalInt(number) ?? 0,
    };
  }

  const { permitNavigationOnce, modalOpen, stay, leave, isDirty } =
    useEntityEditorUnsavedGuard(buildRow);

  const errors = validateOwnDigitalId(buildRow(), library.ownDigitalIds);
  const errorShown = number.trim() === '' && !saveAttempted ? null : (errors[0] ?? null);
  const nameMissing = !entity && name.trim() === '' && saveAttempted;

  function handleSave() {
    if (errors.length > 0 || (!entity && name.trim() === '')) {
      setSaveAttempted(true);
      return;
    }
    const row = buildRow();
    void save(() => service.saveOwnDigitalId(row, entity ? entity.revision : null), {
      permitNavigation: permitNavigationOnce,
    });
  }

  const headerTitle = entity || name.trim() ? ownDigitalIdLabel(buildRow()) : 'New Digital ID';
  const headerSubtitle = !entity
    ? 'Digital ID'
    : `Digital ID${entity.isDefault ? ` · default ${ownDigitalIdProtocolLabel(entity.protocol)}` : ''}${
        usageCount > 0 ? ` · used by ${usageCount} channel${usageCount === 1 ? '' : 's'}` : ''
      }`;

  return (
    <DesignSystemV2Provider>
      <div className={classes.root}>
        <EditorHeader
          crumb="Digital IDs"
          crumbTo="/library/digital-ids"
          title={headerTitle}
          subtitle={headerSubtitle}
          compact={isMobile}
        />

        <div className={[classes.scrollBody, isMobile ? classes.scrollBodyCompact : ''].join(' ')}>
          {error ? <p className={classes.error}>{error}</p> : null}

          <Panel>
            <div
              className={[classes.fieldGrid, isMobile ? classes.fieldGridCompact : ''].join(' ')}
            >
              <FormField
                label="Name"
                error={nameMissing ? 'Give this ID a name' : undefined}
                hint="Shown in the channel's ID list, and on the radio where it has a name field."
              >
                <TextInput
                  variant="plain"
                  value={name}
                  onChange={(e) => setName(e.currentTarget.value)}
                  aria-label="Name"
                />
              </FormField>
              <div>
                <p className={classes.segmentLabel}>Protocol</p>
                <SegmentedControl
                  options={PROTOCOL_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))}
                  value={protocol}
                  onChange={(next) => {
                    if (!protocolLocked) setProtocol(next as OwnDigitalIdProtocol);
                  }}
                />
                {protocolLocked ? (
                  <p className={classes.hint}>Channels use this ID, so its protocol is fixed.</p>
                ) : null}
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              <FormField
                label={`${ownDigitalIdProtocolLabel(protocol)} ID`}
                mono
                error={errorShown ?? undefined}
                hint={numberHint(protocol)}
              >
                <TextInput
                  variant="plain"
                  value={number}
                  onChange={(e) => setNumber(e.currentTarget.value)}
                  mono
                  aria-label={`${ownDigitalIdProtocolLabel(protocol)} ID`}
                />
              </FormField>
            </div>
            <p className={classes.hint} style={{ marginTop: 8 }}>
              {entity?.isDefault
                ? `This is your default ${ownDigitalIdProtocolLabel(protocol)} ID. Channels set to Default send it.`
                : `The first ${ownDigitalIdProtocolLabel(protocol)} ID you add becomes the default. Use Set as default on the list to change it.`}
            </p>
          </Panel>

          {entity ? (
            <EntityDeleteButton
              kind="ownDigitalId"
              entityId={entity.id}
              label={ownDigitalIdLabel(entity)}
              onDeleted={() => navigate('/library/digital-ids')}
            />
          ) : null}
        </div>

        <StickyFooter
          saveLabel="Save Digital ID"
          dirty={isDirty}
          onCancel={() => navigate('/library/digital-ids')}
          onSave={handleSave}
          saving={saving}
          compact={isMobile}
        />

        <UnsavedChangesModal opened={modalOpen} onStay={stay} onLeave={leave} />
      </div>
    </DesignSystemV2Provider>
  );
}
