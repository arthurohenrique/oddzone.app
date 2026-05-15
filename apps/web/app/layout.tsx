import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Oddzone",
  description: "Base inicial web + extensão",
  icons: {
    icon: "/logo-favicon.svg",
    shortcut: "/logo-favicon.svg",
    apple: "/logo-favicon.svg"
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body suppressHydrationWarning className="theme-apple-clean">
        {children}
      </body>
    </html>
  );
}
