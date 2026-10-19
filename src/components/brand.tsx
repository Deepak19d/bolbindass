import Link from "next/link";

export function BrandMark({ className = "size-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="var(--primary)" />
      <path
        d="M9 10.5c0-1.4 1.1-2.5 2.5-2.5h9c1.4 0 2.5 1.1 2.5 2.5v6c0 1.4-1.1 2.5-2.5 2.5h-4.6L12 22.6V19h-.5C10.1 19 9 17.9 9 16.5v-6Z"
        fill="var(--primary-foreground)"
      />
      <circle cx="24.5" cy="23.5" r="3.5" fill="var(--highlight)" />
    </svg>
  );
}

export function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4">
      <BrandMark />
      <span className="font-heading text-xl font-semibold tracking-tight">
        Bol<span className="text-primary">Bindass</span>
      </span>
    </Link>
  );
}
