import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hesabım · Kişisel Finans",
  description: "Harcamaların, ekstrelerin ve altın birikimlerin tek bir yerde.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
