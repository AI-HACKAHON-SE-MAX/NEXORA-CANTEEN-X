import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CanteenX | Campus food, on your time",
  description: "Order ahead, skip the queue, and pick up when your meal is ready.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
