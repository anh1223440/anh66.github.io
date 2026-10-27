import { Link, useLocation } from "react-router-dom";
import { Sun, Moon, Image as ImageIcon, Folder, Upload, Menu, X, Plus, StickyNote, Calendar } from "lucide-react";
import { useState, useEffect } from "react";
import UploadModal from "./UploadModal";

export default function Layout({ children, darkMode, setDarkMode }: any) {
  const location = useLocation();
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { path: "/", label: "Photos", icon: ImageIcon },
    { path: "/albums", label: "Albums", icon: Folder },
    { path: "/drive", label: "Folder", icon: Upload },
    { path: "/notes", label: "Ghi chú", icon: StickyNote },
    { path: "/schedule", label: "Lịch học", icon: Calendar },
  ];

  // Notification Logic
  useEffect(() => {
    const notifiedRef = { current: new Set<string>() };

    const requestPermission = async () => {
      if (Notification.permission === "default") {
        await Notification.requestPermission();
      }
    };

    // Try to request on load (might be blocked)
    requestPermission();

    // Also request on first click to satisfy user gesture requirement
    const handleFirstClick = () => {
      requestPermission();
      window.removeEventListener('click', handleFirstClick);
    };
    window.addEventListener('click', handleFirstClick);

    const checkSchedule = async () => {
      if (Notification.permission !== "granted") return;

      try {
        const res = await fetch("/api/schedule");
        const schedule = await res.json();
        
        const now = new Date();
        const currentDay = now.getDay();
        
        // Calculate time 5 minutes from now
        const fiveMinutesLater = new Date(now.getTime() + 5 * 60000);
        const targetTime = fiveMinutesLater.getHours().toString().padStart(2, '0') + ":" + 
                           fiveMinutesLater.getMinutes().toString().padStart(2, '0');
        
        const currentTimeStr = now.getHours().toString().padStart(2, '0') + ":" + 
                               now.getMinutes().toString().padStart(2, '0');

        // Check for classes starting in 5 minutes
        const upcomingClass = schedule.find((item: any) => 
          item.day_of_week === currentDay && item.start_time === targetTime
        );

        if (upcomingClass) {
          const notificationId = `5min-${upcomingClass.id}-${targetTime}`;
          if (!notifiedRef.current.has(notificationId)) {
            new Notification("Sắp đến giờ học!", {
              body: `Còn 5 phút nữa đến môn: ${upcomingClass.subject}${upcomingClass.room ? ` - Phòng: ${upcomingClass.room}` : ""}`,
              icon: "/favicon.ico"
            });
            notifiedRef.current.add(notificationId);
          }
        }

        // Check for classes starting NOW
        const nowClass = schedule.find((item: any) => 
          item.day_of_week === currentDay && item.start_time === currentTimeStr
        );

        if (nowClass) {
          const notificationId = `now-${nowClass.id}-${currentTimeStr}`;
          if (!notifiedRef.current.has(notificationId)) {
            new Notification("Đến giờ học rồi!", {
              body: `Môn học: ${nowClass.subject}${nowClass.room ? ` - Phòng: ${nowClass.room}` : ""}`,
              icon: "/favicon.ico"
            });
            notifiedRef.current.add(notificationId);
          }
        }

        // Clean up old notifications from the set to prevent memory leak
        if (notifiedRef.current.size > 50) {
          notifiedRef.current.clear();
        }
      } catch (error) {
        console.error("Failed to check schedule for notifications", error);
      }
    };

    const interval = setInterval(checkSchedule, 30000); // Check every 30 seconds for better accuracy
    checkSchedule(); // Initial check
    return () => clearInterval(interval);
  }, []);

  const handleFloatingAction = () => {
    const path = location.pathname;
    if (path === "/" || path === "/albums" || path === "/drive") {
      setIsUploadModalOpen(true);
    } else if (path === "/notes") {
      const input = document.getElementById("note-title-input");
      if (input) {
        input.focus();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else if (path === "/schedule") {
      const input = document.getElementById("schedule-subject-input");
      if (input) {
        input.focus();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  return (
    <div className="flex h-screen overflow-hidden relative">
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 md:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside 
        className={`fixed inset-y-0 left-0 z-40 w-64 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col ${
          isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-6 flex items-center justify-end">
          <button 
            className="md:hidden p-2 -mr-2 text-gray-500 hover:text-gray-900 dark:hover:text-white"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  isActive
                    ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300"
                }`}
              >
                <Icon size={20} />
                <span className="font-medium">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={() => {
              handleFloatingAction();
              setIsMobileMenuOpen(false);
            }}
            className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-3 rounded-xl font-medium transition-colors"
          >
            <Upload size={20} />
            {location.pathname === "/notes" ? "Thêm ghi chú" : location.pathname === "/schedule" ? "Thêm lịch học" : "Upload"}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-gray-50 dark:bg-gray-950">
        <header className="h-16 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center justify-between px-4 md:px-8">
          <div className="flex items-center gap-4">
            <button 
              className="md:hidden p-2 -ml-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={24} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-full text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {darkMode ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 md:p-8">{children}</div>
      </main>

      {/* Floating Action Button */}
      <button
        onClick={handleFloatingAction}
        className="fixed bottom-6 right-6 z-40 p-4 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 hover:scale-105 transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        aria-label="Action"
      >
        <Plus size={24} />
      </button>

      {isUploadModalOpen && (
        <UploadModal onClose={() => setIsUploadModalOpen(false)} />
      )}
    </div>
  );
}

