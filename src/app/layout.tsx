import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Toasts } from "@/components/explorer/Toasts";
import { WarpOverlay } from "@/components/WarpOverlay";
import { WelcomeBack } from "@/components/WelcomeBack";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const display = Space_Grotesk({ variable: "--font-display", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Open Source Galaxy", template: "%s · Open Source Galaxy" },
  description: "Explore open-source software as a universe. Find projects worth using, see how they relate, and share discoveries.",
};

export const viewport: Viewport = { themeColor: "#04050c" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${display.variable} h-full`}>
      <body className="min-h-full">
        {children}
        <Toasts />
        <WelcomeBack />
        <WarpOverlay />
      </body>
    </html>
  );
}
