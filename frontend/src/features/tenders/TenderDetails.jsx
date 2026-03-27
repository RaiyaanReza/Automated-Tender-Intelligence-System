import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, CalendarClock, ExternalLink, FileText, ShieldCheck } from 'lucide-react';
import { tenderAPI } from '../../services/api';
import { formatDateTimeLabel, getTenderOrganization, resolveTenderSourceUrl } from '../../utils/helpers';

const formatDate = (value) => {
  return formatDateTimeLabel(value);
};

const Row = ({ label, value }) => (
  <div className="grid grid-cols-1 gap-1 md:grid-cols-4 md:gap-3">
    <div className="text-sm text-gray-400">{label}</div>
    <div className="md:col-span-3 text-sm text-gray-100 break-words">{value || 'N/A'}</div>
  </div>
);

const TenderDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tender, setTender] = useState(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await tenderAPI.getById(id);
        setTender(response.data || null);
      } catch (err) {
        setError(err?.response?.data?.detail || 'Failed to load tender details.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const ai = useMemo(() => (tender?.ai_summary && typeof tender.ai_summary === 'object' ? tender.ai_summary : {}), [tender]);
  const requirements = Array.isArray(ai.key_requirements) ? ai.key_requirements : [];
  const recommendations = Array.isArray(ai.recommendations) ? ai.recommendations : [];
  const detailLink = resolveTenderSourceUrl(tender);
  const deadlineValue = tender.deadline || ai.closing_date || ai.deadline;

  if (loading) {
    return <div className="p-6 bg-base-300 rounded-xl border border-white/10 text-gray-300">Loading tender details...</div>;
  }

  if (error) {
    return <div className="p-6 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300">{error}</div>;
  }

  if (!tender) {
    return <div className="p-6 bg-base-300 rounded-xl border border-white/10 text-gray-300">No tender found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => navigate('/tenders')}
          className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 text-sm text-gray-200 hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Tenders
        </button>
        <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-semibold text-red-300">{tender.priority || 'Low'}</span>
      </div>

      <div className="rounded-2xl border border-white/10 bg-base-300 p-6 space-y-3">
        <h1 className="text-2xl font-bold text-white">{tender.title}</h1>
        <div className="flex flex-wrap gap-3 text-sm text-gray-400">
          <span className="inline-flex items-center gap-1"><Building2 className="h-4 w-4" /> {getTenderOrganization(tender)}</span>
          <span className="inline-flex items-center gap-1"><CalendarClock className="h-4 w-4" /> Deadline: {formatDate(deadlineValue)}</span>
          <span className="inline-flex items-center gap-1"><ShieldCheck className="h-4 w-4" /> Status: {tender.status || 'new'}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-base-300 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">Tender Metadata</h2>
        <Row label="Tender ID" value={tender.tender_id} />
        <Row label="Deadline Date" value={formatDate(deadlineValue)} />
        <Row label="Keyword Match" value={ai.keyword} />
        <Row label="Procurement Nature" value={ai.proc_nature} />
        <Row label="Publishing Date" value={ai.publishing_date} />
        <Row label="Risk Level" value={ai.risk_level} />
        <Row label="Fit" value={ai.fit} />
        <Row label="Notes" value={ai.notes} />
        <Row label="Value / Security" value={tender.value} />
        <Row label="PDF Saved Path" value={ai.pdf_saved_path} />
        <div className="grid grid-cols-1 gap-1 md:grid-cols-4 md:gap-3">
          <div className="text-sm text-gray-400">Source Link</div>
          <div className="md:col-span-3">
            {detailLink ? (
              <a
                href={detailLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-cyan-300 hover:text-cyan-200 underline"
              >
                Open on e-GP <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="text-sm text-gray-100">N/A</span>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-base-300 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">AI Summary</h2>
        <p className="text-sm text-gray-200 whitespace-pre-wrap">{tender.description || 'No description available.'}</p>

        <div>
          <h3 className="text-sm font-semibold text-gray-100 mb-2">Key Requirements</h3>
          {requirements.length === 0 ? <p className="text-sm text-gray-400">No requirements extracted.</p> : (
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-200">
              {requirements.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
            </ul>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-100 mb-2">Recommendations</h3>
          {recommendations.length === 0 ? <p className="text-sm text-gray-400">No recommendations generated.</p> : (
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-200">
              {recommendations.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
            </ul>
          )}
        </div>

        {ai.pdf_saved_path ? (
          <div className="inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-300">
            <FileText className="h-4 w-4" /> PDF text source captured
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default TenderDetails;