import useApiResource from '../../hooks/useApiResource';
import { analysisAPI } from '../../services/api';

const Analysis = () => {
  const { data: rows, loading, error } = useApiResource(analysisAPI.getAll);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">AI Analysis</h1>

      {loading ? <div className="p-6 bg-base-300 rounded-xl border border-white/10 text-gray-300">Loading analysis...</div> : null}
      {error ? <div className="p-6 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300">{error}</div> : null}

      <div className="space-y-4">
        {rows.map((row) => (
          <div key={row.tender_id} className="p-5 bg-base-300 rounded-xl border border-white/10">
            <h2 className="text-lg font-semibold text-white">{row.title}</h2>
            <p className="text-sm text-gray-400 mt-1">Priority: {row.priority} • Fit: {row.fit}</p>
            <p className="text-sm text-gray-300 mt-3">{row.notes}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Analysis;