import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { Providers } from "@/components/providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "ICC Rankings | Cricket Team Progress Tracker",
    template: "%s | ICC Rankings",
  },
  description:
    "Track cumulative ICC points for every nation across all formats – Men's, Women's, T20, Test Championship, and age-group tournaments since 1975.",
  keywords: [
    "ICC",
    "cricket",
    "rankings",
    "world cup",
    "T20",
    "test championship",
    "team points",
  ],
  openGraph: {
    type: "website",
    siteName: "ICC Rankings",
    title: "ICC Rankings | Cricket Team Progress Tracker",
    description:
      "Visualise cumulative ICC team points across all formats and tournaments.",
  },
};

export const viewport: Viewport = {
  themeColor: "#3b0764",
  colorScheme: "light",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="flex min-h-screen flex-col bg-slate-50">
        <Providers>
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
