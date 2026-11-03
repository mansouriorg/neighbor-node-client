import Link from "next/link";
import { actionClassName } from "@/components/button-styles";
import { Icon } from "@/components/icons";
import { StatusMessage } from "@/components/status-message";

export default function NotFound() {
  return (
    <StatusMessage
      code="404"
      title="Page not found"
      message="This page does not exist or has moved."
    >
      <Link href="/" className={actionClassName}>
        <Icon name="arrowLeft" className="h-4 w-4" />
        Back to home
      </Link>
    </StatusMessage>
  );
}
