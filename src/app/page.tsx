import type { Metadata } from "next";
import { GuestOrder } from "@/components/guest/GuestOrder";

export const metadata: Metadata = {
  title: "Đặt nước theo vé",
  description: "Nhập mã vé, chọn món nước và nhận tại chỗ ngồi của bạn.",
};

export default function HomePage() {
  return <GuestOrder />;
}
