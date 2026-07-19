import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "STRAVA Passport",
  description: "A private-by-default athletic travel passport.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
