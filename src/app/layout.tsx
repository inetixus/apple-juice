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
  openGraph: {
    title: "Apple Juice - Open-Source AI Code Tool for Roblox Studio",
    description: "Accelerate your game development with Apple Juice, the free open-source AI coding assistant built specifically for Roblox Studio.",
    url: "https://apple-juice.online/",
    siteName: "Apple Juice",
    images: [
      {
        url: "/apple_juice_logo.png",
        width: 512,
        height: 512,
        alt: "Apple Juice - Open-Source AI Code Tool for Roblox Studio",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Apple Juice - Open-Source AI Code Tool for Roblox Studio",
    description: "Accelerate your game development with Apple Juice, the free open-source AI coding assistant built specifically for Roblox Studio.",
    images: ["/apple_juice_logo.png"],
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
