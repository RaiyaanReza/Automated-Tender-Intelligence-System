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
    </div>
  );
};

export default Settings;