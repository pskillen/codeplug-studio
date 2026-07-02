import BuildEntityWirePage from './BuildEntityWirePage.tsx';

export default function BuildTalkGroupsWirePage() {
  return (
    <BuildEntityWirePage
      title="Talk groups"
      entityKind="talkGroup"
      description="Talk groups referenced by exported channels are included automatically."
    />
  );
}
