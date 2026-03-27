import useApiResource from '../../hooks/useApiResource';
import { documentAPI } from '../../services/api';

const Documents = () => {
  const { data: docs, loading, error } = useApiResource(documentAPI.getAll);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Documents</h1>

      {loading ? <div className="p-6 bg-base-300 rounded-xl border border-white/10 text-gray-300">Loading documents...</div> : null}
      {error ? <div className="p-6 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300">{error}</div> : null}

      <div className="space-y-4">
        {docs.map((doc) => (
          <div key={doc.id} className="p-5 bg-base-300 rounded-xl border border-white/10">
            <h2 className="text-lg font-semibold text-white">{doc.title}</h2>
            <p className="text-sm text-gray-400 mt-1">Tender Ref: {doc.tender_id}</p>
            <p className="text-sm text-gray-300 mt-2">Size: {doc.size_kb} KB • Status: {doc.status}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Documents;