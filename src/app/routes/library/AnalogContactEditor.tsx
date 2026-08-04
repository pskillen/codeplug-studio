import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { AnalogContact } from '@core/models/library.ts';
import { newAnalogContact } from '@core/domain/factories.ts';
import EntityDeleteButton from '../../components/library/EntityDeleteButton.tsx';
import { UnsavedChangesModal } from '../../components/ui/index.ts';
import {
  Button,
  DesignSystemV2Provider,
  FormField,
  Panel,
  TextInput,
} from '../../components/v2/index.ts';
import { useEntityEditorUnsavedGuard } from '../../hooks/useEntityFormDirty.ts';
import { persistence } from '../../state/persistence.ts';
import { useEntitySave } from './useEntitySave.ts';
import classes from './zones/ZoneEditLayout.module.css';

export function AnalogContactEditor({
  projectId,
  entity,
}: {
  projectId: string;
  entity: AnalogContact | null;
}) {
  const base = entity ?? newAnalogContact(projectId, '');
  const [name, setName] = useState(base.name);
  const [code, setCode] = useState(base.code);
  const [comment, setComment] = useState(base.comment);
  const { save, saving, error } = useEntitySave('analog-contacts');
  const navigate = useNavigate();

  function buildRow(): AnalogContact {
    return {
      ...base,
      name: name.trim() || 'Untitled contact',
      code,
      comment,
    };
  }

  const { permitNavigationOnce, modalOpen, stay, leave } = useEntityEditorUnsavedGuard(buildRow);

  function handleSave() {
    const row = buildRow();
    void save(() => persistence.putAnalogContact(row, entity ? entity.revision : null), {
      permitNavigation: permitNavigationOnce,
    });
  }

  return (
    <DesignSystemV2Provider>
      <div className={classes.root}>
        <header className={classes.stickyHeader}>
          <Link to="/library/contacts" className={classes.backLink}>
            ← Contacts
          </Link>
          <div className={classes.headerDivider} aria-hidden />
          <div className={classes.headerIdentity}>
            <div className={classes.headerName}>{name.trim() || 'Untitled contact'}</div>
            <div className={classes.headerSubtitle}>
              {entity ? 'Edit analog contact' : 'New analog contact'}
            </div>
          </div>
          <div className={classes.headerActions}>
            <Button variant="secondary" onClick={() => navigate('/library/contacts')}>
              Discard
            </Button>
            <Button variant="primary" onClick={handleSave} loading={saving}>
              Save contact
            </Button>
          </div>
        </header>

        {error ? <p className={classes.error}>{error}</p> : null}

        <div className={classes.content}>
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
              <FormField label="Code">
                <TextInput
                  variant="plain"
                  value={code}
                  onChange={(e) => setCode(e.currentTarget.value)}
                  aria-label="Code"
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
            </div>
          </Panel>

          {entity ? (
            <EntityDeleteButton
              kind="analogContact"
              entityId={entity.id}
              label={entity.name}
              onDeleted={() => navigate('/library/contacts')}
            />
          ) : null}
        </div>

        <UnsavedChangesModal opened={modalOpen} onStay={stay} onLeave={leave} />
      </div>
    </DesignSystemV2Provider>
  );
}
