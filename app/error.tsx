"use client";

import Link from "next/link";
import { useEffect } from "react";
import {
  actionClassName,
  secondaryActionClassName,
} from "@/components/button-styles";
import { Icon } from "@/components/icons";
import { StatusMessage } from "@/components/status-message";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <StatusMessage
      title="Something went wrong"
      message="An unexpected error happened. You can try again or go back to the home page."
    >
      <button
        type="button"
        onClick={() => unstable_retry()}
        className={actionClassName}
      >
        <Icon name="refresh" className="h-4 w-4" />
        Try again
      </button>
      <Link href="/" className={secondaryActionClassName}>
        <Icon name="arrowLeft" className="h-4 w-4" />
        Back to home
      </Link>
      {error.digest ? (
        <p className="w-full text-xs text-muted">
          Error reference: <span className="font-mono">{error.digest}</span>
        </p>
      ) : null}
    </StatusMessage>
  );
}
