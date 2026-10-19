import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { SessionDetailView } from "@/components/views/session-detail-view";

export const metadata: Metadata = { title: "Session" };

export default function SessionPage() {
  // The id is read on the client (sessions live in this browser's IndexedDB).
  return (
    <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
      <SessionDetailView />
    </Suspense>
  );
}
