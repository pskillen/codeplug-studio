import RepeaterDirectorySearch from '../../components/repeaters/RepeaterDirectorySearch.tsx';

export default function AddFromBrandmeisterPage() {
  return (
    <RepeaterDirectorySearch
      source="brandmeister"
      title="Add channel from BrandMeister"
      description="Search BrandMeister DMR hotspots and repeaters and add matches to your library."
    />
  );
}
