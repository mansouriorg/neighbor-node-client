import Link from "next/link";
import { Icon, kindIconName, type IconName } from "@/components/icons";
import { postKindIds, postKindInfo, type PostKind } from "@/lib/post-kinds";

const chipBase =
  "inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors";
const chipActive = "bg-accent text-on-accent shadow-card";
const chipIdle =
  "border border-solid border-line bg-surface text-foreground hover:border-muted hover:bg-accent-soft";

type Choice = {
  id: PostKind | "all";
  label: string;
  href: string;
  icon: IconName;
};

const choices: Choice[] = [
  { id: "all", label: "All posts", href: "/board", icon: "grid" },
  ...postKindIds.map((id) => ({
    id,
    label: postKindInfo[id].label,
    href: `/board?kind=${id}`,
    icon: kindIconName[id],
  })),
];

// Links, not buttons: the filter lives in the address, so it can be shared and works without scripts.
export function KindFilter({ active }: { active: PostKind | undefined }) {
  const activeId = active ?? "all";
  return (
    <nav aria-label="Filter posts by kind">
      <ul className="flex flex-wrap gap-2">
        {choices.map((choice) => {
          const isActive = choice.id === activeId;
          return (
            <li key={choice.id}>
              <Link
                href={choice.href}
                aria-current={isActive ? "page" : undefined}
                className={`${chipBase} ${isActive ? chipActive : chipIdle}`}
              >
                <Icon name={choice.icon} className="h-4 w-4" />
                {choice.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
