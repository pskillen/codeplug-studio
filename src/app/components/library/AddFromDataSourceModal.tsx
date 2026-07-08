import { Modal, SimpleGrid, ThemeIcon } from '@mantine/core';
import { useNavigate } from 'react-router-dom';
import BadgeCard from '../ui/BadgeCard.tsx';
import { CHANNEL_DATA_SOURCES } from '../../lib/channelDataSources.ts';

export interface AddFromDataSourceModalProps {
  opened: boolean;
  onClose: () => void;
}

export default function AddFromDataSourceModal({ opened, onClose }: AddFromDataSourceModalProps) {
  const navigate = useNavigate();

  function openSource(path: string) {
    onClose();
    navigate(path);
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Add from external directory" size="lg" centered>
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        {CHANNEL_DATA_SOURCES.map((source) => (
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
