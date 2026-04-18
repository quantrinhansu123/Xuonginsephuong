import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import { AntdRegistry } from '@ant-design/nextjs-registry';
import ThemeConfig from "../components/ThemeConfig";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext", "vietnamese"],
});

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "latin-ext"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "latin-ext"],
});

export const metadata: Metadata = {
  title: "PPMS - Print Production Management System",
  description: "Advanced Print Production Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <AntdRegistry>
          <ThemeConfig>
            {children}
          </ThemeConfig>
        </AntdRegistry>
      </body>
    </html>
  );
}
