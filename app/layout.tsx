import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import { AntdRegistry } from '@ant-design/nextjs-registry';
import ThemeConfig from "../components/ThemeConfig";
import "./globals.css";

const roboto = Roboto({
  variable: "--font-roboto",
  subsets: ["latin", "latin-ext", "vietnamese"],
  weight: ["300", "400", "500", "700", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "In Hoà Phát - Hệ thống quản lý in ấn",
  description: "Hệ thống quản lý sản xuất và vận hành in ấn In Hoà Phát",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${roboto.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <AntdRegistry>
          <ThemeConfig>
            {children}
          </ThemeConfig>
        </AntdRegistry>
      </body>
    </html>
  );
}
