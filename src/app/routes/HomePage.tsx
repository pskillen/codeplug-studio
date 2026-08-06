import { IconRadio } from '@tabler/icons-react';
import { useRef, useState } from 'react';
import {
  DesignSystemV2Provider,
  Button,
  EmptyState,
  ModalShell,
  TextInput,
  ConfirmModal,
} from '../components/v2/index.ts';
import ImportProjectYamlPanel from '../components/import-export/ImportProjectYamlPanel.tsx';
import ProjectManageCard from '../components/shell/ProjectManageCard.tsx';
import { GettingStartedContent, GettingStartedModal } from '../components/onboarding/index.ts';
import { useProjectStatsMap } from '../hooks/useProjectStatsMap.ts';
import { useProjects } from '../state/useProjects.ts';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../lib/iconSizes.ts';
import classes from './HomePage.module.css';

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
  const statsMap = useProjectStatsMap(projects);
  const importRef = useRef<HTMLDivElement>(null);

  const [quickStartOpen, setQuickStartOpen] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [renameTarget, setRenameTarget] = useState<{ id: string; name: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleCreateProject() {
    const name = newProjectName.trim();
    if (!name) return;
    setBusy(true);
    try {
      await createProject(name);
      setNewProjectName('');
      setNewProjectOpen(false);
    } finally {
      setBusy(false);
    }
  }

  async function handleRename() {
    if (!renameTarget) return;
    const name = renameValue.trim();
    if (!name) return;
    setBusy(true);
    try {
      await renameProject(renameTarget.id, name);
      setRenameTarget(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await deleteProject(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setBusy(false);
    }
  }

  function scrollToImport() {
    importRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const empty = !loading && projects.length === 0;

  return (
    <DesignSystemV2Provider>
      <div className={classes.page}>
        {empty ? (
          <div className={classes.emptyStack}>
            <div style={{ maxWidth: 440, width: '100%' }}>
              <EmptyState
                icon={<IconRadio size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />}
                title="No projects yet"
                description="Create a project to start building a codeplug, or import one from a YAML file you already have."
                action={
                  <div
                    style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}
                  >
                    <Button variant="secondary" size="sm" onClick={scrollToImport}>
                      Import project
                    </Button>
                    <Button size="sm" onClick={() => setNewProjectOpen(true)}>
                      New project
                    </Button>
                  </div>
                }
              />
            </div>
            <div className={classes.quickStartPanel}>
              <div className={classes.quickStartTitle}>Quick start guide</div>
              <GettingStartedContent compact />
            </div>
          </div>
        ) : (
          <>
            <div className={classes.header}>
              <div>
                <div className={classes.title}>Your projects</div>
                <div className={classes.subtitle}>
                  {projects.length} project{projects.length === 1 ? '' : 's'}
                </div>
              </div>
              <div className={classes.actions}>
                <Button variant="ghost" size="sm" onClick={() => setQuickStartOpen(true)}>
                  Quick start
                </Button>
                <Button variant="outline" size="sm" onClick={scrollToImport}>
                  Import project
                </Button>
                <Button size="sm" onClick={() => setNewProjectOpen(true)}>
                  New project
                </Button>
              </div>
            </div>
            {loading ? (
              <p className={classes.loading}>Loading projects…</p>
            ) : (
              <div className={classes.grid}>
                {projects.map((project) => (
                  <ProjectManageCard
                    key={project.projectId}
                    project={project}
                    isActive={project.projectId === activeProjectId}
                    statsLabel={statsMap[project.projectId] ?? null}
                    onOpen={() => switchProject(project.projectId)}
                    onRename={() => {
                      setRenameTarget({ id: project.projectId, name: project.name });
                      setRenameValue(project.name);
                    }}
                    onDelete={() => setDeleteTarget({ id: project.projectId, name: project.name })}
                  />
                ))}
              </div>
            )}
          </>
        )}

        <div ref={importRef} className={classes.importSection}>
          <div className={classes.importTitle}>Import from YAML</div>
          <ImportProjectYamlPanel />
        </div>
      </div>

      <GettingStartedModal opened={quickStartOpen} onClose={() => setQuickStartOpen(false)} />

      <ModalShell
        open={newProjectOpen}
        onClose={() => {
          if (!busy) setNewProjectOpen(false);
        }}
        title="New project"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setNewProjectOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void handleCreateProject()}
              disabled={busy || !newProjectName.trim()}
            >
              {busy ? 'Creating…' : 'Create project'}
            </Button>
          </>
        }
      >
        <TextInput
          label="Project name"
          placeholder="e.g. Home shack"
          value={newProjectName}
          onChange={(event) => setNewProjectName(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void handleCreateProject();
          }}
        />
      </ModalShell>

      <ModalShell
        open={renameTarget != null}
        onClose={() => {
          if (!busy) setRenameTarget(null);
        }}
        title="Rename project"
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setRenameTarget(null)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => void handleRename()}
              disabled={busy || !renameValue.trim()}
            >
              {busy ? 'Saving…' : 'Save'}
            </Button>
          </>
        }
      >
        <TextInput
          label="Project name"
          value={renameValue}
          onChange={(event) => setRenameValue(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void handleRename();
          }}
        />
      </ModalShell>

      <ConfirmModal
        open={deleteTarget != null}
        onClose={() => {
          if (!busy) setDeleteTarget(null);
        }}
        onConfirm={() => void handleDelete()}
        title="Delete this project?"
        confirmLabel="Delete project"
        cancelLabel="Cancel"
        tone="destructive"
        busy={busy}
      >
        This removes <strong>{deleteTarget?.name}</strong> and its library from this browser. YAML
        backups on Google Drive are not deleted.
      </ConfirmModal>
    </DesignSystemV2Provider>
  );
}
