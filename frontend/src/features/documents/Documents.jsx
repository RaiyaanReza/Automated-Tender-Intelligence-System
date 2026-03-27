import useApiResource from '../../hooks/useApiResource';
import { documentAPI } from '../../services/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const Documents = () => {
  const { data: docs, loading, error } = useApiResource(documentAPI.getAll);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Documents</h1>

      {loading ? <div className="p-6 bg-base-300 rounded-xl border border-white/10 text-gray-300">Loading documents...</div> : null}
      {error ? <div className="p-6 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300">{error}</div> : null}

      {!loading && !error && docs.length === 0 ? (
        <div className="p-6 bg-base-300 rounded-xl border border-white/10 text-gray-300">No downloadable tender PDFs available yet.</div>
      ) : null}

      <div className="space-y-4">
        {docs.map((doc) => {
          const href = doc.download_url ? `${API_BASE}${doc.download_url}` : '';
          return (
            <div key={doc.id} className="p-5 bg-base-300 rounded-xl border border-white/10">
              <h2 className="text-lg font-semibold text-white">{doc.title}</h2>
              <p className="text-sm text-gray-400 mt-1">Tender Ref: {doc.tender_id}</p>
              <p className="text-sm text-gray-300 mt-2">Size: {doc.size_kb} KB • Status: {doc.status}</p>
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex mt-3 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-300 hover:bg-cyan-500/20"
                >
                  Download PDF
                </a>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Documents;