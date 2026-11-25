import type { Metadata } from "next";
import { TicketsAdmin } from "@/components/admin/TicketsAdmin";

export const metadata: Metadata = {
  title: "Khách & vé",
};

export const dynamic = "force-dynamic";

export default function AdminTicketsPage() {
  return <TicketsAdmin />;
}
