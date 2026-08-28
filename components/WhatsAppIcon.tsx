import { MessageCircle, Phone } from "lucide-react";

/** Ícono de WhatsApp compuesto con el mismo trazo redondeado del sitio. */
export function WhatsAppIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <span aria-hidden className={`relative inline-flex shrink-0 ${className}`}>
      <MessageCircle className="absolute inset-0 h-full w-full" strokeWidth={2.15} />
      <Phone
        className="absolute left-[24%] top-[22%] h-[52%] w-[52%] -rotate-12"
        strokeWidth={2.4}
      />
    </span>
  );
}
