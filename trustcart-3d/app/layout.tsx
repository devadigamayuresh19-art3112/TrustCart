import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TrustCart | Shop Smarter. Trust Better.",
  description:
    "Compare prices across stores and find the deal you can trust.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
