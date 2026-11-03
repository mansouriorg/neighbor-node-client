"use client";

import { useEffect } from "react";
import { actionClassName } from "@/components/button-styles";
import { Icon } from "@/components/icons";
import { StatusMessage } from "@/components/status-message";
import "./globals.css";

export default function GlobalError({
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
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <StatusMessage
          title="Something went wrong"
          message="The app could not load. You can try again."
        >
          <button
            type="button"
            onClick={() => unstable_retry()}
            className={actionClassName}
          >
            <Icon name="refresh" className="h-4 w-4" />
            Try again
          </button>
        </StatusMessage>
      </body>
    </html>
  );
}
