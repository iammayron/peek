import type { Metadata, Viewport } from "next";
import { Azeret_Mono, Schibsted_Grotesk } from "next/font/google";
import { GITHUB_URL, SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "@/lib/site";
import "./globals.css";

const grotesk = Schibsted_Grotesk({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const azeret = Azeret_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  applicationName: "Peek",
  authors: [{ name: "Mayron Alves", url: GITHUB_URL }],
  creator: "Mayron Alves",
  alternates: {
    canonical: SITE_URL,
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "Peek",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "en_US",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: SITE_TITLE,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    apple: "/apple-icon.png",
  },
  category: "developer tools",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0c",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${grotesk.variable} ${azeret.variable}`}>
      <body>{children}</body>
    </html>
  );
}
