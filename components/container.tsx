import type { ReactNode } from "react";

type ContainerProps = {
  children: ReactNode;
  className?: string;
};

// Keeps page content centered with the same side space everywhere.
export function Container({ children, className = "" }: ContainerProps) {
  return (
    <div className={`mx-auto w-full max-w-5xl px-5 sm:px-8 ${className}`.trim()}>
      {children}
    </div>
  );
}
