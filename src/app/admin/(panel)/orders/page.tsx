import type { Metadata } from "next";
import { OrdersAdmin } from "@/components/admin/OrdersAdmin";

export const metadata: Metadata = {
  title: "Đơn nước",
};

export const dynamic = "force-dynamic";

export default function AdminOrdersPage() {
  return <OrdersAdmin />;
}
