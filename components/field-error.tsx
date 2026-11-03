import { Icon } from "@/components/icons";

// Ties a control to its hint, and to its message when there is one.
export function describedBy(id: string, message: string | undefined): string {
  return message === undefined ? `${id}-hint` : `${id}-hint ${id}-error`;
}

// The message under a field that is wrong. The picture is only decoration. The
// word "Error:" is there for screen readers, so the message is not taken for a hint.
export function FieldError({
  id,
  message,
}: {
  id: string;
  message: string | undefined;
}) {
  if (message === undefined) return null;
  return (
    <p id={`${id}-error`} className="mt-2 text-sm font-medium text-danger">
      <Icon name="alert" className="mr-1.5 inline h-4 w-4 align-middle" />
      <span className="sr-only">Error: </span>
      {message}
    </p>
  );
}
