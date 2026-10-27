// src/pages/DriveFolder.tsx
import { useState, useEffect, useRef } from "react";
import {
  Image as ImageIcon,
  AlertCircle,
  Folder,
  ChevronRight,
  ArrowLeft,
  X,
  Trash2,
  FolderPlus,
  Pencil,
  Check,
  Eye,
  Square,
} from "lucide-react";
import DriveDetailModal from "../components/DriveDetailModal";

interface FolderConfig {
  id: string;
  name: string;
}

interface GroupFolder {
  id: string;
  name: string;
  folderIds: string[];
}

// Danh sách các folder có sẵn (bạn có thể thêm/sửa tại đây)
const FOLDERS: FolderConfig[] = [
  { id: "13enGRTtD9dWl94opp1pkc81EIQGwZcB8", name: "Kỷ Yếu" },
  { id: "1iMFWdY2S62A7s6Gpo7-dQuxpoBGch8_0", name: "Giáng Sinh" },
  { id: "1j1AtT6QNCgBcogacMHji5sQLsEdPKVpz", name: "Kỷ Yếu" },
  { id: "1qtQpy-E6-p72DB38-hjRMS9xmCQ6P5X1", name: "Kỷ Yếu" },
  { id: "17sEGxJgyIws3Hfg6ur_qvGY86kb1GoLd", name: "Kỷ Yếu" },
];

const STORAGE_KEY = "drive_groups";

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

// Hàm sắp xếp mảng ảnh theo tên (không phân biệt chữ hoa/thường)
const sortImagesByName = (images: any[]) => {
  return images.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
};

