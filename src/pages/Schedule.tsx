import React, { useState, useEffect } from "react";
import { Calendar, Clock, MapPin, Plus, Trash2, Bell } from "lucide-react";

interface ScheduleItem {
  id: number;
  subject: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  room: string;
}

const DAYS = [
  "Chủ Nhật", "Thứ Hai", "Thứ Ba", "Thứ Tư", "Thứ Năm", "Thứ Sáu", "Thứ Bảy"
];

const CountdownTimer = () => {
  const targetDate = new Date("2026-06-10T00:00:00").getTime();  {/* Ngày mà muốn đặt */}
  const [timeLeft, setTimeLeft] = useState(targetDate - Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(targetDate - Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  if (timeLeft <= 0) {
    return (
      <div className="bg-indigo-600 text-white p-8 rounded-3xl shadow-xl mb-8 text-center">
        <h2 className="text-2xl font-bold italic serif">Sự kiện đã bắt đầu!</h2>
      </div>
    );
  }

  const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
  const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

  return (
    <div className="bg-gradient-to-br from-indigo-600 to-violet-700 text-white p-6 md:p-10 rounded-[2rem] shadow-2xl mb-12 relative overflow-hidden group">
      <div className="absolute -top-10 -right-10 opacity-10 group-hover:scale-110 transition-transform duration-700">
        <Clock size={240} />
      </div>
      
      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-8">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <h2 className="text-sm md:text-base font-bold uppercase tracking-[0.2em] opacity-80">
            CHỈ CÒN
          </h2>
        </div>

        <div className="grid grid-cols-4 gap-2 md:gap-6">
          {[
            { label: "Ngày", value: days },
            { label: "Giờ", value: hours },
            { label: "Phút", value: minutes },
            { label: "Giây", value: seconds },
          ].map((item, idx) => (
            <div key={item.label} className="flex flex-col items-center bg-white/10 backdrop-blur-md rounded-2xl md:rounded-3xl p-4 md:p-6 border border-white/10">
              <span className="text-3xl md:text-7xl font-black tracking-tighter tabular-nums">
                {item.value.toString().padStart(2, '0')}
              </span>
              <div className="h-px w-8 bg-white/20 my-2 md:my-4" />
              <span className="text-[10px] md:text-xs uppercase font-black tracking-widest opacity-60">
                {item.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default function Schedule() {
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [subject, setSubject] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState("08:00");
  const [endTime, setEndTime] = useState("09:30");
  const [room, setRoom] = useState("");
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null);

  useEffect(() => {
    fetchSchedule();
  }, []);

  const fetchSchedule = async () => {
    try {
      const res = await fetch("/api/schedule");
      const data = await res.json();
      setSchedule(data);
    } catch (error) {
      console.error("Failed to fetch schedule", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) return;

    try {
      if (editingItem) {
        const res = await fetch(`/api/schedule/${editingItem.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject, day_of_week: dayOfWeek, start_time: startTime, end_time: endTime, room }),
        });
        if (res.ok) {
          setEditingItem(null);
          setSubject("");
          setRoom("");
          fetchSchedule();
        }
      } else {
        const res = await fetch("/api/schedule", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subject, day_of_week: dayOfWeek, start_time: startTime, end_time: endTime, room }),
        });
        if (res.ok) {
          setSubject("");
          setRoom("");
          fetchSchedule();
        }
      }
    } catch (error) {
      console.error("Failed to save schedule", error);
    }
  };

  const handleEditItem = (item: ScheduleItem) => {
    setEditingItem(item);
    setSubject(item.subject);
    setDayOfWeek(item.day_of_week);
    setStartTime(item.start_time);
    setEndTime(item.end_time);
    setRoom(item.room || "");
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingItem(null);
    setSubject("");
    setDayOfWeek(1);
    setStartTime("08:00");
    setEndTime("09:30");
    setRoom("");
  };

  const handleDeleteSchedule = async (id: number) => {
    try {
      const res = await fetch(`/api/schedule/${id}`, { method: "DELETE" });
      if (res.ok) {
        setSchedule(schedule.filter(s => s.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete schedule", error);
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <CountdownTimer />
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <Calendar className="text-indigo-600" size={32} />
          Thời khóa biểu
        </h1>
      </div>

      {/* Phần hiển thị ngắn gọn dưới dạng thời khóa biểu */}
      {!loading && schedule.length > 0 && (
        <div className="mb-12 overflow-x-auto">
          <div className="min-w-[800px] bg-white dark:bg-gray-900 rounded-3xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="grid grid-cols-7 border-b border-gray-200 dark:border-gray-800 bg-indigo-600">
              {[1, 2, 3, 4, 5, 6, 0].map((dayIndex) => (
                <div key={dayIndex} className="py-3 text-center text-white font-bold text-sm uppercase tracking-wider">
                  {DAYS[dayIndex]}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 divide-x divide-gray-200 dark:divide-gray-800">
              {[1, 2, 3, 4, 5, 6, 0].map((dayIndex) => {
                const dayItems = schedule
                  .filter(item => item.day_of_week === dayIndex)
                  .sort((a, b) => a.start_time.localeCompare(b.start_time));
                
                return (
                  <div key={dayIndex} className="min-h-[150px] p-2 space-y-2 bg-gray-50/50 dark:bg-gray-800/20">
                    {dayItems.map((item) => (
                      <div 
                        key={item.id} 
                        className="p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-100 dark:border-gray-700 shadow-sm group relative"
                      >
                        <button
                          onClick={() => handleEditItem(item)}
                          className="absolute top-1 right-1 p-1 text-gray-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Sửa"
                        >
                          <Plus size={12} className="rotate-45" />
                        </button>
                        <div className="text-xs font-bold text-indigo-600 dark:text-indigo-400 mb-1">
                          {item.start_time}
                        </div>
                        <div className="text-xs font-medium text-gray-900 dark:text-white line-clamp-2">
                          {item.subject}
                        </div>
                        {item.room && (
                          <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 truncate">
                            P: {item.room}
                          </div>
                        )}
                      </div>
                    ))}
                    {dayItems.length === 0 && (
                      <div className="h-full flex items-center justify-center opacity-20">
                        <Calendar size={24} className="text-gray-400" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 sticky top-8">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold dark:text-white">
                {editingItem ? "Sửa môn học" : "Thêm môn học"}
              </h2>
              {editingItem && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="text-sm text-gray-500 hover:text-indigo-600"
                >
                  Hủy sửa
                </button>
              )}
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tên môn học</label>
                <input
                  id="schedule-subject-input"
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder="Ví dụ: Toán"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Thứ</label>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(parseInt(e.target.value))}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                >
                  {DAYS.map((day, index) => (
                    <option key={index} value={index}>{day}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Bắt đầu</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kết thúc</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Phòng học</label>
                <input
                  type="text"
                  value={room}
                  onChange={(e) => setRoom(e.target.value)}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  placeholder=""
                />
              </div>

              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold transition-colors mt-4 flex items-center justify-center gap-2"
              >
                {editingItem ? <Plus size={20} className="rotate-45" /> : <Plus size={20} />}
                {editingItem ? "Cập nhật lịch" : "Thêm vào lịch"}
              </button>
            </div>
          </form>
        </div>

        {/* Danh sách thời khóa biểu */}
        <div className="lg:col-span-2">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <div className="space-y-8">
              {DAYS.map((dayName, dayIndex) => {
                const dayItems = schedule.filter(item => item.day_of_week === dayIndex);
                if (dayItems.length === 0) return null;

                return (
                  <div key={dayIndex} className="space-y-4">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white border-l-4 border-indigo-600 pl-4">
                      {dayName}
                    </h3>
                    <div className="grid gap-4">
                      {dayItems.map((item) => (
                        <div
                          key={item.id}
                          className="bg-white dark:bg-gray-900 p-5 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 flex items-center justify-between group"
                        >
                          <div className="flex items-center gap-6">
                            <div className="bg-indigo-50 dark:bg-indigo-900/30 p-3 rounded-xl">
                              <Clock className="text-indigo-600 dark:text-indigo-400" size={24} />
                            </div>
                            <div>
                              <h4 className="font-bold text-lg text-gray-900 dark:text-white">{item.subject}</h4>
                              <div className="flex items-center gap-4 mt-1 text-sm text-gray-500 dark:text-gray-400">
                                <span className="flex items-center gap-1">
                                  <Clock size={14} />
                                  {item.start_time} - {item.end_time}
                                </span>
                                {item.room && (
                                  <span className="flex items-center gap-1">
                                    <MapPin size={14} />
                                    Phòng: {item.room}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleEditItem(item)}
                              className="p-2 text-gray-400 hover:text-indigo-600"
                              title="Sửa"
                            >
                              <Plus size={20} className="rotate-45" />
                            </button>
                            <button
                              onClick={() => handleDeleteSchedule(item.id)}
                              className="p-2 text-gray-400 hover:text-red-500"
                              title="Xóa"
                            >
                              <Trash2 size={20} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              
              {schedule.length === 0 && (
                <div className="text-center py-20 bg-white dark:bg-gray-900 rounded-3xl border border-dashed border-gray-300 dark:border-gray-700">
                  <Calendar className="mx-auto text-gray-300 dark:text-gray-600 mb-4" size={64} />
                  <p className="text-gray-500 dark:text-gray-400">Chưa có môn học nào trong thời khóa biểu.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
