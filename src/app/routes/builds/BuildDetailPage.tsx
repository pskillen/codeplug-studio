import { Badge, Button, Group, Stack, Text, TextInput } from '@mantine/core';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { traitProfileFor } from '@core/models/traits.ts';
import { formatCatalogEntry } from '@core/import-export/registry.ts';
import { formatProfileWireHint } from '@core/import-export/formatProfiles.ts';
import type { FormatId } from '@core/import-export/types.ts';
import { FormPage, FormSection } from '../../components/ui/index.ts';
import { TRAIT_LABELS } from './buildHelpers.ts';
import { BuildService } from '../../state/buildService.ts';
import { persistence } from '../../state/persistence.ts';
import { useFormatBuild } from '../../state/useFormatBuilds.ts';

const buildService = new BuildService(persistence);

export default function BuildDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { build, loading } = useFormatBuild(id);
  const [name, setName] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayName = name ?? build?.name ?? '';
  const profile = build ? traitProfileFor(build.profileId) : undefined;
  const formatEntry = build ? formatCatalogEntry(build.formatId as FormatId) : undefined;
  const wireHint = build
    ? formatProfileWireHint(build.formatId as FormatId, build.profileId)
    : null;

  async function handleSave() {
    if (!build) return;
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
    if (!build || !id) return;
    if (!window.confirm(`Delete build "${build.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    await buildService.deleteBuild(build.projectId, id);
    setDeleting(false);
    navigate('/builds');
  }

  if (loading) {
    return (
      <FormPage title="Loading…">
        <span />
      </FormPage>
    );
  }

  if (!build) {
    return (
      <FormPage title="Build not found">
        <Text>
          <Link to="/builds">← Back to builds</Link>
        </Text>
      </FormPage>
    );
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
            <Button loading={saving} onClick={() => void handleSave()}>
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
          <Stack gap="xs">
            <Text size="sm">
              <Text span fw={600}>
                Format:{' '}
              </Text>
              {formatEntry?.label ?? build.formatId}
            </Text>
            <Text size="sm">
              <Text span fw={600}>
                Profile:{' '}
              </Text>
              {profile?.label ?? build.profileId}
            </Text>
            {wireHint ? (
              <Text size="sm" c="dimmed">
                {wireHint}
              </Text>
            ) : null}
          </Stack>
        </FormSection>

        <FormSection title="Capability traits">
          <Group gap="xs">
            {(profile?.traits ?? []).map((trait) => (
              <Badge key={trait} variant="light">
                {TRAIT_LABELS[trait] ?? trait}
              </Badge>
            ))}
          </Group>
        </FormSection>

        <FormSection title="Layout">
          <Text c="dimmed" size="sm">
            Trait editors coming soon — zone grouping, channel selection, and wire-name overrides
            will appear here.
          </Text>
          <Text size="sm" c="dimmed">
            Sections: {build.layout.sections.length}
          </Text>
        </FormSection>
      </Stack>
    </FormPage>
  );
}
