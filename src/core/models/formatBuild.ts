import type { PersistableRow } from './revision.ts';
import type { TraitLayout } from './traitLayout.ts';

/**
 * A selection of a library entity.
 * This is a base interface for all library entity selections.
 * The idea is that we can provide typed overrides for each library entity type.
 */
export interface AbstractLibraryEntitySelection {
  libraryEntityId: string;
}

export interface ChannelSelection extends AbstractLibraryEntitySelection {
  overrides: {
    name: string;
  };
}

export interface ZoneSelection extends AbstractLibraryEntitySelection {
  overrides: {
    name: string;
  };
}

export interface TalkGroupSelection extends AbstractLibraryEntitySelection {
  overrides: {
    name: string;
  };
}

export interface RxGroupListSelection extends AbstractLibraryEntitySelection {
  overrides: {
    name: string;
  };
}

export interface ContactSelection extends AbstractLibraryEntitySelection {
  overrides: {
    name: string;
  };
}

export interface FormatBuild extends PersistableRow {
  formatId: string;
  profileId: string;
  name: string;
  layout: TraitLayout;
  channelSelections: ChannelSelection[];
  zoneSelections: ZoneSelection[];
  talkGroupSelections: TalkGroupSelection[];
  rxGroupListSelections: RxGroupListSelection[];
  contactSelections: ContactSelection[];
}
