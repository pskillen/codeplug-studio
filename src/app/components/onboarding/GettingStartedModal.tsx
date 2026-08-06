import { IconRocket } from '@tabler/icons-react';
import { DesignSystemV2Provider, Button, ModalShell } from '../v2/index.ts';
import { ICON_SIZE_ACTION, ICON_STROKE } from '../../lib/iconSizes.ts';
import GettingStartedContent from './GettingStartedContent.tsx';

export interface GettingStartedModalProps {
  opened: boolean;
  onClose: () => void;
}

export default function GettingStartedModal({ opened, onClose }: GettingStartedModalProps) {
  return (
    <DesignSystemV2Provider>
      <ModalShell
        open={opened}
        onClose={onClose}
        title="Quick start"
        icon={<IconRocket size={ICON_SIZE_ACTION} stroke={ICON_STROKE} />}
        size="lg"
        footer={
          <Button size="sm" onClick={onClose}>
            Got it
          </Button>
        }
      >
        <GettingStartedContent />
      </ModalShell>
    </DesignSystemV2Provider>
  );
}
