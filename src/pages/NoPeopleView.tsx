// src/pages/NoPeopleView.tsx
import { useState, useEffect } from "react";
import { Image as ImageIcon, Loader2 } from "lucide-react";
import MediaDetailModal from "../components/MediaDetailModal";

export default function NoPeopleView() {
  const [media, setMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    setLoading(true);
    fetch("/api/faces/no-people")
      .then(r => r.json())
      .then(d => setMedia(Array.isArray(d) ? d : []))
      .catch(() => setMedia([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="flex justify-center py-20"><Loader2 className="animate-spin" size={40} /></div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <ImageIcon size={24} /> Không có người
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Ảnh/video phong cảnh, đồ vật, không có khuôn mặt người
        </p>
      </div>

      {media.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <ImageIcon size={64} className="mx-auto mb-4 opacity-30" />
          <p>Chưa có ảnh nào</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 auto-rows-[200px]">
          {media.map((item) => {
            const isVideo = item.mime_type?.startsWith("video/");
            return (
              <div
                key={item.id}
                onClick={() => setSelected(item)}
                className="group relative rounded-2xl overflow-hidden cursor-pointer bg-gray-100 dark:bg-gray-800"
              >
                <img
                  src={`/api/media/${item.id}/thumbnail?size=300`}
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  loading="lazy"
                />
                {isVideo && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/60 text-white text-xs rounded">
                    ▶
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <MediaDetailModal
          media={selected}
          onClose={() => setSelected(null)}
          onDelete={(id: number) => setMedia(media.filter(m => m.id !== id))}
        />
      )}
    </div>
  );
}