export default function DriveFolder() {
  const isMobile = useIsMobile();

  // ---------- State ----------
  const [groups, setGroups] = useState<GroupFolder[]>([]);

  // View states
  const [selectedFolder, setSelectedFolder] = useState<FolderConfig | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<GroupFolder | null>(null);
  const [folderInGroup, setFolderInGroup] = useState<FolderConfig | null>(null);

  // Selection mode (for merging) – dùng cho cả root và bên trong group
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedFolderIds, setSelectedFolderIds] = useState<Set<string>>(new Set());

  // Merged view (tạm thời gộp để xem tất cả ảnh)
  const [isMergedView, setIsMergedView] = useState(false);
  const [mergedImages, setMergedImages] = useState<any[]>([]);
  const [mergedFolderName, setMergedFolderName] = useState("");
  const [mergedFromGroup, setMergedFromGroup] = useState<GroupFolder | null>(null);

  // Image data
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedMedia, setSelectedMedia] = useState<any>(null);

  // Modal state
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState("");
  const [selectedGroupFolderIds, setSelectedGroupFolderIds] = useState<Set<string>>(new Set());

  // Refs for long press (chỉ dùng trên PC)
  const pressTimer = useRef<NodeJS.Timeout | null>(null);
  const isLongPress = useRef(false);

  // ---------- Load / Save groups (localStorage) ----------
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsedGroups = JSON.parse(stored);
        // Kiểm tra an toàn: Dữ liệu phải là một mảng
        if (Array.isArray(parsedGroups)) {
          setGroups(parsedGroups);
        } else {
          throw new Error("Dữ liệu không phải là mảng");
        }
      } catch (e) {
        console.warn("Dữ liệu groups bị lỗi hoặc hỏng, tự động xóa để làm mới.", e);
        localStorage.removeItem(STORAGE_KEY); // Dọn dẹp rác
        setGroups([]);
      }
    }
  }, []);

  const saveGroups = (newGroups: GroupFolder[]) => {
    setGroups(newGroups);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newGroups));
  };

  // ---------- Fetch images ----------
  const fetchImages = async (folderId: string): Promise<any[]> => {
    try {
      const res = await fetch(`/api/drive/files?folderId=${folderId}`);
      if (res.ok) {
        const data = await res.json();
        return data;
      } else {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "Lỗi không xác định từ máy chủ.");
      }
    } catch (error: any) {
      throw new Error(error.message || "Lỗi kết nối đến máy chủ.");
    }
  };

  const loadFolderImages = async (folder: FolderConfig) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchImages(folder.id);
      sortImagesByName(data);
      setImages(data);
    } catch (error: any) {
      setErrorMsg(error.message);
      setImages([]);
    } finally {
      setLoading(false);
    }
  };

  const loadMergedImages = async (folderIds: string[], name: string, fromGroup?: GroupFolder | null) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const allResults = await Promise.all(folderIds.map((id) => fetchImages(id)));
      const flattened = allResults.flat();
      // Lọc các ảnh bị trùng ID
      const unique = flattened.filter(
        (img, index, self) => index === self.findIndex((i) => i.id === img.id)
      );
      sortImagesByName(unique);
      setMergedImages(unique);
      setMergedFolderName(name);
      setIsMergedView(true);
      setSelectedFolder(null);
      setSelectedGroup(null);
      setFolderInGroup(null);
      setMergedFromGroup(fromGroup || null);
    } catch (error: any) {
      setErrorMsg(error.message);
      setMergedImages([]);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Navigation ----------
  const goToRoot = () => {
    if (isMergedView && mergedFromGroup) {
      setSelectedGroup(mergedFromGroup);
      setIsMergedView(false);
      setMergedImages([]);
      setMergedFolderName("");
      setMergedFromGroup(null);
      setErrorMsg(null);
      setSelectionMode(false);
      setSelectedFolderIds(new Set());
      return;
    }
    setSelectedFolder(null);
    setSelectedGroup(null);
    setFolderInGroup(null);
    setIsMergedView(false);
    setMergedImages([]);
    setMergedFolderName("");
    setMergedFromGroup(null);
    setSelectionMode(false);
    setSelectedFolderIds(new Set());
    setImages([]);
    setErrorMsg(null);
  };

  const goBackToGroup = () => {
    setFolderInGroup(null);
    setImages([]);
    setErrorMsg(null);
    setSelectionMode(false);
    setSelectedFolderIds(new Set());
  };

  const handleFolderClick = (folder: FolderConfig) => {
    if (!selectedGroup) {
      if (selectionMode) {
        toggleSelectFolder(folder.id);
        return;
      }
      setSelectedFolder(folder);
      loadFolderImages(folder);
    } else {
      if (selectionMode) {
        toggleSelectFolder(folder.id);
        return;
      }
      setFolderInGroup(folder);
      loadFolderImages(folder);
    }
  };

  const handleGroupClick = (group: GroupFolder) => {
    if (selectionMode) return;
    setSelectedGroup(group);
    setSelectedFolder(null);
    setFolderInGroup(null);
    setImages([]);
    setErrorMsg(null);
    setSelectionMode(false);
    setSelectedFolderIds(new Set());
  };

  // ---------- Selection Mode ----------
  const toggleSelectFolder = (id: string) => {
    const newSelected = new Set(selectedFolderIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedFolderIds(newSelected);
  };

  const cancelSelection = () => {
    setSelectionMode(false);
    setSelectedFolderIds(new Set());
  };

  // Long press chỉ dành cho PC
  const handleMouseDown = (e: React.MouseEvent, id: string) => {
    if (isMobile) return;
    isLongPress.current = false;
    pressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      if (!selectionMode) {
        setSelectionMode(true);
        setSelectedFolderIds(new Set([id]));
      } else {
        toggleSelectFolder(id);
      }
    }, 1000);
  };

  const handleMouseUp = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
    isLongPress.current = false;
  };

  // Trên mobile: click/tap để toggle khi đang ở chế độ chọn
  const handleFolderClickMobile = (folder: FolderConfig) => {
    if (isMobile && selectionMode) {
      toggleSelectFolder(folder.id);
      return;
    }
    handleFolderClick(folder);
  };

  const handleMerge = async () => {
    const ids = Array.from(selectedFolderIds);
    if (ids.length < 2) return;
    const names = ids.map((id) => FOLDERS.find((f) => f.id === id)?.name || id);
    const mergedName = `Gộp: ${names.join(", ")}`;
    await loadMergedImages(ids, mergedName, selectedGroup);
    setSelectionMode(false);
    setSelectedFolderIds(new Set());
  };

  // ---------- Group CRUD (localStorage) ----------
  const openCreateGroupModal = () => {
    setEditingGroupId(null);
    setGroupName("");
    setSelectedGroupFolderIds(new Set(selectedFolderIds));
    setShowGroupModal(true);
  };

  const openEditGroupModal = (group: GroupFolder, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingGroupId(group.id);
    setGroupName(group.name);
    setSelectedGroupFolderIds(new Set(group.folderIds));
    setShowGroupModal(true);
  };

  const deleteGroup = (groupId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newGroups = groups.filter((g) => g.id !== groupId);
    saveGroups(newGroups);
    if (selectedGroup?.id === groupId) goToRoot();
  };

  const saveGroup = () => {
    if (!groupName.trim() || selectedGroupFolderIds.size < 2) return;

    if (editingGroupId) {
      const updatedGroups = groups.map((g) =>
        g.id === editingGroupId
          ? { ...g, name: groupName.trim(), folderIds: Array.from(selectedGroupFolderIds) }
          : g
      );
      saveGroups(updatedGroups);
      if (selectedGroup?.id === editingGroupId) {
        const updatedGroup = updatedGroups.find((g) => g.id === editingGroupId);
        if (updatedGroup) setSelectedGroup(updatedGroup);
      }
    } else {
      const newGroup: GroupFolder = {
        id: `group_${Date.now()}`,
        name: groupName.trim(),
        folderIds: Array.from(selectedGroupFolderIds),
      };
      saveGroups([...groups, newGroup]);
    }

    setShowGroupModal(false);
    setEditingGroupId(null);
    setGroupName("");
    setSelectedGroupFolderIds(new Set());
    setSelectionMode(false);
    setSelectedFolderIds(new Set());
  };

  const toggleGroupFolderSelection = (folderId: string) => {
    const newSet = new Set(selectedGroupFolderIds);
    if (newSet.has(folderId)) newSet.delete(folderId);
    else newSet.add(folderId);
    setSelectedGroupFolderIds(newSet);
  };

  // ---------- Helper functions ----------
  const getAvailableFolders = (): FolderConfig[] => {
    const assignedFolderIds = new Set<string>();
    groups.forEach((group) => group.folderIds.forEach((id) => assignedFolderIds.add(id)));
    return FOLDERS.filter((folder) => !assignedFolderIds.has(folder.id));
  };

  const getGroupFolders = (group: GroupFolder): FolderConfig[] => {
    return FOLDERS.filter((folder) => group.folderIds.includes(folder.id));
  };

  // ---------- Render ----------

  // View: merged images
  if (isMergedView) {
    return (
      <div className="h-full flex flex-col">
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={goToRoot}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Quay lại"
          >
            <ArrowLeft size={24} className="text-gray-600 dark:text-gray-400" />
          </button>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white truncate">{mergedFolderName}</h2>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : errorMsg ? (
          <div className="flex-1 flex flex-col items-center justify-center text-red-500">
            <AlertCircle size={48} className="mb-4" />
            <h3 className="text-xl font-medium mb-2">Đã xảy ra lỗi</h3>
            <p className="text-center max-w-md">{errorMsg}</p>
            <button onClick={goToRoot} className="mt-4 text-indigo-600 dark:text-indigo-400 hover:underline">
              Quay lại
            </button>
          </div>
        ) : mergedImages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="w-24 h-24 mb-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <ImageIcon size={40} className="text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">Không có ảnh</h3>
            <p className="text-center">Không có ảnh nào.</p>
            <button onClick={goToRoot} className="mt-4 text-indigo-600 dark:text-indigo-400 hover:underline">
              Quay lại
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">Tổng số: {mergedImages.length} ảnh</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 auto-rows-[200px]">
              {mergedImages.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedMedia(item)}
                  className="group relative rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer"
                >
                  <img
                    src={`/api/drive/stream/${item.id}?thumbnail=true`}
                    alt={item.name}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      e.currentTarget.src =
                        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="gray" stroke-width="2"%3E%3Crect x="2" y="6" width="20" height="12" rx="2"/%3E%3Cpolygon points="10 6 10 18 18 12 10 6"/%3E%3C/svg%3E';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-4 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <p className="text-white font-medium truncate text-sm">{item.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {selectedMedia && <DriveDetailModal media={selectedMedia} onClose={() => setSelectedMedia(null)} />}
      </div>
    );
  }

  // View: single folder (independent or sub-folder)
  if (selectedFolder || folderInGroup) {
    const currentFolder = selectedFolder || folderInGroup;
    const title = currentFolder?.name || "";
    const isSubFolder = !!folderInGroup;

    return (
      <div className="h-full flex flex-col">
        <div className="mb-6 flex items-center gap-4">
          <button
            onClick={() => {
              if (isSubFolder) goBackToGroup();
              else goToRoot();
            }}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            aria-label="Quay lại"
          >
            <ArrowLeft size={24} className="text-gray-600 dark:text-gray-400" />
          </button>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{title}</h2>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        ) : errorMsg ? (
          <div className="flex-1 flex flex-col items-center justify-center text-red-500">
            <AlertCircle size={48} className="mb-4" />
            <h3 className="text-xl font-medium mb-2">Đã xảy ra lỗi</h3>
            <p className="text-center max-w-md">{errorMsg}</p>
            <button
              onClick={() => {
                if (currentFolder) loadFolderImages(currentFolder);
              }}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Thử lại
            </button>
          </div>
        ) : images.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="w-24 h-24 mb-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <ImageIcon size={40} className="text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">Không có ảnh</h3>
            <p className="text-center">Không có ảnh nào trong folder này.</p>
            <button
              onClick={() => {
                if (isSubFolder) goBackToGroup();
                else goToRoot();
              }}
              className="mt-4 text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Quay lại
            </button>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">Tổng số: {images.length} ảnh</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 auto-rows-[200px]">
              {images.map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedMedia(item)}
                  className="group relative rounded-2xl overflow-hidden bg-gray-100 dark:bg-gray-800 shadow-sm hover:shadow-md transition-all duration-300 cursor-pointer"
                >
                  <img
                    src={`/api/drive/stream/${item.id}?thumbnail=true`}
                    alt={item.name}
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      e.currentTarget.src =
                        'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 24 24" fill="none" stroke="gray" stroke-width="2"%3E%3Crect x="2" y="6" width="20" height="12" rx="2"/%3E%3Cpolygon points="10 6 10 18 18 12 10 6"/%3E%3C/svg%3E';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                  <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-4 group-hover:translate-y-0 opacity-0 group-hover:opacity-100 transition-all duration-300">
                    <p className="text-white font-medium truncate text-sm">{item.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
        {selectedMedia && <DriveDetailModal media={selectedMedia} onClose={() => setSelectedMedia(null)} />}
      </div>
    );
  }

  // View: group content (list of sub-folders) – có hỗ trợ chọn folder con
  if (selectedGroup) {
    const subFolders = getGroupFolders(selectedGroup);
    const selectedCount = selectedFolderIds.size;

    return (
      <div className="h-full flex flex-col">
        <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={goToRoot}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              aria-label="Quay lại danh sách folder"
            >
              <ArrowLeft size={24} className="text-gray-600 dark:text-gray-400" />
            </button>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white truncate">{selectedGroup.name}</h2>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {selectionMode ? (
              <>
                <button
                  onClick={cancelSelection}
                  className={`p-2.5 rounded-xl font-medium transition-colors flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white`}
                  title="Hủy chọn"
                >
                  <X size={18} />
                  {!isMobile && "Hủy chọn"}
                </button>
                
                {selectedCount >= 2 && (
                  <>
                    <button
                      onClick={handleMerge}
                      className={`p-2.5 rounded-xl font-medium transition-colors flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white`}
                      title="Xem tất cả"
                    >
                      <Eye size={18} />
                      {!isMobile && `Xem tất cả (${selectedCount})`}
                    </button>
                    
                    <button
                      onClick={openCreateGroupModal}
                      className={`p-2.5 rounded-xl font-medium transition-colors flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white`}
                      title="Tạo folder"
                    >
                      <FolderPlus size={18} />
                      {!isMobile && "Tạo folder"}
                    </button>
                  </>
                )}
              </>
            ) : (
              <>
                {!isMobile && (
                  <button
                    onClick={openCreateGroupModal}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                  >
                    <FolderPlus size={18} />
                    Tạo folder
                  </button>
                )}
                <button
                  onClick={() => setSelectionMode(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                >
                  <Square size={18} />
                  Chọn
                </button>
              </>
            )}
          </div>
        </div>

        <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
          {selectionMode ? (
            <span>Đã chọn {selectedCount} folder</span>
          ) : (
            <span></span>
          )}
        </div>

        {subFolders.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
            <div className="w-24 h-24 mb-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <Folder size={40} className="text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">Folder trống</h3>
            <p className="text-center">Group này không chứa folder con nào.</p>
            <button onClick={goToRoot} className="mt-4 text-indigo-600 dark:text-indigo-400 hover:underline">
              Quay lại
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {subFolders.map((folder) => {
              const isSelected = selectionMode && selectedFolderIds.has(folder.id);
              return (
                <div
                  key={folder.id}
                  onMouseDown={(e) => handleMouseDown(e, folder.id)}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onClick={() => handleFolderClickMobile(folder)}
                  className={`group relative rounded-2xl overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-1 ${
                    isSelected ? "ring-4 ring-indigo-300 dark:ring-indigo-400" : ""
                  }`}
                >
                  {selectionMode && (
                    <div className="absolute top-2 right-2 z-10">
                      <div
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                          isSelected
                            ? "bg-indigo-600 border-indigo-600 text-white"
                            : "bg-white/30 border-white"
                        }`}
                      >
                        {isSelected && <Check size={14} />}
                      </div>
                    </div>
                  )}
                  <div className="p-6 flex flex-col items-center justify-center min-h-[200px]">
                    <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                      <Folder size={40} className="text-white" />
                    </div>
                    <h3 className="text-white font-semibold text-lg text-center mb-2 truncate w-full px-2">{folder.name}</h3>
                    <div className="flex items-center text-white/80 text-sm">
                      <span>Xem ảnh</span>
                      <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ---------- ROOT VIEW: danh sách folder độc lập + group ----------
  const availableFolders = getAvailableFolders();
  const selectedCount = selectedFolderIds.size;

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Folders</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {selectionMode ? (
            <>
              <button
                onClick={cancelSelection}
                className={`p-2.5 rounded-xl font-medium transition-colors flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white`}
                title="Hủy chọn"
              >
                <X size={18} />
                {!isMobile && "Hủy chọn"}
              </button>
              
              {selectedCount >= 2 && (
                <>
                  <button
                    onClick={handleMerge}
                    className={`p-2.5 rounded-xl font-medium transition-colors flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white`}
                    title="Xem tất cả"
                  >
                    <Eye size={18} />
                    {!isMobile && `Xem tất cả (${selectedCount})`}
                  </button>
                  
                  <button
                    onClick={openCreateGroupModal}
                    className={`p-2.5 rounded-xl font-medium transition-colors flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white`}
                    title="Tạo folder"
                  >
                    <FolderPlus size={18} />
                    {!isMobile && "Tạo folder"}
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              {!isMobile && (
                <button
                  onClick={openCreateGroupModal}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                >
                  <FolderPlus size={18} />
                  Tạo folder
                </button>
              )}
              <button
                onClick={() => setSelectionMode(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
              >
                <Square size={18} />
                Chọn
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        {selectionMode ? (
          <span>Đã chọn {selectedCount} folder</span>
        ) : (
          <span></span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* Folder độc lập */}
        {availableFolders.map((folder) => {
          const isSelected = selectionMode && selectedFolderIds.has(folder.id);
          return (
            <div
              key={`folder-${folder.id}`}
              onMouseDown={(e) => handleMouseDown(e, folder.id)}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
              onClick={() => handleFolderClickMobile(folder)}
              className={`group relative rounded-2xl overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-1 ${
                isSelected ? "ring-4 ring-indigo-300 dark:ring-indigo-400" : ""
              }`}
            >
              {selectionMode && (
                <div className="absolute top-2 right-2 z-10">
                  <div
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      isSelected
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "bg-white/30 border-white"
                    }`}
                  >
                    {isSelected && <Check size={14} />}
                  </div>
                </div>
              )}
              <div className="p-6 flex flex-col items-center justify-center min-h-[200px]">
                <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Folder size={40} className="text-white" />
                </div>
                <h3 className="text-white font-semibold text-lg text-center mb-2 truncate w-full px-2">{folder.name}</h3>
                <div className="flex items-center text-white/80 text-sm">
                  <span>Xem ảnh</span>
                  <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            </div>
          );
        })}

        {/* Group folder */}
        {groups.map((group) => (
          <div
            key={`group-${group.id}`}
            onClick={() => handleGroupClick(group)}
            className="group relative rounded-2xl overflow-hidden bg-gradient-to-br from-purple-500 to-pink-600 shadow-lg hover:shadow-xl transition-all duration-300 cursor-pointer transform hover:-translate-y-1"
          >
            <div className="p-6 flex flex-col items-center justify-center min-h-[200px]">
              <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <FolderPlus size={40} className="text-white" />
              </div>
              <h3 className="text-white font-semibold text-lg text-center mb-2 truncate w-full px-2">{group.name}</h3>
              <div className="flex items-center text-white/80 text-sm gap-2">
                <span>{group.folderIds.length} folder</span>
                <button
                  onClick={(e) => openEditGroupModal(group, e)}
                  className="p-1 text-white/60 hover:text-white transition-colors"
                  title="Sửa"
                >
                  <Pencil size={16} />
                </button>
                <button
                  onClick={(e) => deleteGroup(group.id, e)}
                  className="p-1 text-white/60 hover:text-red-300 transition-colors"
                  title="Xóa nhóm"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Modal tạo/sửa group */}
      {showGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                {editingGroupId ? "Sửa folder " : "Tạo folder "}
              </h3>
              <button
                onClick={() => {
                  setShowGroupModal(false);
                  setEditingGroupId(null);
                  setGroupName("");
                  setSelectedGroupFolderIds(new Set());
                }}
                className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
              >
                <X size={24} />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tên folder</label>
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder="Nhập tên..."
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Chọn folder</label>
                <div className="max-h-48 overflow-y-auto space-y-2 pr-2">
                  {FOLDERS.map((folder) => {
                    const isInAnyGroup = groups.some((g) => g.folderIds.includes(folder.id));
                    const isInCurrentGroup = editingGroupId
                      ? groups.find((g) => g.id === editingGroupId)?.folderIds.includes(folder.id)
                      : false;
                    const disabled = !editingGroupId ? isInAnyGroup : isInAnyGroup && !isInCurrentGroup;
                    const checked = selectedGroupFolderIds.has(folder.id);
                    return (
                      <label
                        key={folder.id}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer ${
                          disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-100 dark:hover:bg-gray-800"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggleGroupFolderSelection(folder.id)}
                          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-gray-700 dark:text-gray-300 truncate">{folder.name}</span>
                        {isInAnyGroup && !isInCurrentGroup && (
                          <span className="text-xs text-red-400 ml-auto shrink-0">(Đã ở nhóm khác)</span>
                        )}
                      </label>
                    );
                  })}
                </div>
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">Đã chọn {selectedGroupFolderIds.size} folder</p>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3 bg-gray-50 dark:bg-gray-900/50">
              <button
                onClick={() => {
                  setShowGroupModal(false);
                  setEditingGroupId(null);
                  setGroupName("");
                  setSelectedGroupFolderIds(new Set());
                }}
                className="px-5 py-2.5 rounded-xl font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={saveGroup}
                disabled={!groupName.trim() || selectedGroupFolderIds.size < 2}
                className="px-5 py-2.5 rounded-xl font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editingGroupId ? "Cập nhật" : "Tạo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}