import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
});

export const metadata: Metadata = {
  title: "HEIRA — AI CRM för modebranschen",
  description: "AI-drivet CRM för fashion- och beauty-varumärken",
};

const isRodebjerMode = process.env.NEXT_PUBLIC_BRAND_MODE === "rodebjer";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="sv"
      className={`${inter.variable} ${fraunces.variable} h-full antialiased`}
    >
      <body className={`min-h-full${isRodebjerMode ? " rodebjer-mode" : ""}`}>{children}</body>
    </html>
  );
}
