import { useState, type FormEvent } from 'react';
import { Badge, Button, Group, Stack, Text, TextInput } from '@mantine/core';
import { useProjects } from '../state/useProjects.ts';
import { EmptyState, ListPage, PageSection } from '../components/ui/index.ts';

export default function HomePage() {
  const {
    projects,
    activeProjectId,
    loading,
    createProject,
    switchProject,
    renameProject,
    deleteProject,
  } = useProjects();
  const [newName, setNewName] = useState('');

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    await createProject(newName);
    setNewName('');
  }

  return (
    <ListPage
      width="narrow"
      title="Projects"
      description="Create a project to start a vendor-neutral channel library, then assemble format-specific builds per radio."
    >
      <PageSection title="New project">
        <form onSubmit={handleCreate}>
          <Group align="flex-end" wrap="wrap">
            <TextInput
              label="Project name"
              placeholder="e.g. Home shack"
              value={newName}
              onChange={(e) => setNewName(e.currentTarget.value)}
              style={{ flex: 1, minWidth: 220 }}
            />
            <Button type="submit">Create project</Button>
          </Group>
        </form>
      </PageSection>

      {loading ? (
        <Text>Loading projects…</Text>
      ) : projects.length === 0 ? (
        <EmptyState message="No projects yet — create your first project above." />
      ) : (
        <PageSection title="Your projects">
          <Stack gap="sm">
            {projects.map((project) => {
              const isActive = project.projectId === activeProjectId;
              return (
                <Group
                  key={project.projectId}
                  justify="space-between"
                  wrap="wrap"
                  p="sm"
                  style={{
                    border: `1px solid var(--mantine-color-dark-4)`,
                    borderRadius: 'var(--mantine-radius-md)',
                    background: isActive ? 'var(--mantine-color-dark-6)' : undefined,
                  }}
                >
                  <Stack gap={2}>
                    <Group gap="xs">
                      <Text fw={600}>{project.name}</Text>
                      {isActive ? (
                        <Badge size="sm" variant="light">
                          Active
                        </Badge>
                      ) : null}
                    </Group>
                    <Text size="xs" c="dimmed">
                      Updated {new Date(project.updatedAt).toLocaleString()}
                    </Text>
                  </Stack>
                  <Group gap="xs">
                    <Button
                      size="compact-sm"
                      variant={isActive ? 'light' : 'default'}
                      disabled={isActive}
                      onClick={() => switchProject(project.projectId)}
                    >
                      {isActive ? 'Selected' : 'Open'}
                    </Button>
                    <Button
                      size="compact-sm"
                      variant="default"
                      onClick={() => {
                        const next = window.prompt('Rename project', project.name);
                        if (next !== null) void renameProject(project.projectId, next);
                      }}
                    >
                      Rename
                    </Button>
                    <Button
                      size="compact-sm"
                      color="red"
                      variant="light"
                      onClick={() => {
                        if (window.confirm(`Delete project “${project.name}”?`)) {
                          void deleteProject(project.projectId);
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </Group>
                </Group>
              );
            })}
          </Stack>
        </PageSection>
      )}
    </ListPage>
  );
}
