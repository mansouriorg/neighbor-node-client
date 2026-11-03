import Link from "next/link";
import { Container } from "@/components/container";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/85 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-3">
        <Link
          href="/"
          className="group flex items-center gap-2.5 text-base font-semibold tracking-tight"
        >
          <span
            aria-hidden="true"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-on-accent shadow-card transition-transform group-hover:-rotate-6"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M12 2.5 2.5 10.2V21.5h7v-6h5v6h7V10.2L12 2.5z" />
            </svg>
          </span>
          Neighbor Node
        </Link>
        <div className="flex items-center gap-1 sm:gap-3">
          <nav aria-label="Main">
            <Link
              href="/board"
              className="inline-flex h-11 items-center px-3 text-sm font-medium underline-offset-4 hover:text-accent hover:underline"
            >
              Board
            </Link>
          </nav>
          <p className="hidden rounded-full border border-line px-3 py-1 text-xs font-medium text-muted md:block">
            Early version
          </p>
        </div>
      </Container>
    </header>
  );
}
