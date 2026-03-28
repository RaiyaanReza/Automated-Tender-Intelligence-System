/* eslint-disable no-unused-vars */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { Link, useNavigate } from 'react-router-dom';
import Modal from '../../components/ui/Modal';
import useTenders from '../../hooks/useTenders';
import {
  buildTenderDetailsPath,
  cleanSummaryText,
  extractSummaryBullets,
  formatDateTimeLabel,
  getTenderOrganization,
  resolveTenderSourceUrl,
} from '../../utils/helpers';
import { configAPI } from '../../services/api';

const DashboardView = () => {
  const navigate = useNavigate();
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [selectedTender, setSelectedTender] = useState(null);
  const [searchForm, setSearchForm] = useState({
    query: '',
    budgetMin: '',
    deadlineWindow: '30',
  });
  const [isSubmittingSearch, setIsSubmittingSearch] = useState(false);
  const [isStoppingScraper, setIsStoppingScraper] = useState(false);
  const [actionMessage, setActionMessage] = useState('');
  const [scraperStatus, setScraperStatus] = useState({
    running: false,
    stop_requested: false,
    started_at: null,
    finished_at: null,
    last_result: null,
    last_error: null,
  });
  const wasScraperRunningRef = useRef(false);
  const { tenders, loading, error, stats: statsData, reload: reloadTenders } = useTenders();

  const loadScraperStatus = useCallback(async () => {
    try {
      const response = await configAPI.getScraperStatus();
      setScraperStatus(response?.data || {});
    } catch {
      // Keep existing state if status endpoint is temporarily unavailable.
    }
  }, []);

  useEffect(() => {
    loadScraperStatus();
    const timer = setInterval(loadScraperStatus, 5000);
    return () => clearInterval(timer);
  }, [loadScraperStatus]);

  useEffect(() => {
    const wasRunning = wasScraperRunningRef.current;
    const isRunning = Boolean(scraperStatus?.running);

    if (wasRunning && !isRunning) {
      void reloadTenders();
      if (scraperStatus?.last_error) {
        setActionMessage(`Scraper failed: ${scraperStatus.last_error}`);
      } else if (scraperStatus?.last_result?.stopped) {
        setActionMessage('Scraper stopped. Partial results were synchronized.');
      } else {
        setActionMessage('Scraper completed and dashboard refreshed.');
      }
    }

    wasScraperRunningRef.current = isRunning;
  }, [reloadTenders, scraperStatus]);

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

  const quickActionRoutes = {
    browse: '/tenders',
    review: '/tenders',
    analytics: '/analysis',
    sources: '/sources',
  };

  const handleQuickAction = (actionId) => {
    const route = quickActionRoutes[actionId];
    if (!route) return;
    navigate(route);
  };

  const handleStartScraper = async ({ closeModal = false } = {}) => {
    if (scraperStatus?.running) {
      setActionMessage('Scraper is already running.');
      return;
    }

    const query = String(searchForm.query || '').trim();
    const keywordList = query
      .split(/[,\n;|]+/g)
      .map((item) => item.trim())
      .filter(Boolean);

    const payload = {
      max_pages: 3,
      max_items_per_cycle: 50,
      max_deadline_window_days: Number.parseInt(searchForm.deadlineWindow, 10) || 30,
      save_pdf: true,
    };

    if (keywordList.length === 1) {
      payload.keyword = keywordList[0];
    }
    if (keywordList.length > 1) {
      payload.keywords = keywordList;
    }

    setIsSubmittingSearch(true);
    setActionMessage('');
    try {
      await configAPI.startScraper(payload);
      if (closeModal) {
        setIsSearchModalOpen(false);
      }
      setActionMessage('Live scraping started. Use Stop to halt anytime.');
      await loadScraperStatus();
    } catch (runError) {
      setActionMessage(runError?.response?.data?.detail || 'Failed to start scraper.');
    } finally {
      setIsSubmittingSearch(false);
    }
  };

  const handleStopScraper = async () => {
    if (!scraperStatus?.running) {
      setActionMessage('Scraper is not running.');
      return;
    }

    setIsStoppingScraper(true);
    setActionMessage('');
    try {
      await configAPI.stopScraper();
      setActionMessage('Stop requested. Scraper will halt safely after current step.');
      await loadScraperStatus();
    } catch (stopError) {
      setActionMessage(stopError?.response?.data?.detail || 'Failed to stop scraper.');
    } finally {
      setIsStoppingScraper(false);
    }
  };

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

        <div className="flex flex-wrap items-center gap-3">
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

          {scraperStatus?.running ? (
            <button
              type="button"
              onClick={handleStopScraper}
              disabled={isStoppingScraper}
              className="inline-flex items-center gap-2 rounded-xl border border-red-500/40 bg-red-500/15 px-4 py-3 text-sm font-semibold text-red-100 transition hover:bg-red-500/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="h-2 w-2 rounded-full bg-red-300" />
              {isStoppingScraper ? 'Stopping...' : 'Stop Scraper'}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleStartScraper()}
              disabled={isSubmittingSearch}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 bg-emerald-500/15 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-300" />
              {isSubmittingSearch ? 'Starting...' : 'Start Scraper'}
            </button>
          )}
        </div>
      </motion.div>

      {actionMessage ? (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-200">
          {actionMessage}
        </div>
      ) : null}

      <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-gray-200">
        <div className="flex flex-wrap items-center gap-4">
          <div className="inline-flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${scraperStatus?.running ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
            <span>{scraperStatus?.running ? 'Scraper Running' : 'Scraper Idle'}</span>
          </div>
          {scraperStatus?.started_at ? <span className="text-gray-400">Started: {formatDateTimeLabel(scraperStatus.started_at)}</span> : null}
          {scraperStatus?.finished_at ? <span className="text-gray-400">Finished: {formatDateTimeLabel(scraperStatus.finished_at)}</span> : null}
          {scraperStatus?.last_result?.new_rows ? <span className="text-emerald-300">Latest New Rows: {scraperStatus.last_result.new_rows}</span> : null}
        </div>
      </div>

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
                          <CalendarClock className="h-4 w-4 text-cyan-300" />
                          <span>{tender.publishedLabel}</span>
                        </div>
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
                onClick={() => handleQuickAction(action.id)}
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
        description="Starts a background scrape run with your filters and keeps dashboard responsive."
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
              onClick={() => handleStartScraper({ closeModal: true })}
              disabled={isSubmittingSearch || scraperStatus?.running}
              className="rounded-xl bg-gradient-to-r from-red-600 to-red-700 px-4 py-2 text-sm font-semibold text-white hover:from-red-500 hover:to-red-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {scraperStatus?.running ? 'Already Running' : isSubmittingSearch ? 'Starting...' : 'Start Background Scrape'}
            </button>
          </div>
        }
      >
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="space-y-1 md:col-span-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Query</span>
            <input
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-red-500/50"
              placeholder="e.g. internet, bandwidth, fiber optic (comma or new line separated)"
              value={searchForm.query}
              onChange={(event) => setSearchForm((prev) => ({ ...prev, query: event.target.value }))}
            />
            <p className="text-[11px] text-gray-500">Leave empty to run full weighted keyword plan across all configured sectors.</p>
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Budget (Min)</span>
            <input
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none"
              placeholder="500000"
              value={searchForm.budgetMin}
              onChange={(event) => setSearchForm((prev) => ({ ...prev, budgetMin: event.target.value }))}
            />
          </label>
          <label className="space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Deadline Window</span>
            <select
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none"
              value={searchForm.deadlineWindow}
              onChange={(event) => setSearchForm((prev) => ({ ...prev, deadlineWindow: event.target.value }))}
            >
              <option value="7" className="bg-[#111]">7 days</option>
              <option value="14" className="bg-[#111]">14 days</option>
              <option value="30" className="bg-[#111]">30 days</option>
              <option value="45" className="bg-[#111]">45 days</option>
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
                to={buildTenderDetailsPath(selectedTender)}
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

            <div className="rounded-xl border border-white/10 bg-black/20 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Summary</p>
              <div className="mt-2 space-y-2 text-sm text-gray-200">
                {selectedTender?.ai_summary?.notes ? (
                  <p>{cleanSummaryText(selectedTender.ai_summary.notes)}</p>
                ) : null}
                {(Array.isArray(selectedTender?.ai_summary?.key_requirements)
                  ? selectedTender.ai_summary.key_requirements
                  : extractSummaryBullets(selectedTender.description || '', 4)
                ).slice(0, 4).map((item, index) => (
                  <div key={`${item}-${index}`} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-cyan-300" />
                    <span>{cleanSummaryText(item)}</span>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        ) : null}
      </Modal>

    </div>
  );
};

export default DashboardView;
