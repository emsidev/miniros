import Link from "next/link";

export function LegalLinks({
  className,
}: Readonly<{
  className?: string;
}>) {
  return (
    <nav
      aria-label="Legal information"
      className={className ?? "flex items-center gap-4"}
    >
      <Link
        href="/terms"
        className="underline-offset-4 hover:text-foreground hover:underline"
      >
        Terms of Service
      </Link>
      <Link
        href="/privacy"
        className="underline-offset-4 hover:text-foreground hover:underline"
      >
        Privacy Policy
      </Link>
    </nav>
  );
}
