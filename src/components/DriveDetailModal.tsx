import { X, Download } from "lucide-react";

export default function DriveDetailModal({ media, onClose }: any) {
  const isVideo = media.mimeType?.startsWith("video/");

  const handleDownload = async () => {
    try {
      const response = await fetch(`/api/drive/stream/${media.id}?download=true`);
      if (!response.ok) throw new Error("Download failed");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = media.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Download error:", error);
      alert("Không thể tải file, vui lòng thử lại.");
    }
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
            src={`/api/drive/stream/${media.id}`}
            controls
            className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
          />
        ) : (
          <img
            src={`/api/drive/stream/${media.id}`}
            alt={media.name}
            className="max-w-[95vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
          />
        )}
      </div>
    </div>
  );
}