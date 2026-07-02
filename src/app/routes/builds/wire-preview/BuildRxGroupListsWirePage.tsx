import BuildEntityWirePage from './BuildEntityWirePage.tsx';

export default function BuildRxGroupListsWirePage() {
  return (
    <BuildEntityWirePage
      title="RX group lists"
      entityKind="rxGroupList"
      description="RX group lists referenced by exported channels."
    />
  );
}
