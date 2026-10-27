// src/pages/Albums.tsx
import React, { useState, useEffect, useRef } from "react";
import {
  Folder, Plus, Trash2, Image as ImageIcon, PlayCircle, Square, Download, X, Check, Users, Film,
} from "lucide-react";
import MediaDetailModal from "../components/MediaDetailModal";
import ConfirmModal from "../components/ConfirmModal";
import PeopleView from "./PeopleView";
import NoPeopleView from "./NoPeopleView";
import MemoriesView from "./MemoriesView";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return isMobile;
}

type Tab = "albums" | "people" | "no-people" | "memories";

export default function Albums() {
  const [activeTab, setActiveTab] = useState<Tab>("albums");
  const [albums, setAlbums] = useState<any[]>([]);
  const [media, setMedia] = useState<any[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<any>(null);
  const [newAlbumName, setNewAlbumName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [albumToDelete, setAlbumToDelete] = useState<number | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const isMobile = useIsMobile();
  const longPressTimeouts = useRef<{ [key: number]: NodeJS.Timeout }>({});
  const longPressTriggered = useRef<{ [key: number]: boolean }>({});
  const pointerMoved = useRef<{ [key: number]: boolean }>({});

  useEffect(() => {
    fetchAlbums();
    const h = () => fetchAlbums();
    window.addEventListener("mediaUploaded", h);
    return () => window.removeEventListener("mediaUploaded", h);
  }, []);

  useEffect(() => {
    if (selectedAlbum) fetchMedia(selectedAlbum.id);
    else { setSelectionMode(false); setSelectedIds(new Set()); }
  }, [selectedAlbum]);

  const fetchAlbums = async () => {
    try {
      const r = await fetch("/api/albums");
      const d = await r.json();
      setAlbums(Array.isArray(d) ? d : []);
    } catch { setAlbums([]); }
  };

  const fetchMedia = async (albumId: number | string) => {
    try {
      const r = await fetch(`/api/media?album_id=${albumId}`);
      const d = await r.json();
      setMedia(Array.isArray(d) ? d : []);
    } catch { setMedia([]); }
  };

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlbumName.trim()) return;
    try {
      const r = await fetch("/api/albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newAlbumName }),
      });
      if (r.ok) { setNewAlbumName(""); setIsCreating(false); fetchAlbums(); }
    } catch {}
  };

  const confirmDeleteAlbum = async () => {
    if (albumToDelete !== null) {
      await fetch(`/api/albums/${albumToDelete}`, { method: "DELETE" });
      if (selectedAlbum?.id === albumToDelete) setSelectedAlbum(null);
      fetchAlbums();
      setAlbumToDelete(null);
    }
  };

  const handleDeleteMedia = (id: number) => {
    setMedia(media.filter(m => m.id !== id));
    setSelectedMedia(null);
  };

  const toggleSelect = (id: number) => {
    const s = new Set(selectedIds);
    if (s.has(id)) s.delete(id); else s.add(id);
    setSelectedIds(s);
  };

  const deleteSelected = async () => {
    setShowDeleteConfirm(false);
    for (const id of Array.from(selectedIds)) {
      try { await fetch(`/api/media/${id}`, { method: "DELETE" }); } catch {}
    }
    await fetchMedia(selectedAlbum.id);
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const downloadSelected = () => {
    for (const id of Array.from(selectedIds)) {
      window.open(`/api/media/${id}/file?download=true`, "_blank");
    }
  };

  const handleMediaClick = (item: any) => {
    if (longPressTriggered.current[item.id]) {
      longPressTriggered.current[item.id] = false;
      return;
    }
    if (selectionMode) toggleSelect(item.id);
    else setSelectedMedia(item);
  };

  const handlePointerDown = (id: number) => {
    if (selectionMode || isMobile) return;
    if (longPressTimeouts.current[id]) clearTimeout(longPressTimeouts.current[id]);
    pointerMoved.current[id] = false;
    longPressTriggered.current[id] = false;
    longPressTimeouts.current[id] = setTimeout(() => {
      if (!pointerMoved.current[id] && !longPressTriggered.current[id]) {
        setSelectionMode(true);
        setSelectedIds(new Set([id]));
        longPressTriggered.current[id] = true;
      }
    }, 500);
  };

  const handlePointerMove = (id: number) => {
    if (longPressTimeouts.current[id]) {
      pointerMoved.current[id] = true;
      clearTimeout(longPressTimeouts.current[id]);
      delete longPressTimeouts.current[id];
    }
  };

  const handlePointerUp = (id: number) => {
    if (longPressTimeouts.current[id]) {
      clearTimeout(longPressTimeouts.current[id]);
      delete longPressTimeouts.current[id];
    }
  };

  const selectedCount = selectedIds.size;

  // ============ ALBUM DETAIL VIEW ============
  if (selectedAlbum && activeTab === "albums") {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center justify-between mb-6 shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setSelectedAlbum(null)} className="text-gray-500 hover:text-gray-900 dark:hover:text-white">
              ← Trở lại
            </button>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">
              {selectedAlbum.name}
            </h1>
          </div>
          {!isMobile && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setSelectionMode(!selectionMode); if (selectionMode) setSelectedIds(new Set()); }}
                className={`p-2.5 rounded-xl border transition-colors ${
                  selectionMode ? "bg-indigo-600 text-white border-indigo-600" :
                  "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300"
                }`}
              >
                {selectionMode ? <Check size={20} /> : <Square size={20} />}
              </button>
              {selectionMode && selectedCount > 0 && (
                <>
                  <button onClick={downloadSelected} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-700">
                    <Download size={18} /> {selectedCount}
                  </button>
                  <button onClick={() => setShowDeleteConfirm(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 text-white hover:bg-red-700">
                    <Trash2 size={18} /> {selectedCount}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {media.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500">
            <div className="w-24 h-24 mb-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <ImageIcon size={40} />
            </div>
            <p>Thư mục trống</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 auto-rows-[200px]">
            {media.map((item) => {
              const isVideo = item.mime_type?.startsWith("video/");
              const isSelected = selectedIds.has(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => handleMediaClick(item)}
                  onPointerDown={() => handlePointerDown(item.id)}
                  onPointerMove={() => handlePointerMove(item.id)}
                  onPointerUp={() => handlePointerUp(item.id)}
                  onPointerLeave={() => handlePointerUp(item.id)}
                  className={`group relative rounded-2xl overflow-hidden cursor-pointer bg-gray-100 dark:bg-gray-800 shadow-sm hover:shadow-md transition-all ${
                    isSelected ? "ring-2 ring-indigo-600 ring-offset-2 dark:ring-offset-gray-950" : ""
                  }`}
                >
                  {selectionMode && (
                    <div className="absolute top-2 left-2 z-10 bg-black/50 rounded-full p-1">
                      <input type="checkbox" checked={isSelected} onChange={() => {}} className="w-5 h-5" />
                    </div>
                  )}
                  <img
                    src={`/api/media/${item.id}/thumbnail?size=300`}
                    alt={item.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  {isVideo && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40">
                      <PlayCircle size={48} className="text-white opacity-80" />
                    </div>
                  )}
                  <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <p className="text-white text-xs truncate">{item.name}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {selectedMedia && (
          <MediaDetailModal media={selectedMedia} onClose={() => setSelectedMedia(null)} onDelete={handleDeleteMedia} />
        )}
        {showDeleteConfirm && (
          <ConfirmModal
            title="Xóa"
            message={`Xóa ${selectedCount} ảnh/video?`}
            onConfirm={deleteSelected}
            onCancel={() => setShowDeleteConfirm(false)}
          />
        )}
      </div>
    );
  }

  // ============ MAIN TABS ============
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Albums</h1>
        {activeTab === "albums" && (
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2.5 rounded-xl font-medium"
          >
            <Plus size={20} /> New Album
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-800 overflow-x-auto">
        {[
          { id: "albums", label: "Albums", icon: Folder },
          { id: "people", label: "People", icon: Users },
          { id: "no-people", label: "Không người", icon: ImageIcon },
          { id: "memories", label: "Memories", icon: Film },
        ].map((tab: any) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 font-medium border-b-2 whitespace-nowrap transition-colors ${
              activeTab === tab.id
                ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
                : "border-transparent text-gray-500 hover:text-gray-900 dark:hover:text-white"
            }`}
          >
            <tab.icon size={18} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {activeTab === "people" && <PeopleView />}
        {activeTab === "no-people" && <NoPeopleView />}
        {activeTab === "memories" && <MemoriesView />}

        {activeTab === "albums" && (
          <>
            {isCreating && (
              <form onSubmit={handleCreateAlbum} className="mb-8 p-6 bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Tạo Album</h3>
                <div className="flex gap-4">
                  <input
                    type="text"
                    value={newAlbumName}
                    onChange={(e) => setNewAlbumName(e.target.value)}
                    placeholder="Album Name"
                    className="flex-1 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2.5 text-gray-900 dark:text-white"
                    autoFocus
                  />
                  <button type="button" onClick={() => setIsCreating(false)} className="px-5 py-2.5 rounded-xl font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100">
                    Hủy
                  </button>
                  <button type="submit" disabled={!newAlbumName.trim()} className="px-5 py-2.5 rounded-xl font-medium bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50">
                    Tạo
                  </button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {albums.map((album) => (
                <div
                  key={album.id}
                  onClick={() => setSelectedAlbum(album)}
                  className="group bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm hover:shadow-md border border-gray-100 dark:border-gray-800 cursor-pointer transition-all hover:-translate-y-1"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                      <Folder size={24} />
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setAlbumToDelete(album.id); }}
                      className="p-2 text-gray-400 hover:text-red-500 rounded-full opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white truncate">{album.name}</h3>
                </div>
              ))}
            </div>

            {albumToDelete !== null && (
              <ConfirmModal
                title="Xóa Album"
                message="Xóa album này? Ảnh/video bên trong sẽ không bị xóa khỏi hệ thống."
                onConfirm={confirmDeleteAlbum}
                onCancel={() => setAlbumToDelete(null)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}