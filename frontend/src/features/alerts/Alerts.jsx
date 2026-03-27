import { Bell, CheckCircle2 } from 'lucide-react';
import useApiResource from '../../hooks/useApiResource';
import { alertAPI } from '../../services/api';

const Alerts = () => {
  const { data: alerts, loading, error, reload } = useApiResource(alertAPI.getAll);

  const markRead = async (id) => {
    await alertAPI.markAsRead(id);
    reload();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Alerts</h1>

      {loading ? <div className="p-6 bg-base-300 rounded-xl border border-white/10 text-gray-300">Loading alerts...</div> : null}
      {error ? <div className="p-6 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300">{error}</div> : null}

      {!loading && !error && alerts.length === 0 ? (
        <div className="p-6 bg-base-300 rounded-xl border border-white/10 text-gray-400">No alerts yet.</div>
      ) : null}

      <div className="space-y-4">
        {alerts.map((alert) => (
          <div key={alert.id} className="p-5 bg-base-300 rounded-xl border border-white/10 flex items-start justify-between gap-4">
            <div>
              <p className="text-white font-semibold inline-flex items-center gap-2">
                <Bell className="h-4 w-4 text-red-400" />
                {alert.message}
              </p>
              <p className="text-sm text-gray-400 mt-1">Level: {alert.level} • {alert.read ? 'Read' : 'Unread'}</p>
            </div>
            {!alert.read ? (
              <button
                type="button"
                onClick={() => markRead(alert.id)}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600/20 px-3 py-2 text-emerald-300 hover:bg-emerald-600/30"
              >
                <CheckCircle2 className="h-4 w-4" />
                Mark Read
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Alerts;