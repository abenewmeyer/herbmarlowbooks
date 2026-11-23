import "./globals.css";
import type { Metadata } from "next";
export const metadata: Metadata = { title: "Herb Marlow Books - Cover & Blurb Studio", description: "Private tool for new covers and back-cover blurbs." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>);
}
