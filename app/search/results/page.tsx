import { Suspense } from "react";
import { SearchResultsClient } from "@/components/search/search-results-client";

export const metadata = {
  title: "Search Results",
  robots: { index: false, follow: true },
};

export default function SearchResultsPage() {
  return (
    <Suspense>
      <SearchResultsClient />
    </Suspense>
  );
}


