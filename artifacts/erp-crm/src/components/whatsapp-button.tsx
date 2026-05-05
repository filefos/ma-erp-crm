import { Button } from "@/components/ui/button";
import { MessageCircle } from "lucide-react";

function waLink(phone?: string | null): string {
  const digits = String(phone ?? "").replace(/[^0-9]/g, "");
  return digits ? `https://wa.me/${digits}` : "#";
}

interface CommonProps {
  phone?: string | null;
  // Accepted for backwards-compatibility but ignored — the inbox / template
  // system was removed. The button now just opens WhatsApp Web for the number.
  context?: string;
  defaultTemplateId?: string;
  vars?: Record<string, unknown>;
  leadId?: number;
  contactId?: number;
  className?: string;
  testId?: string;
}

export function WhatsAppQuickIcon(props: CommonProps) {
  const href = waLink(props.phone);
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={`inline-flex items-center justify-center rounded-md hover:bg-green-50 text-green-600 ${props.className ?? "h-8 w-8"}`}
      data-testid={props.testId}
      aria-label="Open WhatsApp"
    >
      <MessageCircle className="w-4 h-4" />
    </a>
  );
}

interface ButtonProps extends CommonProps {
  variant?: "outline" | "default" | "secondary" | "ghost";
  size?: "sm" | "default" | "lg" | "icon";
  iconOnly?: boolean;
  label?: string;
  iconClassName?: string;
}

export function WhatsAppButton(props: ButtonProps) {
  const href = waLink(props.phone);
  return (
    <Button
      asChild
      variant={props.variant ?? "outline"}
      size={props.size ?? "sm"}
      data-testid={props.testId}
    >
      <a href={href} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
        <MessageCircle className={props.iconClassName ?? "w-4 h-4 mr-1.5 text-green-600"} />
        {!props.iconOnly && (props.label ?? "WhatsApp")}
      </a>
    </Button>
  );
}
