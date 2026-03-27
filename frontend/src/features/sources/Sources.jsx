import useApiResource from '../../hooks/useApiResource';
import { sourceAPI } from '../../services/api';

const Sources = () => {
  const { data: sources, loading, error } = useApiResource(sourceAPI.getAll);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Data Sources</h1>

      {loading ? <div className="p-6 bg-base-300 rounded-xl border border-white/10 text-gray-300">Loading sources...</div> : null}
      {error ? <div className="p-6 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300">{error}</div> : null}

      <div className="space-y-4">
        {sources.map((source) => (
          <div key={source.id} className="p-5 bg-base-300 rounded-xl border border-white/10">
            <h2 className="text-lg font-semibold text-white">{source.name}</h2>
            <p className="text-sm text-gray-400 mt-1">Type: {source.type} • Status: {source.status}</p>
            <p className="text-sm text-gray-300 mt-2">Detected Records: {source.records_detected}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Sources;