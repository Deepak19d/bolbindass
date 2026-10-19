import type { Metadata } from "next";
import { ProgressView } from "@/components/views/progress-view";

export const metadata: Metadata = { title: "Progress" };

export default function ProgressPage() {
  return <ProgressView />;
}
