import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Quandel BD Hub", template: "%s · Quandel BD Hub" },
  description: "Business development CRM and training for Quandel Enterprises",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Oswald:wght@400..700&family=Public+Sans:wght@400..700&family=IBM+Plex+Mono:wght@400;500&display=swap" />
      </head>
      <body>{children}</body>
    </html>
  );
}
