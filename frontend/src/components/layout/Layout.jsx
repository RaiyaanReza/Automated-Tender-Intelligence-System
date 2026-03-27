/* eslint-disable no-unused-vars */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, UserCircle2 } from 'lucide-react';
import Sidebar from './Sidebar';
import Modal from '../ui/Modal';
import useApiResource from '../../hooks/useApiResource';
import { alertAPI } from '../../services/api';

const Layout = ({ children }) => {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const { data: notifications = [] } = useApiResource(alertAPI.getAll);

  return (
    <>
      {/* PROFESSIONAL ANIMATED BACKGROUND */}
      <div className="animated-bg">
        {/* Gradient Blobs */}
        <div className="gradient-blob blob-1" />
        <div className="gradient-blob blob-2" />
        <div className="gradient-blob blob-3" />
        <div className="gradient-blob blob-4" />

        {/* Grid Pattern */}
        <div className="grid-pattern" />

        {/* Floating Particles */}
        <div className="particle" />
        <div className="particle" />
        <div className="particle" />
        <div className="particle" />
        <div className="particle" />
        <div className="particle" />
        <div className="particle" />
        <div className="particle" />
        <div className="particle" />
        <div className="particle" />
      </div>

      {/* Main Container */}
      <div className="min-h-screen relative">
        <Sidebar />

        <main className="min-h-screen lg:ml-72">
          {/* Header */}
          <motion.header
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6 }}
            className="sticky top-0 z-20 border-b border-white/10 px-4 py-4 pl-16 glass-strong sm:px-6 sm:pl-20 lg:px-8 lg:pl-8"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <motion.h2
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="truncate text-base font-semibold sm:text-lg"
                >
                  <span className="text-white">Welcome to </span>
                  <span className="gradient-text">TIAS Scout</span>
                </motion.h2>
                <motion.p
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                  className="hidden text-sm text-gray-400 sm:block"
                >
                  Monitor • Analyze • Act
                </motion.p>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 lg:gap-4">
                {/* Search */}
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 transition-colors hover:border-red-500/50 md:flex"
                >
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search tenders..."
                    className="w-40 border-none bg-transparent text-sm text-white outline-none placeholder-gray-500 lg:w-48"
                  />
                </motion.div>

                {/* Notifications */}
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  type="button"
                  onClick={() => setIsNotificationsOpen(true)}
                  className="relative rounded-xl p-2.5 text-gray-400 transition-colors hover:bg-red-500/20 hover:text-white"
                  aria-label="Open notifications"
                >
                  <Bell className="h-5 w-5" />
                  <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                </motion.button>

                {/* User Avatar */}
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full ring-2 ring-red-500/30 gradient-red shadow-lg shadow-red-500/20 transition-all hover:ring-red-500/60"
                  onClick={() => setIsProfileOpen(true)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      setIsProfileOpen(true);
                    }
                  }}
                >
                  <span className="text-white text-sm font-bold">AD</span>
                </motion.div>
              </div>
            </div>
          </motion.header>

          {/* Page Content */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="p-4 sm:p-6 lg:p-8"
          >
            {children}
          </motion.div>
        </main>
      </div>

      <Modal
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        title="Notifications"
        description="Frontend-ready list. Replace static payload with backend notification API response."
        size="sm"
      >
        <div className="space-y-3">
          {notifications.map((notification) => (
            <div key={notification.id} className="rounded-xl border border-white/10 bg-white/5 p-3">
              <p className="text-sm text-white">{notification.message || 'Notification'}</p>
              <p className="mt-1 text-xs text-gray-400">{notification.created_at || 'Unknown time'}</p>
            </div>
          ))}
        </div>
      </Modal>

      <Modal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        title="Profile"
        description="This modal is connected and ready for backend user data binding."
        size="sm"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full gradient-red">
              <span className="text-sm font-bold text-white">AD</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Admin User</p>
              <p className="text-xs text-gray-400">admin@tias.com</p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-gray-100 hover:border-red-500/40 hover:bg-red-500/10"
          >
            <UserCircle2 className="h-4 w-4" />
            Manage Profile
          </button>
        </div>
      </Modal>
    </>
  );
};

export default Layout;