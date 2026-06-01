import "./globals.css";
import { Providers } from "@/components/Providers";
import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space",
});

export const metadata: Metadata = {
  title: "Apple Juice - Open-Source AI Code Tool for Roblox Studio",
  description: "Accelerate your game development with Apple Juice, the free open-source AI coding assistant built specifically for Roblox Studio.",
  alternates: {
    canonical: "https://apple-juice.online/",
  },
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} font-sans dark`}
    >
      <body className="bg-black text-white antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
