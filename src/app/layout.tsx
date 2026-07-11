import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Program Operations Dashboard | EO IIT Bombay",
  description:
    "Program Operations Dashboard for Educational Outreach, IIT Bombay",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
