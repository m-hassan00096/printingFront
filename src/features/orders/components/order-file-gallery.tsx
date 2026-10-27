import { useState } from "react";
import { Download, File, FileArchive, FileImage, FileSpreadsheet, FileText, Image as ImageIcon, Paperclip, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/shared/components/ui/button";
import { getApiErrorMessage } from "@/shared/api/http";
import { ConfirmDialog } from "@/features/identity/components/identity-ui";
import { fetchOrderFile } from "../api/orders.api";
import { useOrderActions, useOrderFiles } from "../hooks/use-orders";
import type { OrderFile, OrderItem } from "../types/orders.types";

const imageExtensions = new Set(["jpg", "jpeg", "png", "gif", "webp", "bmp"]);
function kind(file: OrderFile) {
  return (file.extension || file.name.split(".").pop() || "").toLowerCase().replace(/^\./, "");
}
function fileSize(bytes: number) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
function FileArtwork({ file, canPreview, onPreview }: {
  file: OrderFile; canPreview: boolean; onPreview: () => void;
}) {
  const ext = kind(file);
  const [imageFailed, setImageFailed] = useState(false);
  const thumbnail = canPreview && imageExtensions.has(ext) && file.url && !imageFailed;
  if (thumbnail) return <button type="button" aria-label={"معاينة " + file.name}
    onClick={onPreview} className="size-12 shrink-0 overflow-hidden rounded-lg border bg-muted">
    <img src={file.url!} alt={file.name} loading="lazy" onError={() => setImageFailed(true)}
      className="size-full object-cover" />
  </button>;
  const pdf = ext === "pdf";
  const design = ext === "psd" || ext === "ai";
  const spreadsheet = ["xls", "xlsx"].includes(ext);
  const document = ["doc", "docx"].includes(ext);
  const Icon = pdf || document ? FileText : spreadsheet ? FileSpreadsheet :
    design ? FileArchive : imageExtensions.has(ext) ? FileImage : File;
  return <div aria-label={"نوع الملف " + ext.toUpperCase()}
    className="flex size-12 shrink-0 flex-col items-center justify-center rounded-lg border bg-muted/60">
    <Icon className="size-6 text-primary" />
    <span className="mt-1 text-[10px] font-extrabold uppercase">{ext || "FILE"}</span>
  </div>;
}
export function OrderFileGallery({ orderId, item, canList, canUpload, canDelete, canView }: {
  orderId: number; item: OrderItem;
  canList: boolean; canUpload: boolean; canDelete: boolean; canView: boolean;
}) {
  const files = useOrderFiles(orderId, item.id, canList);
  const actions = useOrderActions();
  const [error, setError] = useState("");
  const [previewFile, setPreviewFile] = useState<OrderFile | null>(null);
  const [deleting, setDeleting] = useState<OrderFile | null>(null);
  async function upload(file?: File) {
    if (!file) return;
    setError("");
    try {
      await actions.upload.mutateAsync({ id: orderId, itemId: item.id, file });
      toast.success("تم رفع الملف.");
    } catch (e: unknown) {setError(getApiErrorMessage(e, "تعذّر رفع الملف."));}
  }
  async function download(file: OrderFile) {
    try {
      const blob = await fetchOrderFile(orderId, item.id, file.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.name;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e: unknown) {setError(getApiErrorMessage(e, "تعذّر تنزيل الملف."));}
  }
  async function deleteConfirmed() {
    if (!deleting) return;
    try {
      await actions.deleteFile.mutateAsync({ id: orderId, itemId: item.id, fileId: deleting.id });
      toast.success("تم نقل الملف إلى الأرشيف.");
      setDeleting(null);
    } catch (e: unknown) {setError(getApiErrorMessage(e, "تعذّر حذف الملف."));}
  }
  return <section className="mt-2 border-t pt-2" aria-label={"مرفقات " + item.serviceName}>
    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
      <h4 className="flex items-center gap-2 text-sm font-semibold">
        <Paperclip className="size-4" /> المرفقات
        {canList && files.data && <span className="text-xs text-muted-foreground">({files.data.length})</span>}
      </h4>
      {canUpload && <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold text-primary hover:bg-muted">
        <Upload className="size-4" /> رفع ملف
        <input aria-label={"رفع ملف للعنصر " + item.id} type="file" className="sr-only"
          disabled={actions.upload.isPending}
          accept=".jpg,.jpeg,.png,.gif,.webp,.bmp,.tif,.tiff,.pdf,.doc,.docx,.xls,.xlsx,.psd,.ai"
          onChange={(e) => {void upload(e.target.files?.[0]); e.target.value = "";}} />
      </label>}
    </div>
    {!canList ? <p className="text-xs text-muted-foreground">ليس لديك صلاحية عرض المرفقات.</p> :
      files.isPending ? <p className="text-sm text-muted-foreground">جاري تحميل المرفقات...</p> :
      files.isError ? <button type="button" className="text-xs text-destructive underline"
        onClick={() => void files.refetch()}>تعذّر تحميل الملفات — إعادة المحاولة</button> :
      !files.data?.length ? <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">لا توجد مرفقات حتى الآن.</p> :
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {files.data.map((file) => <article key={file.id}
          className="flex min-w-0 items-center gap-2.5 rounded-lg border bg-muted/20 p-2.5">
          <FileArtwork file={file} canPreview={canView}
            onPreview={() => setPreviewFile(file)} />
          <div className="min-w-0 flex-1 space-y-1">
            <p className="truncate text-sm font-semibold" title={file.name}>{file.name}</p>
            <p className="text-xs text-muted-foreground">{kind(file).toUpperCase()} · {fileSize(file.sizeBytes)}</p>
            <div className="flex items-center gap-3">
              {canView && <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                onClick={() => void download(file)}><Download className="size-3.5" /> تحميل</button>}
              {canDelete && <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-destructive hover:underline"
                onClick={() => setDeleting(file)}><Trash2 className="size-3.5" /> حذف</button>}
            </div>
          </div>
        </article>)}
      </div>}
    {error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}
    {deleting && <ConfirmDialog title="حذف المرفق"
      description={"سيتم نقل «" + deleting.name + "» إلى الأرشيف الخاص، وليس حذفه نهائيًا."}
      destructive confirmText="حذف المرفق" busy={actions.deleteFile.isPending}
      onClose={() => setDeleting(null)} onConfirm={() => void deleteConfirmed()} />}
    {previewFile && previewFile.url && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-4"
      onClick={(e) => {if (e.target === e.currentTarget) setPreviewFile(null);}}>
      <div role="dialog" aria-modal="true" aria-label={"معاينة " + previewFile.name}
        className="relative flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-lg bg-card">
        <div className="flex items-center justify-between gap-3 border-b p-3">
          <span className="min-w-0 truncate text-sm font-bold">{previewFile.name}</span>
          <Button variant="ghost" size="icon-sm" type="button" aria-label="إغلاق المعاينة"
            onClick={() => setPreviewFile(null)}><X className="size-4" /></Button>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-auto bg-muted/50 p-3">
          <img alt={previewFile.name} src={previewFile.url} className="max-h-[75vh] max-w-full object-contain" />
        </div>
        <div className="flex justify-end border-t p-3">
          <Button variant="outline" size="sm" onClick={() => void download(previewFile)}>
            <ImageIcon className="size-4" /> تحميل الصورة
          </Button>
        </div>
      </div>
    </div>}
  </section>;
}
