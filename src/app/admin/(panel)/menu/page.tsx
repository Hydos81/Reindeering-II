import type { Metadata } from "next";
import { MenuAdmin } from "@/components/admin/MenuAdmin";

export const metadata: Metadata = {
  title: "Thực đơn",
};

export const dynamic = "force-dynamic";

export default function AdminMenuPage() {
  return <MenuAdmin />;
}
