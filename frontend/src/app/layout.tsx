import type { Metadata } from "next";
import { Fraunces, Geist, Geist_Mono, JetBrains_Mono } from "next/font/google";
import Providers from "./providers";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
// Hero redesign: a characterful serif for the name (signals "a person", not a
// product) and a technical mono for labels/stats — see Hero.tsx.
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal"],
});
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-tech",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "RV.AI — Ravinder's AI Platform Engineer",
  description:
    "Chat with my AI to learn about my experience, projects, and skills in building production agentic AI systems.",
  openGraph: {
    title: "RV.AI",
    description: "Your personal AI guide to Ravinder's engineering career.",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${jetbrainsMono.variable} h-full`}
    >
      <body className="h-full antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
