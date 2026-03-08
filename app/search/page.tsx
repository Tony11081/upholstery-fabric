import { SearchClient } from "@/components/search/search-client";

export const metadata = {
  title: "Search",
  robots: { index: false, follow: true },
};

export default function SearchPage() {
  return <SearchClient />;
}


