import { Text } from '@mantine/core';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { radioTargetFor } from '@core/radio-targets/index.ts';
import { capabilityLabel } from '../../lib/buildCapabilityCopy.ts';
import { BuildService } from '../../state/buildService.ts';
import { persistence } from '../../state/persistence.ts';
import { Button, Pill, TextInput } from '../../components/v2/index.ts';
import { useBuildLayout } from './BuildLayoutContext.tsx';
import classes from './BuildOverviewPage.module.css';

const buildService = new BuildService(persistence);

export default function BuildOverviewPage() {
  const { build, egressPaths } = useBuildLayout();
  const navigate = useNavigate();
  const [name, setName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = name ?? build.name;
  const radioTarget = radioTargetFor(build.radioTargetId);
  const nameDirty = name != null && name !== build.name;

  async function handleSave() {
    setSaving(true);
    setError(null);
    const row = buildService.withUpdatedName(build, displayName);
    const result = await buildService.putBuild(row, build.revision);
    setSaving(false);
    if (!result.ok) {
      setError(
        result.reason === 'revision_conflict'
          ? 'This build was changed elsewhere. Reload and reapply your edit.'
          : 'Save failed.',
      );
      return;
    }
    setName(null);
  }

  async function handleDelete() {
    if (!window.confirm(`Delete build "${build.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    await buildService.deleteBuild(build.projectId, build.id);
    setDeleting(false);
    navigate('/builds');
  }

  return (
    <div className={classes.page}>
      <div className={classes.header}>
        <h1 className={classes.title}>Overview</h1>
        <p className={classes.subtitle}>
          Build identity and organisation capabilities for{' '}
          <strong>{radioTarget?.label ?? build.radioTargetId}</strong>.
        </p>
      </div>

      <section className={classes.panel}>
        <h2 className={classes.panelTitle}>Identity</h2>
        <TextInput
          label="Name"
          value={displayName}
          onChange={(e) => setName(e.currentTarget.value)}
        />
        {error ? (
          <Text c="red" size="sm">
            {error}
          </Text>
        ) : null}
        <div className={classes.rowActions}>
          <Button loading={saving} disabled={!nameDirty} onClick={() => void handleSave()}>
            Save name
          </Button>
        </div>
      </section>

      <section className={classes.panel}>
        <h2 className={classes.panelTitle}>Capabilities</h2>
        <p className={classes.panelHint}>
          Short labels for this radio target. See{' '}
          <Link to={`/builds/${build.id}/characteristics`}>Radio characteristics</Link> for limits
          and RF detail.
        </p>
        <div className={classes.pills}>
          {(radioTarget?.traits ?? []).map((trait) => (
            <Pill key={trait} tone="neutral">
              {capabilityLabel(trait)}
            </Pill>
          ))}
        </div>
        {egressPaths.length > 0 ? (
          <ul className={classes.egressList}>
            {egressPaths.map((path) => (
              <li key={path.id}>
                {path.label ?? path.profileId}
                {build.defaultEgressPathId === path.id ? ' (default)' : ''}
              </li>
            ))}
          </ul>
        ) : null}
        <p className={classes.panelHint}>
          Export pathways are chosen on <Link to={`/builds/${build.id}/export`}>Export</Link>.
        </p>
      </section>

      <section className={classes.dangerPanel}>
        <h2 className={classes.panelTitle}>Danger zone</h2>
        <p className={classes.panelHint}>
          Deleting a build removes its export history and overrides. Channels and zones in your
          library are not affected.
        </p>
        <Button
          variant="destructive"
          size="sm"
          loading={deleting}
          onClick={() => void handleDelete()}
        >
          Delete build
        </Button>
      </section>
    </div>
  );
}
