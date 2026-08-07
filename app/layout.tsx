import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PTA3 Tool",
  description: "Character sheets, combat tracking, and reference data for Pokémon Tabletop Adventures 3",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-page text-foreground">{children}</body>
    </html>
  );
}
