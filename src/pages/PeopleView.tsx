// src/pages/PeopleView.tsx
import { useState, useEffect } from "react";
import { Users, Loader2, Sparkles, Pencil, X, Check, Trash2 } from "lucide-react";
import MediaDetailModal from "../components/MediaDetailModal";

export default function PeopleView() {
  const [people, setPeople] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState<any>({ running: false, total: 0, done: 0, current: "" });
  const [selectedPerson, setSelectedPerson] = useState<any>(null);
  const [personMedia, setPersonMedia] = useState<any[]>([]);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [renaming, setRenaming] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [selectedMedia, setSelectedMedia] = useState<any>(null);
  const [creatingMemory, setCreatingMemory] = useState(false);

  const fetchPeople = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/faces/people");
      const d = await r.json();
      setPeople(Array.isArray(d) ? d : []);
    } catch { setPeople([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPeople(); }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const r = await fetch("/api/faces/scan/status");
        const s = await r.json();
        setScanStatus(s);
        if (scanning && !s.running) {
          setScanning(false);
          fetchPeople();
        }
      } catch {}
    }, 2000);
    return () => clearInterval(interval);
  }, [scanning]);

  const startScan = async () => {
    setScanning(true);
    try { await fetch("/api/faces/scan", { method: "POST" }); } 
    catch { setScanning(false); }
  };

  const openPerson = async (person: any) => {
    setSelectedPerson(person);
    setLoadingMedia(true);
    try {
      const r = await fetch(`/api/faces/people/${person.id}/media`);
      const d = await r.json();
      setPersonMedia(Array.isArray(d) ? d : []);
    } catch { setPersonMedia([]); }
    finally { setLoadingMedia(false); }
  };

  const saveRename = async (id: number) => {
    try {
      await fetch(`/api/faces/people/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue.trim() || null }),
      });
      setRenaming(null);
      fetchPeople();
      if (selectedPerson?.id === id) {
        setSelectedPerson({ ...selectedPerson, name: renameValue.trim() || null });
      }
    } catch {}
  };

  const deleteCluster = async (id: number) => {
    if (!confirm("Xóa nhận diện người này?")) return;
    try {
      await fetch(`/api/faces/people/${id}`, { method: "DELETE" });
      setSelectedPerson(null);
      fetchPeople();
    } catch {}
  };

  const createMemory = async () => {
    if (!selectedPerson) return;
    setCreatingMemory(true);
    try {
      const r = await fetch("/api/memories/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clusterId: selectedPerson.id, title: selectedPerson.name || `Người #${selectedPerson.id}` }),
      });
      const d = await r.json();
      alert(`Đã tạo video Memories (ID: ${d.memoryId}). Xem ở tab Memories sau ít phút.`);
    } catch { alert("Lỗi tạo Memories"); }
    finally { setCreatingMemory(false); }
  };

  if (selectedPerson) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => { setSelectedPerson(null); setPersonMedia([]); }} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">←</button>
          <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-800 flex-shrink-0">
            {selectedPerson.cover_face_id && <img src={`/api/faces/thumbnail/${selectedPerson.cover_face_id}`} className="w-full h-full object-cover" />}
          </div>
          <div className="flex-1 min-w-0">
            {renaming === selectedPerson.id ? (
              <div className="flex gap-2 items-center">
                <input type="text" value={renameValue} onChange={(e) => setRenameValue(e.target.value)} autoFocus className="px-3 py-1 rounded-lg border border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white" />
                <button onClick={() => saveRename(selectedPerson.id)} className="p-1 text-green-600"><Check size={18} /></button>
                <button onClick={() => setRenaming(null)} className="p-1 text-gray-500"><X size={18} /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white truncate">{selectedPerson.name || `Người #${selectedPerson.id}`}</h2>
                <button onClick={() => { setRenaming(selectedPerson.id); setRenameValue(selectedPerson.name || ""); }} className="p-1 text-gray-400 hover:text-indigo-600"><Pencil size={16} /></button>
              </div>
            )}
            <p className="text-sm text-gray-500">{selectedPerson.face_count} ảnh</p>
          </div>
          <button onClick={createMemory} disabled={creatingMemory || personMedia.length < 2} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2">
            <Sparkles size={18} /> {creatingMemory ? "Đang tạo..." : "Tạo Memories"}
          </button>
          <button onClick={() => deleteCluster(selectedPerson.id)} className="p-2 text-gray-400 hover:text-red-500" title="Xóa nhóm"><Trash2 size={18} /></button>
        </div>

        {loadingMedia ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 className="animate-spin" size={40} /></div>
        ) : personMedia.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-500">Chưa có ảnh</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 auto-rows-[200px]">
            {personMedia.map((item) => (
              <div key={item.id + item.face_index} onClick={() => setSelectedMedia(item)} className="group relative rounded-2xl overflow-hidden cursor-pointer bg-gray-100 dark:bg-gray-800">
                <img src={`/api/media/${item.id}/thumbnail?size=300`} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" loading="lazy" />
                {item.mime_type?.startsWith("video/") && <div className="absolute top-2 right-2 px-2 py-0.5 bg-black/60 text-white text-xs rounded">▶ Video</div>}
                <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                  <p className="text-white text-xs truncate">{item.name}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {selectedMedia && <MediaDetailModal media={selectedMedia} onClose={() => setSelectedMedia(null)} onDelete={(id: number) => setPersonMedia(personMedia.filter(m => m.id !== id))} />}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2"><Users size={24} /> People</h2>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
            Tự động nhận diện khuôn mặt <span className="flex h-2 w-2 relative"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span></span><span className="text-xs text-green-600 font-medium">AI đang chạy ngầm</span>
          </p>
        </div>
        <button onClick={startScan} disabled={scanning} className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors flex items-center gap-2">
          {scanning ? <Loader2 className="animate-spin" size={16} /> : <Sparkles size={16} />} {scanning ? "Đang quét..." : "Quét ngay"}
        </button>
      </div>

      {(scanning || scanStatus.running) && scanStatus.total > 0 && (
        <div className="mb-6 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl">
          <div className="flex justify-between text-sm text-gray-700 dark:text-gray-300 mb-2"><span>Đang xử lý: {scanStatus.current || "..."}</span><span>{scanStatus.done} / {scanStatus.total}</span></div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden"><div className="h-full bg-indigo-600 transition-all" style={{ width: `${(scanStatus.done / scanStatus.total) * 100}%` }} /></div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin" size={40} /></div>
      ) : people.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <Users size={64} className="mx-auto mb-4 opacity-30" />
          <p>Chưa có người nào được nhận diện.</p>
          <p className="text-sm mt-2">Hệ thống đang tự động quét ngầm, vui lòng đợi trong giây lát...</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
          {people.map((p) => (
            <div key={p.id} onClick={() => openPerson(p)} className="cursor-pointer group flex flex-col items-center">
              <div className="w-full aspect-square rounded-full overflow-hidden ring-2 ring-transparent group-hover:ring-indigo-500 transition-all bg-gray-100 dark:bg-gray-800">
                {p.cover_face_id ? <img src={`/api/faces/thumbnail/${p.cover_face_id}`} className="w-full h-full object-cover" loading="lazy" /> : <div className="w-full h-full flex items-center justify-center"><Users size={32} className="text-gray-400" /></div>}
              </div>
              <p className="mt-2 text-sm font-medium text-gray-900 dark:text-white text-center truncate w-full">{p.name || `Người #${p.id}`}</p>
              <p className="text-xs text-gray-500">{p.face_count} ảnh</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}