import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Rooms",
  description: "Room modeling and virtual furnishing",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
