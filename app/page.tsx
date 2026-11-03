import Link from "next/link";
import { BoardPreview } from "@/components/board-preview";
import {
  actionClassName,
  secondaryActionClassName,
} from "@/components/button-styles";
import { Container } from "@/components/container";
import { Icon } from "@/components/icons";
import { KindBadge } from "@/components/kind-badge";
import { kindBarClassName } from "@/components/kind-colors";
import { postKindIds, postKindInfo, type PostKind } from "@/lib/post-kinds";

const steps = [
  {
    title: "Post it",
    text: "Say what you need, what you can do, or what you can lend. Add your street or area.",
  },
  {
    title: "A neighbor answers",
    text: "Someone nearby sends you a reply. Only you can read it. You agree on the details together.",
  },
  {
    title: "Mark it done",
    text: "Use your private link to change the status from Open to In progress to Done, so everyone can see where it stands.",
  },
];

// Short facts under the buttons. They are all true today.
const facts = [
  "No account needed",
  "Only a street or an area is shown",
  "Every post has a private link",
];

// The words of the link at the bottom of each kind, which opens the board
// with that kind chosen.
const browseLabel: Record<PostKind, string> = {
  help: "See who needs a hand",
  offer: "See what neighbors offer",
  lend: "See what you can borrow",
};

export default function Home() {
  return (
    <main id="main-content" className="flex-1">
      <section className="border-b border-line">
        <Container className="py-14 sm:py-20 lg:py-24">
          <p className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-sm font-medium text-accent">
            <Icon name="pin" className="h-3.5 w-3.5" />
            A help and lending board for neighbors
          </p>
          <h1 className="mt-5 max-w-4xl text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Ask for a hand. Offer one.{" "}
            <span className="text-accent">Lend what you do not use.</span>
          </h1>
          <div className="mt-8 grid items-center gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:gap-16">
            <div>
              <p className="max-w-xl text-lg leading-8 text-muted">
                Neighbor Node is a small board where people who live near each
                other post what they need, what they can do, and what they can
                lend.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/board" className={actionClassName}>
                  Open the board
                  <Icon name="arrowRight" className="h-4 w-4" />
                </Link>
                <Link href="/board/new" className={secondaryActionClassName}>
                  <Icon name="plus" className="h-4 w-4" />
                  Write a post
                </Link>
              </div>
              <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
                {facts.map((fact) => (
                  <li key={fact} className="inline-flex items-center gap-2">
                    <Icon name="check" className="h-4 w-4 shrink-0 text-accent" />
                    {fact}
                  </li>
                ))}
              </ul>
              <p className="mt-8 flex max-w-xl items-start gap-3 rounded-2xl border border-line bg-surface px-5 py-4 text-sm leading-6 text-muted">
                <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <span>
                  <span className="font-medium text-foreground">Early version.</span>{" "}
                  You can write a post, reply to one and report one. There are
                  no accounts yet, so each post comes with a private link. The
                  board also shows a few made-up posts, marked Example.
                </span>
              </p>
            </div>
            <BoardPreview />
          </div>
        </Container>
      </section>

      <section aria-labelledby="kinds-heading" className="py-16 sm:py-20">
        <Container>
          <h2
            id="kinds-heading"
            className="text-3xl font-semibold tracking-tight"
          >
            Three kinds of posts
          </h2>
          <p className="mt-3 max-w-xl text-base leading-7 text-muted">
            Every post on the board is one of these.
          </p>
          <ul className="mt-10 grid gap-5 sm:grid-cols-3">
            {postKindIds.map((id) => (
              <li
                key={id}
                className="relative flex flex-col items-start overflow-hidden rounded-2xl border border-line bg-surface p-6 pt-8 shadow-card"
              >
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-0 top-0 h-1 ${kindBarClassName[id]}`}
                />
                <KindBadge kind={id} />
                <p className="mt-5 text-lg font-semibold leading-snug tracking-tight">
                  {postKindInfo[id].summary}
                </p>
                <p className="mt-2 flex-1 text-sm leading-6 text-muted">
                  {postKindInfo[id].example}
                </p>
                <Link
                  href={`/board?kind=${id}`}
                  className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent hover:underline"
                >
                  {browseLabel[id]}
                  <Icon name="arrowRight" className="h-4 w-4" />
                </Link>
              </li>
            ))}
          </ul>
        </Container>
      </section>

      <section
        aria-labelledby="how-heading"
        className="border-y border-line bg-surface py-16 sm:py-20"
      >
        <Container>
          <h2
            id="how-heading"
            className="text-3xl font-semibold tracking-tight"
          >
            How it works
          </h2>
          <ol className="mt-10 grid gap-10 sm:grid-cols-3 sm:gap-8">
            {steps.map((step, index) => (
              <li key={step.title} className="relative">
                <span
                  aria-hidden="true"
                  className="relative z-10 flex h-10 w-10 items-center justify-center rounded-full bg-accent text-sm font-semibold text-on-accent shadow-card"
                >
                  {index + 1}
                </span>
                {index < steps.length - 1 ? (
                  <span
                    aria-hidden="true"
                    className="absolute -right-6 left-12 top-5 hidden border-t border-dashed border-muted sm:block"
                  />
                ) : null}
                <h3 className="mt-5 text-lg font-semibold tracking-tight">
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-muted">{step.text}</p>
              </li>
            ))}
          </ol>
        </Container>
      </section>

      <section aria-labelledby="privacy-heading" className="py-16 sm:py-20">
        <Container>
          <div className="flex max-w-3xl flex-col gap-5 rounded-3xl bg-accent-soft p-8 sm:flex-row sm:items-start sm:gap-6 sm:p-10">
            <span
              aria-hidden="true"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-on-accent"
            >
              <Icon name="lock" className="h-6 w-6" />
            </span>
            <div>
              <h2
                id="privacy-heading"
                className="text-2xl font-semibold tracking-tight"
              >
                Your address stays private
              </h2>
              <p className="mt-3 text-base leading-7 text-muted">
                Posts show only a street or area, never an exact address, and
                the area field does not accept numbers. A reply goes only to the
                author of the post, and a phone number or an email address in a
                reply is always optional.
              </p>
            </div>
          </div>
        </Container>
      </section>
    </main>
  );
}
