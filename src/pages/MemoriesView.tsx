// src/pages/MemoriesView.tsx
import { useState, useEffect } from "react";
import { Film, Loader2, PlayCircle, Trash2 } from "lucide-react";

export default function MemoriesView() {
  const [memories, setMemories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState<any>(null);

  const fetchMemories = async () => {
    try {
      const r = await fetch("/api/memories");
      const d = await r.json();
      setMemories(Array.isArray(d) ? d : []);
    } catch { setMemories([]); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    fetchMemories();
    const interval = setInterval(fetchMemories, 5000); // Poll để cập nhật render xong
    return () => clearInterval(interval);
  }, []);

  const deleteMemory = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Xóa Memories này?")) return;
    await fetch(`/api/memories/${id}`, { method: "DELETE" });
    setMemories(memories.filter(m => m.id !== id));
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin" size={40} /></div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Film size={24} /> Memories
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Video khoảnh khắc tự động tạo từ album người
        </p>
      </div>

      {memories.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <Film size={64} className="mx-auto mb-4 opacity-30" />
          <p>Chưa có Memories nào.</p>
          <p className="text-sm mt-2">Vào tab People → chọn người → "Tạo Memories".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
          {memories.map((m) => (
            <div
              key={m.id}
              onClick={() => m.status === "ready" && setPlaying(m)}
              className={`relative rounded-2xl overflow-hidden aspect-[3/4] bg-gradient-to-br from-indigo-500 to-purple-600 ${
                m.status === "ready" ? "cursor-pointer group" : "cursor-default"
              }`}
            >
              {m.cover_media_id ? (
                <img
                  src={`/api/memories/${m.id}/cover`}
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                />
              ) : null}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

              <div className="absolute bottom-4 left-4 right-4 text-white">
                <p className="text-lg font-bold truncate">{m.title}</p>
                <p className="text-sm opacity-80">
                  {m.status === "pending" && "Đang chờ render..."}
                  {m.status === "rendering" && "Đang render video..."}
                  {m.status === "ready" && `${m.media_ids?.length || 0} khoảnh khắc`}
                  {m.status === "failed" && "❌ Render thất bại"}
                </p>
              </div>

              {m.status === "ready" && (
                <PlayCircle
                  size={64}
                  className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-white/80 opacity-0 group-hover:opacity-100 transition-opacity"
                />
              )}

              {(m.status === "pending" || m.status === "rendering") && (
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <Loader2 size={48} className="text-white animate-spin" />
                </div>
              )}

              <button
                onClick={(e) => deleteMemory(m.id, e)}
                className="absolute top-3 right-3 p-2 bg-black/40 hover:bg-red-600 rounded-full text-white transition-colors"
                title="Xóa"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {playing && (
        <div
          className="fixed inset-0 bg-black z-50 flex items-center justify-center"
          onClick={() => setPlaying(null)}
        >
          <video
            src={`/api/memories/${playing.id}/video`}
            autoPlay
            controls
            className="max-w-[95vw] max-h-[95vh] rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={() => setPlaying(null)}
            className="absolute top-6 right-6 p-3 bg-black/60 hover:bg-black/80 rounded-full text-white"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}