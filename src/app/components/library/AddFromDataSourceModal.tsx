import { Modal, SimpleGrid, ThemeIcon } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import BadgeCard from '../ui/BadgeCard.tsx';
import { CHANNEL_ADD_SOURCES, type ChannelDataSource } from '../../lib/channelDataSources.ts';
import type { ContactDataSource } from '../../lib/contactDataSources.ts';

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
    <Modal opened={opened} onClose={onClose} title="Add from…" size="lg" centered>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        {sources.map((source) => (
          <BadgeCard
            key={source.id}
            title={source.title}
            subtitle={source.subtitle}
            description={source.description}
            badges={source.badges}
            badgesTitle="Good for"
            media={
              <ThemeIcon size={56} radius="md" variant="light" color="brand">
                <source.Icon size={32} stroke={1.5} />
              </ThemeIcon>
            }
            onClick={() => openSource(source.path)}
          />
        ))}
      </SimpleGrid>
    </Modal>
  );
}
