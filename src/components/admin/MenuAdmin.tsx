/* eslint-disable @next/next/no-img-element */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  Check,
  CupSoda,
  EyeOff,
  FolderOpen,
  ImagePlus,
  Info,
  Loader2,
  Pencil,
  Plus,
  Trash2,
  TriangleAlert,
  Upload,
  X,
} from "lucide-react";
import { Modal } from "@/components/Modal";
import { Toast } from "@/components/Toast";
import { DrinkArt } from "@/components/DrinkArt";
import {
  Button,
  Card,
  EmptyState,
  Field,
  SectionTitle,
  StatCard,
  fieldClass,
  textareaClass,
} from "@/components/admin/AdminUi";
import { adminFetch, errorMessage } from "@/lib/admin-client";
import { cn } from "@/lib/format";
import type { Category, CategoryWithItems, MenuItem } from "@/lib/types";

type MenuResponse = { ok: true; categories: CategoryWithItems[] };

type CategoryEditor =
  | { mode: "create" }
  | { mode: "edit"; category: Category }
  | null;

type ItemEditor =
  | { mode: "create"; categoryId: string }
  | { mode: "edit"; item: MenuItem; categoryId: string }
  | null;

type DeleteTarget =
  | { kind: "category"; id: string; name: string; itemCount: number }
  | { kind: "item"; id: string; name: string }
  | null;

type Notice = { message: string; tone: "success" | "error" | "info" };

