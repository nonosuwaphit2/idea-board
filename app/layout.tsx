import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Idea Board",
  description: "A place to share ideas and support the ones you love.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
