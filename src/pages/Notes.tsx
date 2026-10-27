import React, { useState, useEffect } from "react";
import { Plus, Trash2, StickyNote } from "lucide-react";

interface Note {
  id: number;
  title: string;
  content: string;
  color: string;
  created_at: string;
}

const COLORS = [
  { name: 'White', class: 'bg-white dark:bg-gray-800' },
  { name: 'Yellow', class: 'bg-yellow-100 dark:bg-yellow-900/30' },
  { name: 'Blue', class: 'bg-blue-100 dark:bg-blue-900/30' },
  { name: 'Green', class: 'bg-green-100 dark:bg-green-900/30' },
  { name: 'Red', class: 'bg-red-100 dark:bg-red-900/30' },
  { name: 'Purple', class: 'bg-purple-100 dark:bg-purple-900/30' },
];

export default function Notes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [selectedColor, setSelectedColor] = useState(COLORS[0].class);
  const [loading, setLoading] = useState(true);
  const [editingNote, setEditingNote] = useState<Note | null>(null);

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const res = await fetch("/api/notes");
      const data = await res.json();
      setNotes(data);
    } catch (error) {
      console.error("Failed to fetch notes", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      if (editingNote) {
        const res = await fetch(`/api/notes/${editingNote.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, content, color: selectedColor }),
        });
        if (res.ok) {
          setEditingNote(null);
          setTitle("");
          setContent("");
          fetchNotes();
        }
      } else {
        const res = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, content, color: selectedColor }),
        });
        if (res.ok) {
          setTitle("");
          setContent("");
          fetchNotes();
        }
      }
    } catch (error) {
      console.error("Failed to save note", error);
    }
  };

  const handleEditNote = (note: Note) => {
    setEditingNote(note);
    setTitle(note.title);
    setContent(note.content);
    setSelectedColor(note.color);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingNote(null);
    setTitle("");
    setContent("");
    setSelectedColor(COLORS[0].class);
  };

  const handleDeleteNote = async (id: number) => {
    try {
      const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
      if (res.ok) {
        setNotes(notes.filter(n => n.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete note", error);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <StickyNote className="text-indigo-600" size={32} />
          Ghi chú
        </h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 mb-8">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold dark:text-white">
              {editingNote ? "Sửa ghi chú" : "Thêm ghi chú mới"}
            </h2>
            {editingNote && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="text-sm text-gray-500 hover:text-indigo-600"
              >
                Hủy sửa
              </button>
            )}
          </div>
          <input
            id="note-title-input"
            type="text"
            placeholder="Tiêu đề..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full text-xl font-semibold bg-transparent border-none focus:ring-0 placeholder-gray-400 dark:text-white"
          />
          <textarea
            placeholder="Nội dung ghi chú..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            className="w-full bg-transparent border-none focus:ring-0 placeholder-gray-400 dark:text-gray-300 resize-none"
          />
          
          <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800">
            <div className="flex gap-2">
              {COLORS.map((color) => (
                <button
                  key={color.name}
                  type="button"
                  onClick={() => setSelectedColor(color.class)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${color.class} ${
                    selectedColor === color.class ? "border-indigo-600 scale-110" : "border-transparent"
                  }`}
                  title={color.name}
                />
              ))}
            </div>
            <button
              type="submit"
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-medium transition-colors"
            >
              {editingNote ? <Plus size={20} className="rotate-45" /> : <Plus size={20} />}
              {editingNote ? "Cập nhật" : "Lưu ghi chú"}
            </button>
          </div>
        </div>
      </form>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {notes.map((note) => (
            <div
              key={note.id}
              className={`p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 transition-all hover:shadow-md group ${note.color}`}
            >
              <div className="flex justify-between items-start mb-4">
                <h3 className="font-bold text-lg text-gray-900 dark:text-white break-words">{note.title}</h3>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => handleEditNote(note)}
                    className="p-2 text-gray-400 hover:text-indigo-600"
                    title="Sửa"
                  >
                    <Plus size={18} className="rotate-45" />
                  </button>
                  <button
                    onClick={() => handleDeleteNote(note.id)}
                    className="p-2 text-gray-400 hover:text-red-500"
                    title="Xóa"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">{note.content}</p>
              <div className="mt-4 pt-4 border-t border-black/5 dark:border-white/5">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {new Date(note.created_at).toLocaleDateString('vi-VN')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
