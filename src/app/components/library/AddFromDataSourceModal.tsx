import { SimpleGrid } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import { DesignSystemV2Provider, ModalShell } from '../v2/index.ts';
import { CHANNEL_ADD_SOURCES, type ChannelDataSource } from '../../lib/channelDataSources.ts';
import type { ContactDataSource } from '../../lib/contactDataSources.ts';
import classes from './AddFromDataSourceModal.module.css';

export type AddFromDataSource = ChannelDataSource | ContactDataSource;

export interface AddFromDataSourceModalProps {
  opened: boolean;
  onClose: () => void;
  /** Directory sources to list; defaults to channel import sources. */
  sources?: readonly AddFromDataSource[];
}

export default function AddFromDataSourceModal({
  opened,
  onClose,
  sources = CHANNEL_ADD_SOURCES,
}: AddFromDataSourceModalProps) {
  const navigate = useNavigate();

  function openSource(path: string) {
    onClose();
    navigate(path);
  }

  return (
    <DesignSystemV2Provider>
      <ModalShell open={opened} onClose={onClose} title="Add from…" size="lg">
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
          {sources.map((source) => (
            <button
              key={source.id}
              type="button"
              className={classes.sourceCard}
              onClick={() => openSource(source.path)}
            >
              <span className={classes.sourceIcon} aria-hidden>
                <source.Icon size={28} stroke={1.5} />
              </span>
              <span className={classes.sourceTitle}>{source.title}</span>
              {source.subtitle ? (
                <span className={classes.sourceSubtitle}>{source.subtitle}</span>
              ) : null}
              {source.description ? (
                <span className={classes.sourceDescription}>{source.description}</span>
              ) : null}
              {source.badges.length > 0 ? (
                <span className={classes.sourceBadges}>
                  {source.badges.map((badge) => (
                    <span key={badge.label} className={classes.badge}>
                      {badge.emoji ? `${badge.emoji} ` : ''}
                      {badge.label}
                    </span>
                  ))}
                </span>
              ) : null}
            </button>
          ))}
        </SimpleGrid>
      </ModalShell>
    </DesignSystemV2Provider>
  );
}
