import { Building2, Clock, DollarSign } from 'lucide-react';
import { Link } from 'react-router-dom';
import useTenders from '../../hooks/useTenders';
import { buildTenderDetailsPath, getTenderOrganization, resolveTenderSourceUrl } from '../../utils/helpers';

const Tenders = () => {
  const { tenders, loading, error } = useTenders();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">All Tenders</h1>

      {loading ? (
        <div className="p-6 bg-base-300 rounded-xl border border-white/10 text-gray-300">Loading tenders...</div>
      ) : null}

      {error ? (
        <div className="p-6 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300">{error}</div>
      ) : null}

      {!loading && !error && tenders.length === 0 ? (
        <div className="p-6 bg-base-300 rounded-xl border border-white/10">
          <p className="text-gray-400">No tenders found in the database.</p>
        </div>
      ) : null}

      <div className="space-y-4">
        {tenders.map((tender) => {
          const sourceLink = resolveTenderSourceUrl(tender);
          return (
          <div key={tender.id} className="p-5 bg-base-300 rounded-xl border border-white/10">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Link to={buildTenderDetailsPath(tender)} className="text-lg font-semibold text-white hover:text-cyan-300 underline-offset-4 hover:underline">
                  {tender.title}
                </Link>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-400">
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="h-4 w-4" />
                    {getTenderOrganization(tender)}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-4 w-4 text-amber-400" />
                    {tender.deadlineLabel}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <DollarSign className="h-4 w-4 text-emerald-400" />
                    {tender.value}
                  </span>
                  {tender?.ai_summary?.keyword ? (
                    <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-xs text-cyan-300">
                      {tender.ai_summary.keyword}
                    </span>
                  ) : null}
                  {sourceLink ? (
                    <a
                      href={sourceLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-gray-300 hover:text-cyan-300 underline"
                    >
                      Source Link
                    </a>
                  ) : null}
                </div>
              </div>
              <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-300">
                {tender.priority}
              </span>
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
};

export default Tenders;