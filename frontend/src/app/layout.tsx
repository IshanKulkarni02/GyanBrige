import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "GyanBrige - AI-Powered Education Platform",
  description: "Transform education with AI-generated notes, multi-language support, and seamless lecture management for students and teachers.",
  keywords: ["education", "AI", "learning", "lectures", "notes", "Hindi", "Marathi", "English"],
  authors: [{ name: "GyanBrige Team" }],
  openGraph: {
    title: "GyanBrige - AI-Powered Education Platform",
    description: "Transform education with AI-generated notes and multi-language support.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
