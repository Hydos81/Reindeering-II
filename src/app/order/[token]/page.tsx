import type { Metadata } from "next";
import { OrderStatusView } from "@/components/guest/OrderStatusView";

export const metadata: Metadata = {
  title: "Theo dõi đơn nước",
  robots: { index: false, follow: false },
};

export default async function OrderStatusPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <OrderStatusView token={token} />;
}
