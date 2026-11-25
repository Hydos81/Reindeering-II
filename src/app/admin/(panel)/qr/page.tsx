import type { Metadata } from "next";
import { QrAdmin } from "@/components/admin/QrAdmin";

export const metadata: Metadata = {
  title: "Mã QR",
};

export const dynamic = "force-dynamic";

export default function AdminQrPage() {
  return <QrAdmin />;
}
