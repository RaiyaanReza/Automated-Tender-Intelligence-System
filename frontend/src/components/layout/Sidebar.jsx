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
} from 'lucide-react';
import SidebarItem from './SidebarItem';
import MobileMenu from './MobileMenu';

const Sidebar = () => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const navigationItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: FileText, label: 'All Tenders', path: '/tenders', badge: '12' },
    { icon: Sparkles, label: 'AI Analysis', path: '/analysis' },
    { icon: FolderOpen, label: 'Documents', path: '/documents' },
    { icon: Database, label: 'Data Sources', path: '/sources' },
    { icon: Bell, label: 'Alerts', path: '/alerts', badge: '3' },
    { icon: Settings, label: 'Settings', path: '/settings' },
  ];

  const secondaryItems = [
    { icon: LogOut, label: 'Logout', path: '/logout', isDanger: true },
  ];

  return (
    <>
      {/* Mobile Menu Toggle */}
      <button
        onClick={() => setIsMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-30 p-3 bg-base-300 border border-white/10 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all shadow-lg"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Mobile Sidebar */}
      <MobileMenu isOpen={isMobileOpen} onClose={() => setIsMobileOpen(false)}>
        <SidebarContent 
          navigationItems={navigationItems} 
          secondaryItems={secondaryItems}
          onClose={() => setIsMobileOpen(false)}
        />
      </MobileMenu>

      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-72 h-screen bg-base-300 border-r border-white/10 fixed left-0 top-0 overflow-y-auto">
        <SidebarContent 
          navigationItems={navigationItems} 
          secondaryItems={secondaryItems}
        />
      </aside>
    </>
  );
};

// Sidebar Content (Reusable for both mobile & desktop)
const SidebarContent = ({ navigationItems, secondaryItems, onClose }) => {
  return (
    <>
      {/* Logo Section */}
      <div className="p-6 border-b border-white/10">
        <NavLink to="/" className="flex items-center gap-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center shadow-lg shadow-red-500/20 group-hover:shadow-red-500/40 transition-shadow">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-red-400 to-red-600 bg-clip-text text-transparent">
              TIAS Scout
            </h1>
            <p className="text-xs text-gray-500">Tender Intelligence</p>
          </div>
        </NavLink>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-4 space-y-1">
        <div className="mb-4">
          <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
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
          <p className="px-4 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
            Account
          </p>
          {secondaryItems.map((item) => (
            <SidebarItem
              key={item.path}
              icon={item.icon}
              label={item.label}
              path={item.path}
              isDanger={item.isDanger}
            />
          ))}
        </div>
      </nav>

      {/* User Profile Section */}
      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5 border border-white/10">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-red-500 to-red-700 flex items-center justify-center">
            <span className="text-white font-bold text-sm">AD</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">Admin User</p>
            <p className="text-xs text-gray-500 truncate">admin@tias.com</p>
          </div>
        </div>
      </div>

      {/* Close button for mobile */}
      {onClose && (
        <button
          onClick={onClose}
          className="lg:hidden absolute top-4 right-4 p-2 text-gray-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </>
  );
};

export default Sidebar;