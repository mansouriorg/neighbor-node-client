import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/container";
import { Icon, type IconName } from "@/components/icons";
import { NewPostForm } from "@/components/new-post-form";
import { hideAfterDays } from "@/lib/post-age";

export const metadata: Metadata = {
  title: "Write a post",
  description:
    "Ask for help, offer a hand, or lend something to your neighbors.",
};

// Three short things to know before writing. They are all true today.
const tips: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "pin",
    title: "A street, never a number",
    text: "Write a street or an area. The area field does not accept numbers, so an exact address cannot get in by mistake.",
  },
  {
    icon: "lock",
    title: "A private link",
    text: "After saving you get a private link. It is the way to edit the post or mark it as done, and it is shown only once.",
  },
  {
    icon: "clock",
    title: `${hideAfterDays} days on the board`,
    text: "After that the post is hidden, never deleted. With your private link you can show it again.",
  },
];

export default function NewPostPage() {
  return (
    <main id="main-content" className="flex-1">
      <Container className="py-10 sm:py-14">
        <Link
          href="/board"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent hover:underline"
        >
          <Icon name="arrowLeft" className="h-4 w-4" />
          Back to the board
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
          Write a post
        </h1>
        <p className="mt-3 max-w-xl text-base leading-7 text-muted">
          Ask for help, offer a hand, or lend something. Share only a street or
          an area, never your exact address.
        </p>
        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-10">
          <div className="min-w-0">
            <p className="flex max-w-2xl items-start gap-3 rounded-2xl border border-line bg-surface px-5 py-4 text-sm leading-6 text-muted">
              <Icon name="info" className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>
                <span className="font-medium text-foreground">
                  Early version.
                </span>{" "}
                Your post is saved and shows on the board at once. There are no
                accounts yet, so anyone can post.
              </span>
            </p>
            <NewPostForm />
          </div>
          <aside
            aria-labelledby="before-you-post"
            className="rounded-2xl border border-line bg-surface p-6 shadow-card lg:sticky lg:top-24"
          >
            <h2
              id="before-you-post"
              className="text-base font-semibold tracking-tight"
            >
              Before you post
            </h2>
            <ul className="mt-5 grid gap-5">
              {tips.map((tip) => (
                <li key={tip.title} className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent"
                  >
                    <Icon name={tip.icon} className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{tip.title}</p>
                    <p className="mt-1 text-sm leading-6 text-muted">
                      {tip.text}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </aside>
        </div>
      </Container>
    </main>
  );
}
