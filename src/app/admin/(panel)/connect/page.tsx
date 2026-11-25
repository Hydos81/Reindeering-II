import type { Metadata } from "next";
import { ConnectAdmin } from "@/components/admin/ConnectAdmin";

export const metadata: Metadata = {
  title: "Kết nối",
};

export const dynamic = "force-dynamic";

export default function AdminConnectPage() {
  return <ConnectAdmin />;
}
