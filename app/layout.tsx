import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ServerProvider } from "@/lib/server-context";
import { MeetingProvider } from "@/lib/meeting-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The War Room",
  description: "Shared cockpit dashboard for AI-augmented teams",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased dark`}
    >
      <body className="h-full bg-neutral-950 text-neutral-100 overflow-hidden">
        <ServerProvider>
          <MeetingProvider>{children}</MeetingProvider>
        </ServerProvider>
      </body>
    </html>
  );
}
