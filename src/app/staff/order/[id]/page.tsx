import type { ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import { Brand } from "@/components/Brand";
import { StaffOrderCard } from "@/components/staff/StaffOrderCard";
import { verifyStaffToken } from "@/lib/auth";
import { repo } from "@/lib/db";
import { toPublicOrder } from "@/lib/public-order";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Cập nhật đơn nước",
  robots: { index: false, follow: false },
};

function ProblemCard({
  icon,
  title,
  children,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-10">
      <div className="card-warm rounded-[2rem] p-7 text-center">
        <div className="flex justify-center">
          <Brand compact />
        </div>
        <div className="mx-auto mt-8 grid size-14 place-items-center rounded-full bg-red-50 text-red-600">
          {icon}
        </div>
        <h1 className="mt-5 font-display text-3xl font-semibold text-ink">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{children}</p>
        <Link
          href="/"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-bold text-cream"
        >
          <ArrowLeft className="size-4" />
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}

export default async function StaffOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ t?: string; action?: string }>;
}) {
  const { id } = await params;
  const { t } = await searchParams;

  if (!verifyStaffToken(id, t || "")) {
    return (
      <ProblemCard
        icon={<ShieldAlert className="size-6" />}
        title="Liên kết không hợp lệ"
      >
        Liên kết cập nhật đơn đã hết hạn hoặc không đúng. Bạn mở lại liên kết
        mới nhất trong nhóm nhân sự nhé.
      </ProblemCard>
    );
  }

  const order = await repo.getOrder(id);
  if (!order) {
    return (
      <ProblemCard
        icon={<ShieldAlert className="size-6" />}
        title="Không tìm thấy đơn"
      >
        Đơn có thể đã bị xoá hoặc chưa được tạo.
      </ProblemCard>
    );
  }

  return (
    <StaffOrderCard
      token={t || ""}
      orderId={id}
      initialOrder={toPublicOrder(order)}
    />
  );
}
