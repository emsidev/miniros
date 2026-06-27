import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MINIROS",
  description: "Mini Retail Operations System for pop-up sellers."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
