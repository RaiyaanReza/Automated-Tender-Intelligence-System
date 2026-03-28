import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Building2, CalendarClock, ExternalLink, FileText, ShieldCheck } from 'lucide-react';
import { tenderAPI } from '../../services/api';
import {
  cleanSummaryText,
  extractSummaryBullets,
  formatDateTimeLabel,
  getTenderOrganization,
  resolveTenderSourceUrl,
} from '../../utils/helpers';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const formatDate = (value) => {
  return formatDateTimeLabel(value);
};

const normalizeRef = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';

  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw;
  }
};

const pickFirst = (...values) => {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
};

const Row = ({ label, value }) => (
  <div className="grid grid-cols-1 gap-1 md:grid-cols-4 md:gap-3">
    <div className="text-sm text-gray-400">{label}</div>
    <div className="md:col-span-3 text-sm text-gray-100 break-words">{value || 'N/A'}</div>
  </div>
);

const TenderDetails = () => {
  const { id: legacyId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tender, setTender] = useState(null);

  const tenderRef = normalizeRef(searchParams.get('ref') || legacyId);

  useEffect(() => {
    const load = async () => {
      setTender(null);

      if (!tenderRef) {
        setError('No tender reference provided.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const response = await tenderAPI.resolveByRef(tenderRef);
        setTender(response.data || null);
      } catch (err) {
        try {
          // Fallback lookup for edge cases where backend resolver cannot match.
          const listResponse = await tenderAPI.getAll();
          const items = Array.isArray(listResponse?.data) ? listResponse.data : [];
          const target = normalizeRef(tenderRef).toLowerCase();
          const found = items.find((item) => {
            const tenderId = normalizeRef(item?.tender_id).toLowerCase();
            const rowId = normalizeRef(item?.id).toLowerCase();
            return tenderId === target || rowId === target;
          });
          if (found) {
            setTender(found);
          } else {
            setError(err?.response?.data?.detail || 'Failed to load tender details.');
          }
        } catch {
          setError(err?.response?.data?.detail || 'Failed to load tender details.');
        }
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [tenderRef]);

  const ai = useMemo(() => (tender?.ai_summary && typeof tender.ai_summary === 'object' ? tender.ai_summary : {}), [tender]);
  const detailFields = useMemo(() => (ai?.detail_fields && typeof ai.detail_fields === 'object' ? ai.detail_fields : {}), [ai]);
  const requirements = Array.isArray(ai.key_requirements) ? ai.key_requirements : [];
  const recommendations = Array.isArray(ai.recommendations) ? ai.recommendations : [];
  const detailLink = resolveTenderSourceUrl(tender);
  const deadlineValue = tender?.deadline || ai.closing_date || ai.deadline;
  const publishingDate = pickFirst(ai.publishing_date, detailFields.publishing_date, detailFields.last_update_date_and_time);
  const securityAmount = pickFirst(tender?.value, ai.tender_security_amount, detailFields.tender_security_amount);
  const eligibilityText = cleanSummaryText(pickFirst(ai.eligibility, detailFields.eligibility_of_tenderer, tender?.description));
  const executiveSummary = cleanSummaryText(pickFirst(ai.notes, detailFields.brief_description_of_works, tender?.description, 'No summary available.'));
  const downloadUrl = tender?.tender_id
    ? `${API_BASE}/documents/${encodeURIComponent(tender.tender_id)}/download`
    : '';

  const metadataRows = useMemo(
    () => [
      { label: 'Tender ID', value: tender?.tender_id || tender?.id },
      { label: 'Organization', value: getTenderOrganization(tender) },
      { label: 'Publishing Date', value: formatDate(publishingDate) },
      { label: 'Deadline Date', value: formatDate(deadlineValue) },
      { label: 'Procurement Nature', value: pickFirst(ai.proc_nature, detailFields.procurement_method) },
      { label: 'Risk Level', value: ai.risk_level },
      { label: 'Fit Score', value: ai.fit },
      { label: 'Value / Security', value: securityAmount },
      { label: 'Status', value: tender?.status },
    ].filter((row) => String(row.value || '').trim()),
    [ai.fit, ai.proc_nature, ai.risk_level, deadlineValue, detailFields.procurement_method, publishingDate, securityAmount, tender],
  );

  const requirementRows = (requirements.length === 0 ? extractSummaryBullets(eligibilityText || tender?.description || '', 7) : requirements)
    .map((item) => cleanSummaryText(item))
    .filter((item) => item.length > 0);

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

        <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-3">
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-gray-400">Publishing</p>
            <p className="text-sm font-semibold text-white">{formatDate(publishingDate)}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-gray-400">Security / Value</p>
            <p className="text-sm font-semibold text-white">{securityAmount || 'Not disclosed'}</p>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-gray-400">Risk / Fit</p>
            <p className="text-sm font-semibold text-white">{pickFirst(ai.risk_level, 'Unknown')} / {pickFirst(ai.fit, 'Unknown')}</p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-base-300 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">Tender Metadata</h2>
        {metadataRows.map((row) => <Row key={row.label} label={row.label} value={row.value} />)}

        <div className="grid grid-cols-1 gap-1 md:grid-cols-4 md:gap-3">
          <div className="text-sm text-gray-400">Source Link</div>
          <div className="md:col-span-3 flex flex-wrap items-center gap-3">
            {detailLink ? (
              <a
                href={detailLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-cyan-300 hover:text-cyan-200 underline"
              >
                Open on e-GP <ExternalLink className="h-3 w-3" />
              </a>
            ) : null}
            {downloadUrl ? (
              <a
                href={downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20"
              >
                <FileText className="h-3 w-3" /> Download PDF
              </a>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-base-300 p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">Executive Summary</h2>

        <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Overview</p>
          <p className="text-sm text-gray-200 whitespace-pre-wrap">
            {executiveSummary}
          </p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-100 mb-2">Key Requirements</h3>
          {requirementRows.length === 0 ? <p className="text-sm text-gray-400">No requirements extracted.</p> : (
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-200">
              {requirementRows.map((item, index) => <li key={`${item}-${index}`}>{item}</li>)}
            </ul>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-gray-100 mb-2">Recommendations</h3>
          {recommendations.length === 0 ? <p className="text-sm text-gray-400">No recommendations generated.</p> : (
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-200">
              {recommendations.map((item, index) => <li key={`${item}-${index}`}>{cleanSummaryText(item)}</li>)}
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