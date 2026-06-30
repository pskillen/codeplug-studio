import type { PersistableRow } from './revision.ts';
import type { TraitLayout } from './traitLayout.ts';

export interface LibrarySelection {
  channelIds: string[];
  talkGroupIds: string[];
  contactIds: string[];
  rxGroupListIds: string[];
}

export interface FormatBuild extends PersistableRow {
  formatId: string;
  profileId: string;
  name: string;
  librarySelection: LibrarySelection;
  layout: TraitLayout;
}
