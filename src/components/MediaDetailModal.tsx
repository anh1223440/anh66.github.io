import { X, Download, Trash2 } from "lucide-react";
import { useState } from "react";
import ConfirmModal from "./ConfirmModal";

export default function MediaDetailModal({ media, onClose, onDelete }: any) {
  const isVideo = media.mime_type?.startsWith("video/");
  const [showConfirm, setShowConfirm] = useState(false);

  const handleDownload = async () => {
    try {
      const response = await fetch(`/api/media/${media.id}/file?download=true`);
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = media.name; // Tên file
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
      alert("Không thể tải file, vui lòng thử lại.");
    }
  };

  const confirmDelete = async () => {
    await fetch(`/api/media/${media.id}`, { method: "DELETE" });
    if (onDelete) onDelete(media.id);
    if (onClose) onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 md:p-8"
      onClick={onClose}
    >
      <div className="absolute top-6 right-6 flex gap-4 z-50">
        <button
          onClick={(e) => { e.stopPropagation(); handleDownload(); }}
          className="p-3 text-white/70 hover:text-white bg-black/40 hover:bg-black/60 rounded-full transition-colors"
          title="Tải xuống"
        >
          <Download size={24} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setShowConfirm(true); }}
          className="p-3 text-white/70 hover:text-red-500 bg-black/40 hover:bg-black/60 rounded-full transition-colors"
          title="Xóa"
        >
          <Trash2 size={24} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          className="p-3 text-white/70 hover:text-white bg-black/40 hover:bg-black/60 rounded-full transition-colors"
          title="Đóng"
        >
          <X size={24} />
        </button>
      </div>

      <div
        className="relative max-w-full max-h-full flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        {isVideo ? (
          <video
            src={`/api/media/${media.id}/file`}
            controls
            className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
          />
        ) : (
          <img
            src={`/api/media/${media.id}/file`}
            alt={media.name}
            className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
          />
        )}
      </div>

      {showConfirm && (
        <ConfirmModal
          title="Xóa File"
          message="Bạn có chắc muốn xóa ảnh/video này không? Hành động này không thể hoàn tác."
          onConfirm={confirmDelete}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}