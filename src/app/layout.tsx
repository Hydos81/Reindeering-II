import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Playfair_Display } from "next/font/google";
import { EVENT_NAME } from "@/lib/config";
import "./globals.css";

const bodyFont = Be_Vietnam_Pro({
  variable: "--font-body",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700", "800"],
});

const displayFont = Playfair_Display({
  variable: "--font-display",
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: `${EVENT_NAME} · Đặt nước theo vé`,
    template: `%s · ${EVENT_NAME}`,
  },
  description:
    "Nhập mã vé để chọn một món nước cho đêm nhạc thiện nguyện. Mỗi tấm vé — một ly nước, một tấm lòng.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#fbf6ee",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${bodyFont.variable} ${displayFont.variable} antialiased`}>
      <body>{children}</body>
    </html>
  );
}
