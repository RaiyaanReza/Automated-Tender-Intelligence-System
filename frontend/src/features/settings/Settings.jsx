import { useEffect, useState } from 'react';
import { configAPI } from '../../services/api';

const Settings = () => {
  const [form, setForm] = useState({
    refresh_interval_minutes: 15,
    min_priority: 'Low',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [ops, setOps] = useState({
    keyword: 'Bandwidth',
    proc_nature: 'Goods',
    publish_from: '01-Feb-2026',
    max_pages: 1,
    max_items_per_cycle: 10,
    keep_from: '2026-02-01T00:00:00',
    tender_id: '',
  });
  const [runningScraper, setRunningScraper] = useState(false);
  const [pruning, setPruning] = useState(false);
  const [testingAlert, setTestingAlert] = useState(false);
  const [opsMessage, setOpsMessage] = useState('');

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await configAPI.getSettings();
        setForm((prev) => ({ ...prev, ...response.data }));
      } catch (err) {
        setError(err?.response?.data?.detail || 'Failed to load settings.');
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const saveSettings = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const response = await configAPI.updateSettings(form);
      setForm((prev) => ({ ...prev, ...response.data }));
      setSuccess('Settings saved successfully.');
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const runScraperNow = async () => {
    setRunningScraper(true);
    setOpsMessage('');
    try {
      const payload = {
        keyword: ops.keyword,
        proc_nature: ops.proc_nature,
        publish_from: ops.publish_from,
        max_pages: Number(ops.max_pages) || 1,
        max_items_per_cycle: Number(ops.max_items_per_cycle) || 10,
        save_pdf: true,
      };
      const response = await configAPI.runScraperNow(payload);
      setOpsMessage(`Scraper finished: ${JSON.stringify(response.data)}`);
    } catch (err) {
      setOpsMessage(err?.response?.data?.detail || 'Scraper run failed.');
    } finally {
      setRunningScraper(false);
    }
  };

  const pruneOldTenders = async () => {
    setPruning(true);
    setOpsMessage('');
    try {
      const payload = {
        keep_from: ops.keep_from,
        keyword_only: false,
      };
      const response = await configAPI.pruneTenders(payload);
      setOpsMessage(`Prune completed: ${JSON.stringify(response.data)}`);
    } catch (err) {
      setOpsMessage(err?.response?.data?.detail || 'Prune failed.');
    } finally {
      setPruning(false);
    }
  };

  const sendTelegramTest = async () => {
    setTestingAlert(true);
    setOpsMessage('');
    try {
      const payload = {
        tender_id: ops.tender_id || null,
      };
      const response = await configAPI.sendTestAlert(payload);
      setOpsMessage(`Alert test result: ${JSON.stringify(response.data)}`);
    } catch (err) {
      setOpsMessage(err?.response?.data?.detail || 'Alert test failed.');
    } finally {
      setTestingAlert(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Settings</h1>

      {loading ? <div className="p-6 bg-base-300 rounded-xl border border-white/10 text-gray-300">Loading settings...</div> : null}
      {error ? <div className="p-6 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300">{error}</div> : null}
      {success ? <div className="p-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">{success}</div> : null}

      <div className="p-6 bg-base-300 rounded-xl border border-white/10 space-y-4">
        <div>
          <label className="text-sm text-gray-300 block mb-2">Refresh Interval (minutes)</label>
          <input
            type="number"
            value={form.refresh_interval_minutes}
            onChange={(e) => setForm((prev) => ({ ...prev, refresh_interval_minutes: Number(e.target.value) }))}
            className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none"
          />
        </div>

        <div>
          <label className="text-sm text-gray-300 block mb-2">Minimum Priority</label>
          <select
            value={form.min_priority}
            onChange={(e) => setForm((prev) => ({ ...prev, min_priority: e.target.value }))}
            className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none"
          >
            <option className="bg-[#111]" value="Low">Low</option>
            <option className="bg-[#111]" value="Medium">Medium</option>
            <option className="bg-[#111]" value="High">High</option>
            <option className="bg-[#111]" value="Urgent">Urgent</option>
          </select>
        </div>

        <button
          type="button"
          disabled={saving}
          onClick={saveSettings}
          className="rounded-xl bg-gradient-to-r from-red-600 to-red-700 px-4 py-2 text-sm font-semibold text-white hover:from-red-500 hover:to-red-600 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      <div className="p-6 bg-base-300 rounded-xl border border-white/10 space-y-4">
        <h2 className="text-xl font-semibold text-white">Scraper Control Panel</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-gray-300 block mb-2">Keyword</label>
            <input
              type="text"
              value={ops.keyword}
              onChange={(e) => setOps((prev) => ({ ...prev, keyword: e.target.value }))}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none"
            />
          </div>

          <div>
            <label className="text-sm text-gray-300 block mb-2">Procurement Nature</label>
            <select
              value={ops.proc_nature}
              onChange={(e) => setOps((prev) => ({ ...prev, proc_nature: e.target.value }))}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none"
            >
              <option className="bg-[#111]" value="Goods">Goods</option>
              <option className="bg-[#111]" value="Works">Works</option>
              <option className="bg-[#111]" value="Service">Service</option>
              <option className="bg-[#111]" value="Physical Services">Physical Services</option>
            </select>
          </div>

          <div>
            <label className="text-sm text-gray-300 block mb-2">Publish From</label>
            <input
              type="text"
              value={ops.publish_from}
              onChange={(e) => setOps((prev) => ({ ...prev, publish_from: e.target.value }))}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none"
            />
          </div>

          <div>
            <label className="text-sm text-gray-300 block mb-2">Max Pages</label>
            <input
              type="number"
              value={ops.max_pages}
              onChange={(e) => setOps((prev) => ({ ...prev, max_pages: Number(e.target.value) }))}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none"
            />
          </div>

          <div>
            <label className="text-sm text-gray-300 block mb-2">Max Items Per Cycle</label>
            <input
              type="number"
              value={ops.max_items_per_cycle}
              onChange={(e) => setOps((prev) => ({ ...prev, max_items_per_cycle: Number(e.target.value) }))}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none"
            />
          </div>

          <div>
            <label className="text-sm text-gray-300 block mb-2">Keep Data From (ISO)</label>
            <input
              type="text"
              value={ops.keep_from}
              onChange={(e) => setOps((prev) => ({ ...prev, keep_from: e.target.value }))}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-sm text-gray-300 block mb-2">Telegram Test Tender ID (optional)</label>
            <input
              type="text"
              value={ops.tender_id}
              onChange={(e) => setOps((prev) => ({ ...prev, tender_id: e.target.value }))}
              className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-sm text-white outline-none"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            disabled={runningScraper}
            onClick={runScraperNow}
            className="rounded-xl bg-gradient-to-r from-cyan-600 to-cyan-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {runningScraper ? 'Running Scraper...' : 'Run Scraper Now'}
          </button>

          <button
            type="button"
            disabled={pruning}
            onClick={pruneOldTenders}
            className="rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pruning ? 'Pruning...' : 'Prune Old Data'}
          </button>

          <button
            type="button"
            disabled={testingAlert}
            onClick={sendTelegramTest}
            className="rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {testingAlert ? 'Testing Alert...' : 'Send Telegram Test'}
          </button>
        </div>

        {opsMessage ? (
          <div className="rounded-xl border border-white/15 bg-white/5 p-3 text-xs text-gray-200 whitespace-pre-wrap">
            {opsMessage}
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default Settings;