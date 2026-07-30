import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { THEME_INIT_SCRIPT } from "./lib/theme";

export const metadata: Metadata = {
  title: "ChoirPresenter",
  description: "Presentation app for songs, Bible and sermons",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const myriadPro = localFont({
  src: [
    {
      path: "../public/fonts/MyriadPro/MyriadProRegular/MyriadProRegular.woff",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/MyriadPro/MyriadProItalic/MyriadProItalic.woff",
      weight: "400",
      style: "italic",
    },
    {
      path: "../public/fonts/MyriadPro/MyriadProSemiBold/MyriadProSemiBold.woff",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--font-myriad-pro",
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${myriadPro.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
