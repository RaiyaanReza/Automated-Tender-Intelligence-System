import { X } from 'lucide-react';

const MobileMenu = ({ isOpen, onClose, children }) => {
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-300
        ${isOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`}
        onClick={onClose}
      />
      
      {/* Mobile Sidebar */}
      <div
        className={`fixed top-0 left-0 h-full w-[88vw] max-w-sm border-r border-white/10 bg-[#0b0b10]/95 z-50 
        lg:hidden transform transition-transform duration-300 ease-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center justify-between border-b border-white/10 p-4 sm:p-6">
          <h2 className="text-xl font-bold bg-gradient-to-r from-red-400 to-red-600 bg-clip-text text-transparent">
            TIAS Scout
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="h-[calc(100%-73px)] overflow-y-auto">{children}</div>
      </div>
    </>
  );
};

export default MobileMenu;