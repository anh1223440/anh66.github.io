import { AlertTriangle, X } from "lucide-react";

interface ConfirmModalProps {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({ title, message, onConfirm, onCancel }: ConfirmModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
        <div className="p-6">
          <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4 text-red-600 dark:text-red-400">
            <AlertTriangle size={24} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{title}</h2>
          <p className="text-gray-600 dark:text-gray-400">{message}</p>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800/50 px-6 py-4 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Hủy
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl font-medium bg-red-600 hover:bg-red-700 text-white transition-colors"
          >
            Xác nhận
          </button>
        </div>
      </div>
    </div>
  );
}
