import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Heritage Graph - Connecting Cultural Knowledge",
  description:
    "Explore the interconnected world of cultural heritage through knowledge graphs. Discover traditions, architecture, and stories that bridge ancient wisdom with modern understanding.",
  keywords:
    "heritage, knowledge graph, cultural identity, Nepal, Himalayas, tradition, architecture, knowledge network",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
