import type { ReactNode } from "react";
import { Icon } from "@/components/icons";

type StatusMessageProps = {
  code?: string;
  title: string;
  message: string;
  children?: ReactNode;
};

// A page that says one thing: a post that is not there, a page that is not
// there, an error. The picture is only decoration, the words say it.
export function StatusMessage({
  code,
  title,
  message,
  children,
}: StatusMessageProps) {
  return (
    <main
      id="main-content"
      className="flex flex-1 flex-col items-center justify-center px-5 py-16 text-center sm:px-8"
    >
      <span
        aria-hidden="true"
        className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent shadow-card"
      >
        <Icon name="info" className="h-7 w-7" />
      </span>
      {code ? (
        <p className="mt-5 rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium tracking-widest text-muted">
          {code}
        </p>
      ) : null}
      <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 max-w-md text-base leading-7 text-muted">{message}</p>
      {children ? (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {children}
        </div>
      ) : null}
    </main>
  );
}
