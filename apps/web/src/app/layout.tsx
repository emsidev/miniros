import type { Metadata, Viewport } from "next";
import { Outfit } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "@miniros/ui/tokens.css";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "MINIROS",
    template: "%s · MINIROS",
  },
  description:
    "Track profit, not just sales. Know if your booth is worth renting again.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#111318",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={outfit.className}>
      <body>
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
