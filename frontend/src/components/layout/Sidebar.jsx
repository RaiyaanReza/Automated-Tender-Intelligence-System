import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FileText,
  Bell,
  Settings,
  FolderOpen,
  Menu,
  LogOut,
  Sparkles,
  Database,
  X,
  ShieldCheck,
} from 'lucide-react';
import SidebarItem from './SidebarItem';
import MobileMenu from './MobileMenu';
import Modal from '../ui/Modal';

const Sidebar = () => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  const navigationItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: FileText, label: 'All Tenders', path: '/tenders', badge: '12' },
    { icon: Sparkles, label: 'AI Analysis', path: '/analysis' },
    { icon: FolderOpen, label: 'Documents', path: '/documents' },
    { icon: Database, label: 'Data Sources', path: '/sources' },
    { icon: Bell, label: 'Alerts', path: '/alerts', badge: '3' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  const handleConfirmLogout = () => {
    setIsLogoutModalOpen(false);
    // Future backend integration hook: call auth logout endpoint and clear tokens.
    window.alert('Logged out (placeholder). Connect backend auth API here.');
  };

  return (
    <>
      {/* Mobile Menu Toggle */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-40 rounded-xl border border-white/10 bg-[#0b0b10]/95 p-2.5 text-gray-300 transition-all hover:border-red-500/40 hover:text-white"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile Sidebar */}
      <MobileMenu isOpen={isMobileOpen} onClose={() => setIsMobileOpen(false)}>
        <SidebarContent
          navigationItems={navigationItems}
          onClose={() => setIsMobileOpen(false)}
          onRequestLogout={() => {
            setIsMobileOpen(false);
            setIsLogoutModalOpen(true);
          }}
        />
      </MobileMenu>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-72 flex-col overflow-y-auto border-r border-white/10 bg-[#0b0b10]/92 backdrop-blur-xl">
        <SidebarContent navigationItems={navigationItems} onRequestLogout={() => setIsLogoutModalOpen(true)} />
      </aside>

      <Modal
        isOpen={isLogoutModalOpen}
        onClose={() => setIsLogoutModalOpen(false)}
        title="Confirm logout"
        description="You can connect this action to your backend session revoke endpoint later."
        size="sm"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setIsLogoutModalOpen(false)}
              className="rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-gray-200 hover:border-white/30 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmLogout}
              className="rounded-xl bg-gradient-to-r from-red-600 to-red-700 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-red-900/30 hover:from-red-500 hover:to-red-600"
            >
              Logout
            </button>
          </div>
        }
      >
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4">
          <p className="text-sm text-red-100">
            This is a working modal and action flow. Replace the placeholder handler with your auth API call when backend is ready.
          </p>
        </div>
      </Modal>
    </>
  );
};

// Sidebar Content (Reusable for both mobile & desktop)
const SidebarContent = ({ navigationItems, onClose, onRequestLogout }) => {
  return (
    <>
      {/* Logo Section */}
      <div className="border-b border-white/10 p-5 sm:p-6">
        <NavLink to="/" className="flex items-center gap-3 group">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-red-500 to-red-700 shadow-lg shadow-red-500/20 transition-shadow group-hover:shadow-red-500/40">
            <Sparkles className="h-6 w-6 text-white" />
          </div>
          <div className="leading-tight">
            <h1 className="bg-gradient-to-r from-red-300 via-red-400 to-red-600 bg-clip-text text-lg font-bold tracking-tight text-transparent sm:text-xl">
              TIAS Scout
            </h1>
            <p className="text-[11px] uppercase tracking-[0.14em] text-gray-500">Tender Intelligence</p>
          </div>
        </NavLink>
      </div>

      <div className="mx-4 mt-4 rounded-2xl border border-red-500/20 bg-gradient-to-r from-red-500/15 via-red-500/5 to-transparent p-3">
        <div className="flex items-center gap-2 text-red-200">
          <ShieldCheck className="h-4 w-4" />
          <p className="text-xs font-semibold tracking-wide">Workspace Security</p>
        </div>
        <p className="mt-1 text-xs text-gray-300">Role: Admin, Full platform privileges enabled.</p>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-4 space-y-2">
        <div className="mb-4">
          <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
            Main Menu
          </p>
          {navigationItems.map((item) => (
            <SidebarItem
              key={item.path}
              icon={item.icon}
              label={item.label}
              path={item.path}
              badge={item.badge}
            />
          ))}
        </div>

        <div className="pt-4 border-t border-white/10">
          <p className="mb-2 px-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">
            Account
          </p>
          <SidebarItem icon={LogOut} label="Logout" isDanger onClick={onRequestLogout} />
        </div>
      </nav>

      {/* User Profile Section */}
      <div className="border-t border-white/10 p-4">
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-700">
            <span className="text-white font-bold text-sm">AD</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">Admin User</p>
            <p className="truncate text-xs text-gray-500">admin@tias.com</p>
          </div>
        </div>
      </div>

      {/* Close button for mobile */}
      {onClose && (
        <button
          onClick={onClose}
          className="lg:hidden absolute top-4 right-4 p-2 text-gray-400 hover:text-white"
          aria-label="Close navigation"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </>
  );
};

export default Sidebar;