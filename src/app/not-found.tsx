import { Compass } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <EmptyState
      icon={Compass}
      title="Page not found"
      action={
        <Button asChild>
          <Link href="/">Go home</Link>
        </Button>
      }
    >
      That page doesn&apos;t exist.
    </EmptyState>
  );
}
