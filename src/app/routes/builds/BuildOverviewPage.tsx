import { Button, Group, List, Stack, Text, TextInput } from '@mantine/core';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { radioTargetFor } from '@core/radio-targets/index.ts';
import { FormPage, FormSection } from '../../components/ui/index.ts';
import { capabilityLabel } from '../../lib/buildCapabilityCopy.ts';
import { BuildService } from '../../state/buildService.ts';
import { persistence } from '../../state/persistence.ts';
import { useBuildLayout } from './BuildLayoutContext.tsx';
import { Badge } from '@mantine/core';

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
    <FormPage
      title={build.name}
      description={
        <Link to="/builds" style={{ fontSize: 'var(--mantine-font-size-sm)' }}>
          ← Back to builds
        </Link>
      }
    >
      <Stack gap="lg">
        <FormSection title="Identity">
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
          <Group mt="sm">
            <Button loading={saving} disabled={!nameDirty} onClick={() => void handleSave()}>
              Save
            </Button>
            <Button
              variant="outline"
              color="red"
              loading={deleting}
              onClick={() => void handleDelete()}
            >
              Delete build
            </Button>
          </Group>
        </FormSection>

        <FormSection title="Target">
          <Stack gap="sm">
            <Text size="sm">
              <Text span fw={600}>
                Radio:{' '}
              </Text>
              {radioTarget?.label ?? build.radioTargetId}
            </Text>
            <Text size="sm" c="dimmed">
              Export pathways (CPS file, Web Serial, …) are chosen on the{' '}
              <Link to={`/builds/${build.id}/export`}>Export</Link> page. Profile and wire limits
              follow the active pathway.
            </Text>
            {egressPaths.length > 0 ? (
              <List size="sm" spacing={4}>
                {egressPaths.map((path) => (
                  <List.Item key={path.id}>
                    {path.label ?? path.profileId}
                    {build.defaultEgressPathId === path.id ? ' (default)' : ''}
                  </List.Item>
                ))}
              </List>
            ) : null}
          </Stack>
        </FormSection>

        <FormSection
          title="How this radio is organised"
          description={
            <Text size="sm" component="span">
              Short labels for this radio target. See{' '}
              <Link to={`/builds/${build.id}/characteristics`}>Radio characteristics</Link> for
              limits, power levels, and plain-language explanations.
            </Text>
          }
        >
          <Group gap="xs">
            {(radioTarget?.traits ?? []).map((trait) => (
              <Badge key={trait} variant="light">
                {capabilityLabel(trait)}
              </Badge>
            ))}
          </Group>
        </FormSection>
      </Stack>
    </FormPage>
  );
}
