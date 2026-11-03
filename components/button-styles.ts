// Class names for buttons and links that look like buttons.
const base =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full px-6 text-sm font-medium transition-colors";

export const actionClassName = `${base} bg-accent text-on-accent shadow-card hover:bg-accent-hover`;

export const secondaryActionClassName = `${base} border border-solid border-muted bg-surface text-foreground hover:bg-accent-soft`;

// For an action that cannot be undone from the site, for example taking a post down.
export const dangerActionClassName = `${base} bg-danger text-on-accent hover:opacity-90`;
