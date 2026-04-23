import "./globals.css";
import { Providers } from "@/components/Providers";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Apple Juice",
  description: "The Open-Source AI Code Tool for Roblox.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-[#09090b] text-zinc-100 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