export function MenuAdmin() {
  const [categories, setCategories] = useState<CategoryWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [categoryEditor, setCategoryEditor] = useState<CategoryEditor>(null);
  const [itemEditor, setItemEditor] = useState<ItemEditor>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [notice, setNotice] = useState<Notice | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await adminFetch<MenuResponse>("/api/admin/menu/categories");
      setCategories(data.categories);
    } catch (error) {
      setNotice({
        message: errorMessage(error, "Không tải được thực đơn."),
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Mount-time fetch; the async loader updates state after the effect returns.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function toggleAvailability(item: MenuItem) {
    setWorking(`toggle:${item.id}`);
    try {
      await adminFetch(`/api/admin/menu/items/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({ isAvailable: !item.isAvailable }),
      });
      setCategories((current) =>
        current.map((category) => ({
          ...category,
          items: category.items.map((row) =>
            row.id === item.id ? { ...row, isAvailable: !row.isAvailable } : row,
          ),
        })),
      );
      setNotice({
        message: item.isAvailable
          ? `Đã tạm ẩn “${item.name}”.`
          : `Đã mở bán “${item.name}”.`,
        tone: "success",
      });
    } catch (error) {
      setNotice({
        message: errorMessage(error, "Không cập nhật được trạng thái món."),
        tone: "error",
      });
    } finally {
      setWorking(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setWorking(`delete:${deleteTarget.id}`);
    try {
      const endpoint =
        deleteTarget.kind === "category"
          ? `/api/admin/menu/categories/${deleteTarget.id}`
          : `/api/admin/menu/items/${deleteTarget.id}`;
      await adminFetch(endpoint, { method: "DELETE" });
      setNotice({
        message:
          deleteTarget.kind === "category"
            ? `Đã xoá nhóm “${deleteTarget.name}”.`
            : `Đã xoá món “${deleteTarget.name}”.`,
        tone: "success",
      });
      setDeleteTarget(null);
      await load();
    } catch (error) {
      setNotice({
        message: errorMessage(error, "Không xoá được. Vui lòng thử lại."),
        tone: "error",
      });
    } finally {
      setWorking(null);
    }
  }

  const items = categories.flatMap((category) => category.items);
  const available = items.filter((item) => item.isAvailable).length;

  return (
    <div>
      <SectionTitle
        eyebrow="Nội dung · Thực đơn"
        title="Menu nước"
        description="Quản lý nhóm món, món nước, ảnh và trạng thái còn bán. Menu hiển thị ngay cho khách sau check-in."
        actions={
          <>
            <Button onClick={() => setCategoryEditor({ mode: "create" })}>
              <FolderOpen className="size-4" />
              Thêm nhóm
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (categories.length === 0) {
                  setCategoryEditor({ mode: "create" });
                  return;
                }
                setItemEditor({ mode: "create", categoryId: categories[0].id });
              }}
            >
              <Plus className="size-4" />
              Thêm món
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard label="Nhóm món" value={categories.length} hint="Theo thứ tự" icon={FolderOpen} tone="coffee" />
        <StatCard label="Tổng số món" value={items.length} icon={CupSoda} tone="gold" />
        <StatCard label="Đang bán" value={available} hint="Khách chọn được" icon={BadgeCheck} tone="sage" />
        <StatCard label="Tạm ẩn" value={items.length - available} icon={EyeOff} tone="terracotta" />
      </div>

      {loading && categories.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-3xl border border-line bg-paper/80 py-20 text-sm text-muted">
          <Loader2 className="size-4 animate-spin" />
          Đang tải thực đơn…
        </div>
      ) : categories.length === 0 ? (
        <EmptyState
          icon={CupSoda}
          title="Thực đơn đang trống"
          description="Tạo nhóm món đầu tiên, sau đó thêm các món nước để khách có thể chọn."
          action={
            <Button variant="primary" onClick={() => setCategoryEditor({ mode: "create" })}>
              <Plus className="size-4" />
              Tạo nhóm món
            </Button>
          }
        />
      ) : (
        <div className={cn("space-y-4", loading && "opacity-70")}>
          {categories.map((category) => (
            <Card key={category.id} padded={false}>
              <div className="flex flex-col gap-3 border-b border-line/70 bg-cream/40 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-coffee text-cream">
                    <FolderOpen className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate font-display text-xl font-semibold text-ink">
                      {category.name}
                    </h2>
                    <p className="text-[10px] text-muted">
                      {category.items.length} món · Thứ tự {category.sortOrder}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() =>
                      setItemEditor({ mode: "create", categoryId: category.id })
                    }
                  >
                    <Plus className="size-3.5" />
                    Thêm món
                  </Button>
                  <button
                    type="button"
                    onClick={() => setCategoryEditor({ mode: "edit", category })}
                    className="grid size-8 place-items-center rounded-lg border border-line bg-paper text-muted transition hover:text-coffee"
                    title="Sửa nhóm món"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDeleteTarget({
                        kind: "category",
                        id: category.id,
                        name: category.name,
                        itemCount: category.items.length,
                      })
                    }
                    className="grid size-8 place-items-center rounded-lg border border-line bg-paper text-muted transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                    title="Xoá nhóm món"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>

              {category.items.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
                  <p className="text-sm font-semibold text-coffee">Nhóm này chưa có món</p>
                  <p className="mt-1 text-xs text-muted">
                    Thêm món đầu tiên để nhóm xuất hiện trong menu của khách.
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      setItemEditor({ mode: "create", categoryId: category.id })
                    }
                    className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-dashed border-terracotta/40 px-3 py-1.5 text-xs font-semibold text-terracotta transition hover:bg-terracotta/5"
                  >
                    <Plus className="size-3.5" />
                    Thêm món
                  </button>
                </div>
              ) : (
                <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {category.items.map((item) => (
                    <article
                      key={item.id}
                      className={cn(
                        "group overflow-hidden rounded-2xl border border-line/80 bg-paper transition hover:-translate-y-0.5 hover:border-terracotta/25 hover:shadow-[0_22px_45px_-35px_rgba(74,52,40,0.55)]",
                        !item.isAvailable && "opacity-75",
                      )}
                    >
                      <div className="relative aspect-[4/3] overflow-hidden bg-cream">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            className={cn(
                              "size-full object-cover transition duration-500 group-hover:scale-[1.03]",
                              !item.isAvailable && "grayscale",
                            )}
                          />
                        ) : (
                          <DrinkArt
                            name={item.name}
                            className={cn("size-full", !item.isAvailable && "grayscale")}
                          />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-coffee/25 via-transparent to-transparent" />
                        <span
                          className={cn(
                            "absolute left-2.5 top-2.5 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ring-1 ring-inset backdrop-blur",
                            item.isAvailable
                              ? "bg-paper/90 text-sage ring-sage/20"
                              : "bg-paper/90 text-muted ring-line",
                          )}
                        >
                          {item.isAvailable ? "Đang bán" : "Tạm ẩn"}
                        </span>
                        <span className="absolute right-2.5 top-2.5 rounded-full bg-coffee/60 px-2 py-0.5 text-[9px] font-semibold text-cream/80 backdrop-blur">
                          #{item.sortOrder}
                        </span>
                      </div>
                      <div className="p-3.5">
                        <h3 className="truncate font-display text-lg font-semibold leading-tight text-ink">
                          {item.name}
                        </h3>
                        <p className="mt-1 line-clamp-2 min-h-[2.1rem] text-[11px] leading-relaxed text-muted">
                          {item.description || "Chưa có mô tả cho món này."}
                        </p>
                        <div className="mt-3 flex items-center justify-between gap-2 border-t border-line/60 pt-2.5">
                          <button
                            type="button"
                            onClick={() => void toggleAvailability(item)}
                            disabled={working !== null}
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ring-inset transition disabled:opacity-50",
                              item.isAvailable
                                ? "bg-sage-soft text-sage ring-sage/20 hover:bg-sage/15"
                                : "bg-cream text-muted ring-line hover:bg-gold-soft hover:text-coffee",
                            )}
                          >
                            {working === `toggle:${item.id}` ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : item.isAvailable ? (
                              <Check className="size-3" />
                            ) : (
                              <EyeOff className="size-3" />
                            )}
                            {item.isAvailable ? "Đang bán" : "Tạm ẩn"}
                          </button>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() =>
                                setItemEditor({
                                  mode: "edit",
                                  item,
                                  categoryId: category.id,
                                })
                              }
                              className="grid size-7 place-items-center rounded-lg text-muted transition hover:bg-cream hover:text-coffee"
                              title="Sửa món"
                            >
                              <Pencil className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteTarget({ kind: "item", id: item.id, name: item.name })
                              }
                              className="grid size-7 place-items-center rounded-lg text-muted transition hover:bg-red-50 hover:text-red-600"
                              title="Xoá món"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-start gap-2 rounded-2xl border border-line/70 bg-gold-soft/30 px-4 py-3 text-[11px] leading-relaxed text-coffee">
        <Info className="mt-0.5 size-3.5 shrink-0 text-terracotta" />
        Ảnh món nên có tỉ lệ 4:3, dung lượng dưới 6MB. Nếu chưa có ảnh, hệ thống
        dùng hình minh hoạ theo tên món.
      </div>

      <CategoryDialog
        key={categoryEditor ? `${categoryEditor.mode}:${categoryEditor.mode === "edit" ? categoryEditor.category.id : "new"}` : "closed"}
        state={categoryEditor}
        onClose={() => setCategoryEditor(null)}
        onSaved={(message) => {
          setCategoryEditor(null);
          setNotice({ message, tone: "success" });
          void load();
        }}
      />

      <ItemDialog
        key={itemEditor ? `${itemEditor.mode}:${itemEditor.mode === "edit" ? itemEditor.item.id : "new"}:${itemEditor.categoryId}` : "closed"}
        state={itemEditor}
        categories={categories}
        onClose={() => setItemEditor(null)}
        onSaved={(message) => {
          setItemEditor(null);
          setNotice({ message, tone: "success" });
          void load();
        }}
      />

      <Modal
        open={deleteTarget !== null}
        onClose={() => {
          if (!working) setDeleteTarget(null);
        }}
        title={deleteTarget?.kind === "category" ? "Xoá nhóm món?" : "Xoá món này?"}
        description={deleteTarget?.name}
        size="sm"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button onClick={() => setDeleteTarget(null)} disabled={working !== null}>
              Giữ lại
            </Button>
            <Button
              variant="danger"
              onClick={() => void confirmDelete()}
              disabled={working !== null}
            >
              {working !== null && <Loader2 className="size-4 animate-spin" />}
              Xoá
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm leading-relaxed text-muted">
          <p>
            {deleteTarget?.kind === "category"
              ? "Nhóm món sẽ bị xoá khỏi thực đơn."
              : "Món nước sẽ bị xoá khỏi menu của khách."}
          </p>
          {deleteTarget?.kind === "category" && deleteTarget.itemCount > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" />
              Nhóm này có {deleteTarget.itemCount} món. Tất cả món bên trong cũng
              sẽ bị xoá.
            </div>
          )}
          <p className="text-xs">Đơn nước đã ghi nhận trước đó vẫn giữ nguyên tên món.</p>
        </div>
      </Modal>

      <Toast
        message={notice?.message ?? null}
        tone={notice?.tone}
        onClose={() => setNotice(null)}
      />
    </div>
  );
}

function CategoryDialog({
  state,
  onClose,
  onSaved,
}: {
  state: CategoryEditor;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const category = state?.mode === "edit" ? state.category : null;
  const [name, setName] = useState(category?.name ?? "");
  const [sortOrder, setSortOrder] = useState(
    category ? String(category.sortOrder) : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name,
        sortOrder: sortOrder.trim() ? Number(sortOrder) : undefined,
      };
      if (category) {
        await adminFetch(`/api/admin/menu/categories/${category.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        onSaved(`Đã cập nhật nhóm “${name.trim()}”.`);
      } else {
        await adminFetch("/api/admin/menu/categories", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        onSaved(`Đã tạo nhóm “${name.trim()}”.`);
      }
    } catch (saveError) {
      setError(errorMessage(saveError, "Không lưu được nhóm món."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={state !== null}
      onClose={() => {
        if (!saving) onClose();
      }}
      title={category ? "Sửa nhóm món" : "Thêm nhóm món"}
      description="Ví dụ: Cà phê, Trà trái cây, Đá xay…"
      size="sm"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose} disabled={saving}>
            Huỷ
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="category-editor-form"
            disabled={saving || !name.trim()}
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            Lưu nhóm
          </Button>
        </div>
      }
    >
      <form id="category-editor-form" onSubmit={(event) => void submit(event)} className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-800">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        )}
        <Field label="Tên nhóm món" htmlFor="category-name">
          <input
            id="category-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Cà phê"
            maxLength={60}
            className={fieldClass}
            required
          />
        </Field>
        <Field
          label="Thứ tự hiển thị"
          htmlFor="category-order"
          hint="Số nhỏ hơn hiển thị trước. Để trống để xếp cuối."
        >
          <input
            id="category-order"
            type="number"
            inputMode="numeric"
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
            placeholder="Tự động"
            className={fieldClass}
          />
        </Field>
      </form>
    </Modal>
  );
}

function ItemDialog({
  state,
  categories,
  onClose,
  onSaved,
}: {
  state: ItemEditor;
  categories: CategoryWithItems[];
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const item = state?.mode === "edit" ? state.item : null;
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState(item?.name ?? "");
  const [description, setDescription] = useState(item?.description ?? "");
  const [categoryId, setCategoryId] = useState(
    state?.categoryId ?? categories[0]?.id ?? "",
  );
  const [imageUrl, setImageUrl] = useState(item?.imageUrl ?? "");
  const [isAvailable, setIsAvailable] = useState(item?.isAvailable ?? true);
  const [sortOrder, setSortOrder] = useState(item ? String(item.sortOrder) : "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function uploadFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const data = await adminFetch<{ ok: true; url: string }>("/api/admin/upload", {
        method: "POST",
        body: form,
      });
      setImageUrl(data.url);
    } catch (uploadError) {
      setError(errorMessage(uploadError, "Không tải được ảnh lên."));
    } finally {
      setUploading(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        categoryId,
        name,
        description,
        imageUrl,
        isAvailable,
        sortOrder: sortOrder.trim() ? Number(sortOrder) : undefined,
      };
      if (item) {
        await adminFetch(`/api/admin/menu/items/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
        onSaved(`Đã cập nhật món “${name.trim()}”.`);
      } else {
        await adminFetch("/api/admin/menu/items", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        onSaved(`Đã thêm món “${name.trim()}”.`);
      }
    } catch (saveError) {
      setError(errorMessage(saveError, "Không lưu được món nước."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={state !== null}
      onClose={() => {
        if (!saving && !uploading) onClose();
      }}
      title={item ? "Sửa món nước" : "Thêm món nước"}
      description="Món đang bán sẽ hiện ngay trong menu chọn nước của khách."
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button onClick={onClose} disabled={saving || uploading}>
            Huỷ
          </Button>
          <Button
            variant="primary"
            type="submit"
            form="item-editor-form"
            disabled={saving || uploading || !name.trim() || !categoryId}
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            Lưu món
          </Button>
        </div>
      }
    >
      <form id="item-editor-form" onSubmit={(event) => void submit(event)} className="space-y-4">
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs leading-relaxed text-red-800">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tên món" htmlFor="item-name">
            <input
              id="item-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Cà phê sữa đá"
              maxLength={80}
              className={fieldClass}
              required
            />
          </Field>
          <Field label="Nhóm món" htmlFor="item-category">
            <select
              id="item-category"
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className={fieldClass}
              required
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Mô tả" htmlFor="item-description">
          <textarea
            id="item-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Cà phê robusta, sữa đặc, đá…"
            rows={2}
            maxLength={240}
            className={textareaClass}
          />
        </Field>

        <div>
          <p className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-coffee">
            Ảnh món
          </p>
          <div className="flex flex-col gap-3 rounded-2xl border border-line bg-cream/40 p-3 sm:flex-row">
            <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-xl border border-line bg-paper sm:w-36">
              {imageUrl ? (
                <>
                  <img src={imageUrl} alt="Ảnh xem trước" className="size-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setImageUrl("")}
                    className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-coffee/75 text-cream backdrop-blur transition hover:bg-red-600"
                    aria-label="Xoá ảnh"
                  >
                    <X className="size-3.5" />
                  </button>
                </>
              ) : (
                <div className="grid size-full place-items-center text-muted">
                  <ImagePlus className="size-6" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = "";
                  if (file) void uploadFile(file);
                }}
              />
              <Button onClick={() => fileRef.current?.click()} disabled={uploading}>
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Upload className="size-4" />
                )}
                {uploading ? "Đang tải ảnh…" : "Chọn ảnh từ máy"}
              </Button>
              <p className="mt-2 text-[10px] leading-relaxed text-muted">
                JPG, PNG, WEBP, GIF hoặc AVIF · tối đa 6MB. Ảnh được lưu trên máy
                chủ hoặc Supabase Storage.
              </p>
              <input
                value={imageUrl}
                onChange={(event) => setImageUrl(event.target.value)}
                placeholder="Hoặc dán đường dẫn ảnh https://…"
                className="mt-2 h-9 w-full rounded-lg border border-line bg-paper px-2.5 text-[11px] outline-none focus:border-terracotta"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Thứ tự trong nhóm" htmlFor="item-order">
            <input
              id="item-order"
              type="number"
              inputMode="numeric"
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
              placeholder="Tự động"
              className={fieldClass}
            />
          </Field>
          <div className="flex items-end">
            <label className="flex h-11 w-full cursor-pointer items-center justify-between rounded-xl border border-line bg-paper px-3.5 text-sm">
              <span className="font-semibold text-coffee">Đang bán cho khách</span>
              <input
                type="checkbox"
                checked={isAvailable}
                onChange={(event) => setIsAvailable(event.target.checked)}
                className="size-4 accent-[var(--color-sage)]"
              />
            </label>
          </div>
        </div>
      </form>
    </Modal>
  );
}
