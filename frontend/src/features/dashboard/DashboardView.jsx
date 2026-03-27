/* eslint-disable no-unused-vars */
import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  Building2,
  CalendarClock,
  CheckCircle,
  Clock,
  DollarSign,
  ExternalLink,
  FileText,
  Target,
  TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import Modal from '../../components/ui/Modal';
import useTenders from '../../hooks/useTenders';
import { formatDateTimeLabel, getTenderOrganization, resolveTenderSourceUrl } from '../../utils/helpers';

const DashboardView = () => {
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [selectedTender, setSelectedTender] = useState(null);
  const [selectedQuickAction, setSelectedQuickAction] = useState(null);
  const { tenders, loading, error, stats: statsData } = useTenders();

  const stats = [
    {
      icon: FileText,
      label: 'Total Tenders',
      value: String(statsData.total),
      change: `${statsData.total} records`,
      trend: 'up',
      color: 'from-red-500 to-red-700',
      bg: 'bg-red-500/10',
      borderColor: 'border-red-500/20',
    },
    {
      icon: CheckCircle,
      label: 'Relevant',
      value: String(statsData.relevant),
      change: 'High/Urgent',
      trend: 'up',
      color: 'from-emerald-500 to-emerald-700',
      bg: 'bg-emerald-500/10',
      borderColor: 'border-emerald-500/20',
    },
    {
      icon: Clock,
      label: 'Pending Review',
      value: String(statsData.pending),
      change: 'new/review',
      trend: 'up',
      color: 'from-amber-500 to-amber-700',
      bg: 'bg-amber-500/10',
      borderColor: 'border-amber-500/20',
    },
    {
      icon: TrendingUp,
      label: 'Success Rate',
      value: statsData.successRate,
      change: 'match ratio',
      trend: 'up',
      color: 'from-blue-500 to-blue-700',
      bg: 'bg-blue-500/10',
      borderColor: 'border-blue-500/20',
    },
  ];

  const quickActions = useMemo(
    () => [
      { id: 'browse', icon: FileText, label: 'Browse Tenders', color: 'text-red-400', bg: 'bg-red-500/10' },
      { id: 'review', icon: CheckCircle, label: 'Review Pending', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
      { id: 'analytics', icon: DollarSign, label: 'View Analytics', color: 'text-blue-400', bg: 'bg-blue-500/10' },
      { id: 'sources', icon: Building2, label: 'Manage Sources', color: 'text-amber-400', bg: 'bg-amber-500/10' },
    ],
    [],
  );

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.2 },
    },
  };

  const itemVariants = {
    hidden: { y: 30, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: { duration: 0.6, ease: [0.4, 0, 0.2, 1] },
    },
  };

  const recentTenders = tenders.slice(0, 5);
  const selectedTenderLink = selectedTender ? resolveTenderSourceUrl(selectedTender) : '';

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="flex flex-col gap-4 sm:gap-6 lg:flex-row lg:items-center lg:justify-between"
      >
        <div className="min-w-0">
          <motion.h1
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="mb-1 text-3xl font-bold text-white sm:mb-2 sm:text-4xl lg:text-5xl"
          >
            Dashboard
          </motion.h1>
          <motion.p
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-sm text-gray-400 sm:text-base lg:text-lg"
          >
            Monitor • Analyze • Act
          </motion.p>
        </div>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          type="button"
          onClick={() => setIsSearchModalOpen(true)}
          className="btn-primary flex items-center gap-2 self-start px-5 py-3 text-sm sm:px-7 sm:py-3.5 sm:text-base lg:self-auto"
        >
          <Target className="h-5 w-5" />
          <span>New Tender Search</span>
        </motion.button>
      </motion.div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 xl:grid-cols-4"
      >
        {stats.map((stat) => (
          <motion.div
            key={stat.label}
            variants={itemVariants}
            whileHover={{ y: -8, scale: 1.02 }}
            className="stat-card cursor-pointer group"
          >
            <div className="mb-4 flex items-start justify-between">
              <motion.div
                whileHover={{ scale: 1.1, rotate: 5 }}
                className={`rounded-2xl border p-4 ${stat.bg} ${stat.borderColor}`}
              >
                <stat.icon className={`h-6 w-6 bg-gradient-to-r text-white sm:h-7 sm:w-7 ${stat.color}`} />
              </motion.div>
              <div className={`flex items-center gap-1 rounded-full px-3 py-1 text-sm font-medium ${
                stat.trend === 'up' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
              }`}>
                {stat.trend === 'up' ? '↑' : '↓'}
                {stat.change}
              </div>
            </div>

            <motion.h3 className="mb-1 text-3xl font-bold text-white sm:text-4xl" whileHover={{ scale: 1.05 }}>
              {stat.value}
            </motion.h3>
            <p className="text-sm text-gray-400">{stat.label}</p>

            <div className="mt-4 border-t border-white/5 pt-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 transition-colors group-hover:text-red-400">
                <span>View details</span>
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3 lg:gap-8">
        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-4 sm:p-6 lg:col-span-2"
        >
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="mb-1 text-xl font-bold text-white sm:text-2xl">Recent Tenders</h2>
              <p className="text-sm text-gray-400">Latest opportunities for you</p>
            </div>
            <Link to="/tenders" className="flex items-center gap-1 text-sm font-medium text-red-400 transition-colors hover:text-red-300">
              View All
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>

          {loading ? <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">Loading tenders from backend...</div> : null}
          {error ? <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">{error}</div> : null}
          {!loading && !error && recentTenders.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-gray-300">No tenders found in database.</div>
          ) : null}

          <div className="space-y-4">
            {recentTenders.map((tender, index) => {
              const sourceLink = resolveTenderSourceUrl(tender);
              return (
                <motion.div
                  key={tender.id}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.5 + index * 0.1 }}
                  whileHover={{ x: 8 }}
                  className="tender-card group cursor-pointer"
                  onClick={() => setSelectedTender(tender)}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-2 sm:gap-3">
                        <h4 className="text-base font-semibold text-white transition-colors group-hover:text-red-400 sm:text-lg">{tender.title}</h4>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          tender.priority === 'Urgent'
                            ? 'bg-red-500/20 text-red-400'
                            : tender.priority === 'High'
                            ? 'bg-orange-500/20 text-orange-400'
                            : 'bg-blue-500/20 text-blue-400'
                        }`}>
                          {tender.priority}
                        </span>
                      </div>

                      <div className="mb-3 flex items-center gap-4 text-sm text-gray-400">
                        <div className="flex items-center gap-1">
                          <Building2 className="h-4 w-4" />
                          <span>{getTenderOrganization(tender)}</span>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-sm sm:gap-6">
                        <div className="flex items-center gap-2 text-gray-400">
                          <Clock className="h-4 w-4 text-amber-400" />
                          <span>{tender.deadlineLabel}</span>
                        </div>
                        <div className="flex items-center gap-2 text-gray-400">
                          <DollarSign className="h-4 w-4 text-emerald-400" />
                          <span>{tender.value}</span>
                        </div>
                        {sourceLink ? (
                          <a
                            href={sourceLink}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                            className="inline-flex items-center gap-1 text-xs text-cyan-300 underline hover:text-cyan-200"
                          >
                            Open Source <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : null}
                      </div>
                    </div>

                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      className="gradient-red hidden h-10 w-10 items-center justify-center rounded-xl opacity-0 transition-opacity group-hover:opacity-100 sm:flex"
                    >
                      <ArrowUpRight className="h-5 w-5 text-white" />
                    </motion.div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="glass-card p-4 sm:p-6"
        >
          <h2 className="mb-6 text-xl font-bold text-white sm:text-2xl">Quick Actions</h2>

          <div className="space-y-3">
            {quickActions.map((action, index) => (
              <motion.button
                key={action.label}
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.6 + index * 0.1 }}
                whileHover={{ x: 5, scale: 1.02 }}
                type="button"
                onClick={() => setSelectedQuickAction(action)}
                className="group flex w-full items-center gap-3 rounded-xl border border-white/5 bg-white/5 p-4 transition-all hover:border-red-500/30 hover:bg-white/10"
              >
                <div className={`rounded-lg p-2 ${action.bg}`}>
                  <action.icon className={`h-5 w-5 ${action.color}`} />
                </div>
                <span className="flex-1 text-left font-medium text-gray-300 group-hover:text-white">{action.label}</span>
                <ArrowUpRight className="h-4 w-4 text-gray-500 transition-colors group-hover:text-red-400" />
              </motion.button>
            ))}
          </div>

          <div className="mt-8 border-t border-white/10 pt-6">
            <h3 className="mb-4 text-lg font-semibold text-white">This Week</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Tenders Scanned</span>
                <span className="font-semibold text-white">{statsData.total}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Matches Found</span>
                <span className="font-semibold text-emerald-400">{statsData.relevant}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">AI Analysis</span>
                <span className="font-semibold text-blue-400">{statsData.pending} pending</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      <Modal
        isOpen={isSearchModalOpen}
        onClose={() => setIsSearchModalOpen(false)}
        title="New Tender Search"
        description="Working modal with fields ready to connect to backend search API."
        size="md"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={() => setIsSearchModalOpen(false)}
              className="rounded-xl border border-white/15 px-4 py-2 text-sm font-medium text-gray-200 hover:border-white/30 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSearchModalOpen(false);
                window.alert('Search submitted (placeholder). Connect backend endpoint here.');
              }}
              className="rounded-xl bg-gradient-to-r from-red-600 to-red-700 px-4 py-2 text-sm font-semibold text-white hover:from-red-500 hover:to-red-600"
            >
              Run Search
            </button>
          </div>
        }
      >
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Query</span>
            <input
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-red-500/50"
              placeholder="e.g. cybersecurity, network infra, cloud"
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Budget (Min)</span>
            <input className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none" placeholder="500000" />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Deadline Window</span>
            <select className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none">
              <option className="bg-[#111]">7 days</option>
              <option className="bg-[#111]">14 days</option>
              <option className="bg-[#111]">30 days</option>
            </select>
          </label>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(selectedTender)}
        onClose={() => setSelectedTender(null)}
        title={selectedTender ? selectedTender.title : 'Tender Details'}
        description="Live tender details with direct links and deadline context."
        size="md"
      >
        {selectedTender ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: [0.2, 0.9, 0.25, 1] }}
            className="space-y-4 text-sm text-gray-300"
          >
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-red-500/15 px-2.5 py-1 text-xs font-semibold text-red-300">{selectedTender.priority}</span>
                <span className="rounded-full bg-blue-500/15 px-2.5 py-1 text-xs font-semibold text-blue-300">{selectedTender.tender_id || selectedTender.id}</span>
              </div>
              <div className="space-y-2">
                <p className="inline-flex items-center gap-2"><Building2 className="h-4 w-4 text-gray-400" /> {getTenderOrganization(selectedTender)}</p>
                <p className="inline-flex items-center gap-2"><CalendarClock className="h-4 w-4 text-amber-400" /> Deadline: {formatDateTimeLabel(selectedTender.deadline)}</p>
                <p><span className="text-gray-400">Estimated Value/Security:</span> {selectedTender.value}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Link
                to={`/tenders/${selectedTender.tender_id || selectedTender.id}`}
                onClick={() => setSelectedTender(null)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 font-medium text-gray-100 transition hover:border-cyan-400/40 hover:bg-cyan-500/10"
              >
                Full Details <ArrowUpRight className="h-4 w-4" />
              </Link>
              {selectedTenderLink ? (
                <a
                  href={selectedTenderLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 font-medium text-red-200 transition hover:bg-red-500/20"
                >
                  Open e-GP Link <ExternalLink className="h-4 w-4" />
                </a>
              ) : (
                <div className="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-gray-400">
                  No source link available
                </div>
              )}
            </div>

            {selectedTender.description ? (
              <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Summary</p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-gray-200">{selectedTender.description}</p>
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </Modal>

      <Modal
        isOpen={Boolean(selectedQuickAction)}
        onClose={() => setSelectedQuickAction(null)}
        title={selectedQuickAction ? selectedQuickAction.label : 'Quick Action'}
        description="Action stub is fully wired and ready for backend integration."
        size="sm"
      >
        <p className="text-sm text-gray-300">
          This action flow is working on the frontend. Map this to your API route or service method when backend endpoints are ready.
        </p>
      </Modal>
    </div>
  );
};

export default DashboardView;
