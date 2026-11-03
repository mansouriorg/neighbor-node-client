// The look of the forms, in one place. Every form of the app takes its classes
// from here, so a change here changes all of them.

export const labelClassName = "block text-sm font-semibold";

export const hintClassName = "mt-1 text-sm leading-6 text-muted";

// A text field or a text area. The border stays dark enough to see against the
// card. A field that is wrong turns red. The focus ring comes from globals.css.
export const controlClassName =
  "mt-2 block w-full rounded-xl border border-solid border-muted bg-background px-4 text-base text-foreground shadow-sm transition-colors hover:border-foreground focus-visible:border-accent aria-invalid:border-danger aria-invalid:bg-danger-soft/50";

// The card around a form.
export const formCardClassName =
  "rounded-2xl border border-solid border-line bg-surface p-5 shadow-card sm:p-6";

// The box that lists what went wrong.
export const problemBoxClassName =
  "rounded-2xl border border-solid border-danger bg-danger-soft p-5";

// A card with a radio button in it: "what kind of post is it", "why do you
// report it". The chosen card gets the accent color.
export const choiceCardClassName =
  "cursor-pointer rounded-2xl border border-solid border-line bg-background transition-colors hover:border-muted has-[:checked]:border-accent has-[:checked]:bg-accent-soft";

// The round tile that holds an icon, at the start of a heading or a message.
export const iconTileClassName =
  "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent";
