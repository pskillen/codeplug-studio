import StorageClaimScreen from '../builds/danger-zone/storageClaim/StorageClaimScreen.tsx';
import {
  DEMO_STORAGE_CLAIM_ACTIONS,
  DEMO_STORAGE_CLAIM_VIEW,
} from '../builds/danger-zone/storageClaim/storageClaimDemo.ts';

export default function StorageClaimDemo() {
  return <StorageClaimScreen view={DEMO_STORAGE_CLAIM_VIEW} actions={DEMO_STORAGE_CLAIM_ACTIONS} />;
}
