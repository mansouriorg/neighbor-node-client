import Link from "next/link";
import { Container } from "@/components/container";

const linkClassName =
  "inline-flex min-h-11 items-center underline-offset-4 hover:text-accent hover:underline";

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <Container className="grid gap-8 py-10 text-sm text-muted sm:grid-cols-[1.6fr_1fr_1.2fr]">
        <div>
          <p className="flex items-center gap-2.5 text-base font-semibold tracking-tight text-foreground">
            <span
              aria-hidden="true"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-on-accent"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M12 2.5 2.5 10.2V21.5h7v-6h5v6h7V10.2L12 2.5z" />
              </svg>
            </span>
            Neighbor Node
          </p>
          <p className="mt-3 max-w-xs leading-6">
            Neighbor Node is an early version, made so neighbors can help each other.
          </p>
        </div>
        <nav aria-label="Footer">
          <p className="font-medium text-foreground">Explore</p>
          <ul className="mt-1 flex flex-wrap gap-x-5 sm:flex-col sm:gap-x-0">
            <li>
              <Link href="/" className={linkClassName}>
                Home
              </Link>
            </li>
            <li>
              <Link href="/board" className={linkClassName}>
                The board
              </Link>
            </li>
            <li>
              <Link href="/board/new" className={linkClassName}>
                Write a post
              </Link>
            </li>
          </ul>
        </nav>
        <div>
          <p className="font-medium text-foreground">Your privacy</p>
          <p className="mt-3 leading-6">
            Posts show only a street or an area. Nobody needs an account: each
            post comes with a private link that only its author has.
          </p>
        </div>
      </Container>
    </footer>
  );
}
