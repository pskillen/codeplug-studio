import { Modal, ScrollArea } from '@mantine/core';
import GettingStartedContent from './GettingStartedContent.tsx';

export interface GettingStartedModalProps {
  opened: boolean;
  onClose: () => void;
}

export default function GettingStartedModal({ opened, onClose }: GettingStartedModalProps) {
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Quick start"
      size="lg"
      centered
      scrollAreaComponent={ScrollArea.Autosize}
    >
      <GettingStartedContent />
    </Modal>
  );
}
