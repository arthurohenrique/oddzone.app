import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Oddzone",
  description: "Base inicial web + extensao"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="theme-apple-clean">{children}</body>
    </html>
  );
}
