import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ventes Pilot IA",
  description: "Fusion et contrôle des fichiers de ventes, indicateurs fiables.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">{children}</body>
    </html>
  );
}
