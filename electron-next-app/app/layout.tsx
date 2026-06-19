"use client";

import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import "./globals.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// next/font/local hostuje font souborů v JS bundle s relativními cestami →
// funguje v Electron file:// protokolu (na rozdíl od @font-face url('/fonts/...')).
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
  const [queryClient] = useState(() => new QueryClient());

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${myriadPro.variable} antialiased`}
      >
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </body>
    </html>
  );
}
