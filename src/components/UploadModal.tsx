import { useState, useEffect } from "react";
import { X, UploadCloud, Loader2 } from "lucide-react";
import { useDropzone } from "react-dropzone";

export default function UploadModal({ onClose }: { onClose: () => void }) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [albums, setAlbums] = useState<any[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState("");

  useEffect(() => {
    fetch("/api/albums")
      .then((res) => res.json())
      .then(setAlbums);
  }, []);

  const onDrop = (acceptedFiles: File[]) => {
    setFiles((prev) => [...prev, ...acceptedFiles]);
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpeg", ".jpg", ".png", ".gif"],
      "video/*": [".mp4", ".mov", ".avi", ".mkv"],
    },
  } as any);

  const handleUpload = async () => {
    if (files.length === 0) return;
    setUploading(true);

    let successCount = 0;
    let errorCount = 0;

    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      if (selectedAlbum) formData.append("album_id", selectedAlbum);

      // Tạo AbortController để timeout sau 10 phút
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000);

      try {
        const res = await fetch("/api/media", {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        if (res.ok) {
          successCount++;
        } else {
          const data = await res.json();
          console.error("Upload failed:", data.error);
          errorCount++;
        }
      } catch (error: any) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
          console.error("Upload timeout after 10 minutes");
          errorCount++;
        } else {
          console.error("Upload error:", error);
          errorCount++;
        }
      }
    }

    setUploading(false);
    onClose();
    
    window.dispatchEvent(new Event('mediaUploaded'));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Upload file</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-500/10"
                : "border-gray-300 dark:border-gray-700 hover:border-indigo-400 dark:hover:border-indigo-500"
            }`}
          >
            <input {...getInputProps()} />
            <UploadCloud className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <p className="text-gray-600 dark:text-gray-400">
              Ấn vào để up ảnh
            </p>
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              <p className="font-medium text-sm text-gray-700 dark:text-gray-300">Số file ({files.length})</p>
              <ul className="text-sm text-gray-500 dark:text-gray-400 max-h-32 overflow-y-auto">
                {files.map((file, i) => (
                  <li key={i} className="truncate">{file.name}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Chọn Album
              </label>
              <select
                value={selectedAlbum}
                onChange={(e) => setSelectedAlbum(e.target.value)}
                className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">None</option>
                {albums.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 bg-gray-50 dark:bg-gray-900/50">
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={files.length === 0 || uploading}
            className="px-5 py-2.5 rounded-xl font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {uploading && <Loader2 size={18} className="animate-spin" />}
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </div>
      </div>
    </div>
  );
}