import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Aylik Harcama Takibi",
  description: "Kisisel kredi karti ekstresi ve harcama takip uygulamasi",
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
