import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";

import { PwaRegistration } from "@/components/pwa-registration";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "https://fincamamasgarden.com"),
  title: {
    default: "Finca Mama's Garden",
    template: "%s | Finca Mama's Garden",
  },
  description:
    "Conoce Finca Mama's Garden y su forma responsable de cultivar, producir y crecer.",
  applicationName: "Finca Mama's Garden",
  creator: "Finca Mama's Garden",
  publisher: "Finca Mama's Garden",
  formatDetection: {
    address: false,
    email: false,
    telephone: false,
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Mama's Garden",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#064e3b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <PwaRegistration />
        {children}
      </body>
    </html>
  );
}
