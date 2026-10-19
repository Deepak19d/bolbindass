import type { Metadata } from "next";
import { Suspense } from "react";
import { PracticeView } from "@/components/practice/practice-view";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = { title: "Practice" };

function PracticeFallback() {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.4fr_1fr]">
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}

export default function PracticePage() {
  // PracticeView reads ?topic= with useSearchParams, which needs a Suspense boundary.
  return (
    <Suspense fallback={<PracticeFallback />}>
      <PracticeView />
    </Suspense>
  );
}
