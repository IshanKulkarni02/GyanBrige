import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
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
        <Toaster
          position="top-right"
          theme="dark"
          richColors
          closeButton
          toastOptions={{ style: { background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(255,255,255,0.1)' } }}
        />
      </body>
    </html>
  );
}
