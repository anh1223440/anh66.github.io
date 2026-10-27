import { useState, useEffect, useRef } from "react";
import { Search, Filter, PlayCircle, Trash2, Download, X, Square, Check } from "lucide-react";
import MediaDetailModal from "../components/MediaDetailModal";
import ConfirmModal from "../components/ConfirmModal";

// Hook phát hiện thiết bị di động
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return isMobile;
}

export default function Home() {
  const [media, setMedia] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isMobile = useIsMobile();

  // Refs for long press (PC only)
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);

  useEffect(() => {
    fetchMedia();
    const handleMediaUploaded = () => fetchMedia();
    window.addEventListener('mediaUploaded', handleMediaUploaded);
    return () => window.removeEventListener('mediaUploaded', handleMediaUploaded);
  }, [search]);

  const fetchMedia = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/media?search=${search}`);
      const data = await res.json();
      setMedia(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch media", error);
      setMedia([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: number) => {
    setMedia(media.filter(m => m.id !== id));
    setSelectedMedia(null);
  };

  const handleUpdate = (updatedMedia: any) => {
    setMedia(media.map(m => m.id === updatedMedia.id ? updatedMedia : m));
    setSelectedMedia(updatedMedia);
  };

  const toggleSelect = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedIds(newSelected);
  };

  const deleteSelected = async () => {
    setShowDeleteConfirm(false);
    const idsToDelete = Array.from(selectedIds);
    for (const id of idsToDelete) {
      try {
        await fetch(`/api/media/${id}`, { method: "DELETE" });
      } catch (error) {
        console.error(`Failed to delete media ${id}`, error);
      }
    }
    await fetchMedia();
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const downloadSelected = () => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      const url = `/api/media/${id}/file?download=true`;
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = url;
      document.body.appendChild(iframe);
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 2000);
    }
  };

  // Xử lý long press trên PC
  const handlePointerDown = (e: React.PointerEvent, item: any) => {
    if (selectionMode) {
      toggleSelect(item.id);
      return;
    }
    if (isMobile) return; // Bỏ long press trên mobile
    isLongPress.current = false;
    pressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setSelectionMode(true);
      setSelectedIds(new Set([item.id]));
    }, 500);
  };

  const handlePointerUp = (e: React.PointerEvent, item: any) => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    if (!isLongPress.current && !selectionMode) {
      setSelectedMedia(item);
    }
    isLongPress.current = false;
  };

  const cancelSelection = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const selectedCount = selectedIds.size;

  return (
    <div className="h-full flex flex-col">
      {/* Header cố định, sát với thanh trên cùng (dùng translate để bù padding) */}
      <div 
        className="sticky top-0 z-10 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 
                   -translate-y-4 md:-translate-y-8 -translate-x-4 md:-translate-x-8 
                   w-[calc(100%+2rem)] md:w-[calc(100%+4rem)] 
                   px-4 md:px-8 py-2 md:py-3"
      >
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">All</h1>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                placeholder="Search photos..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10 pr-4 py-2.5 w-48 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-shadow"
              />
            </div>
            <button className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <Filter size={20} />
            </button>

            {/* === TRÊN PC: Các nút chức năng ở góc trên phải (hàng ngang) === */}
            {!isMobile && (
              <>
                <button
                  onClick={() => setSelectionMode(!selectionMode)}
                  className={`p-2.5 rounded-xl border transition-colors ${
                    selectionMode
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  {selectionMode ? <Check size={20} /> : <Square size={20} />}
                </button>
                {selectionMode && (
                  <>
                    <button
                      onClick={cancelSelection}
                      className="p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      title="Hủy chọn"
                    >
                      <X size={20} />
                    </button>
                    {selectedCount > 0 && (
                      <>
                        <button
                          onClick={downloadSelected}
                          className="p-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition-colors flex items-center gap-1"
                        >
                          <Download size={20} />
                          <span className="text-sm">{selectedCount}</span>
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(true)}
                          className="p-2.5 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors flex items-center gap-1"
                        >
                          <Trash2 size={20} />
                          <span className="text-sm">{selectedCount}</span>
                        </button>
                      </>
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Nội dung */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : media.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
          <div className="w-24 h-24 mb-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <Search size={40} className="text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">Không có ảnh nào</h3>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 auto-rows-[200px] mt-4">
          {media.map((item) => {
            const isVideo = item.mime_type.startsWith("video/");
            const isSelected = selectedIds.has(item.id);
            return (
              <div
                key={item.id}
                onPointerDown={(e) => handlePointerDown(e, item)}
                onPointerUp={(e) => handlePointerUp(e, item)}
                className={`group relative rounded-2xl overflow-hidden cursor-pointer bg-gray-100 dark:bg-gray-800 shadow-sm hover:shadow-md transition-all duration-300 ${
                  isSelected ? "ring-2 ring-indigo-600 ring-offset-2 ring-offset-white dark:ring-offset-gray-950" : ""
                }`}
              >
                {selectionMode && (
                  <div className="absolute top-2 left-2 z-10 bg-black/50 rounded-full p-1 pointer-events-none">
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      isSelected ? "bg-indigo-600 border-indigo-600" : "border-white"
                    }`}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                  </div>
                )}
                {isVideo ? (
                  <div className="w-full h-full relative">
                    <img
                      src={`/api/media/${item.id}/thumbnail?size=300`}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="gray" stroke-width="2"%3E%3Crect x="2" y="6" width="20" height="12" rx="2"/%3E%3Cpolygon points="10 6 10 18 18 12 10 6"/%3E%3C/svg%3E';
                      }}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                      <PlayCircle size={48} className="text-white opacity-80 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                    </div>
                  </div>
                ) : (
                  <img
                    src={`/api/media/${item.id}/thumbnail?size=300`}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="gray" stroke-width="2"%3E%3Crect x="2" y="6" width="20" height="12" rx="2"/%3E%3Cpolygon points="10 6 10 18 18 12 10 6"/%3E%3C/svg%3E';
                    }}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-4 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
                  <p className="text-white font-medium truncate text-sm">{item.name}</p>
                  {item.album_name && (
                    <p className="text-white/80 text-xs mt-1 truncate">{item.album_name}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedMedia && (
        <MediaDetailModal
          media={selectedMedia}
          onClose={() => setSelectedMedia(null)}
          onDelete={handleDelete}
          onUpdate={handleUpdate}
        />
      )}

      {showDeleteConfirm && (
        <ConfirmModal
          title="Xóa nhiều file"
          message={`Bạn có chắc muốn xóa ${selectedCount} ảnh/video này? Hành động này không thể hoàn tác.`}
          onConfirm={deleteSelected}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}

      {/* === TRÊN MOBILE: Nút chọn và menu chức năng nằm ngay trên nút Upload === */}
      {isMobile && (
        <>
          <button
            onClick={() => setSelectionMode(!selectionMode)}
            className="fixed bottom-20 right-6 z-40 p-3 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-colors"
            aria-label="Chọn ảnh"
          >
            {selectionMode ? <Check size={20} /> : <Square size={20} />}
          </button>

          {selectionMode && selectedCount > 0 && (
            <div className="fixed bottom-32 right-6 z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl flex flex-col gap-2 p-3 min-w-[140px] animate-in fade-in slide-in-from-bottom-10 duration-200">
              <button
                onClick={downloadSelected}
                className="flex items-center justify-center gap-2 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors w-full"
              >
                <Download size={18} />
                <span className="text-sm font-medium">Tải ({selectedCount})</span>
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center justify-center gap-2 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors w-full"
              >
                <Trash2 size={18} />
                <span className="text-sm font-medium">Xóa ({selectedCount})</span>
              </button>
              <button
                onClick={cancelSelection}
                className="flex items-center justify-center gap-2 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors w-full"
              >
                <X size={18} />
                <span className="text-sm font-medium">Hủy</span>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}