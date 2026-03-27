import { useCallback, useEffect, useState } from 'react';
import { tenderAPI } from '../services/api';
import { getTenderOrganization } from '../utils/helpers';

const DAYS_WINDOW = 30;

const formatDateLabel = (value) => {
	if (!value) return 'No deadline';

	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return 'No deadline';

	const now = new Date();
	const diffMs = date.getTime() - now.getTime();
	const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
	if (diffDays < 0) return 'Closed';
	if (diffDays === 0) return 'Today';
	return `${diffDays} days left`;
};

const normalizeTender = (tender) => ({
	...tender,
	organization: getTenderOrganization(tender),
	deadlineLabel: formatDateLabel(tender.deadline),
	priority: tender.priority || 'Low',
	value: tender.value || 'N/A',
	status: tender.status || 'new',
});

const asTime = (value) => {
	const ts = new Date(value).getTime();
	return Number.isNaN(ts) ? Number.MAX_SAFE_INTEGER : ts;
};

const isWithinRecentWindow = (deadline, days = DAYS_WINDOW) => {
	if (!deadline) return false;
	const date = new Date(deadline);
	if (Number.isNaN(date.getTime())) return false;

	const now = new Date();
	const diffDays = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
	return diffDays >= -days && diffDays <= days;
};

const hasKeywordTrace = (tender) => {
	const ai = tender?.ai_summary;
	return Boolean(ai && typeof ai === 'object' && ai.keyword);
};

export default function useTenders() {
	const [tenders, setTenders] = useState([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');
	const [stats, setStats] = useState({
		total: 0,
		relevant: 0,
		pending: 0,
		successRate: '0%',
	});

	const loadTenders = useCallback(async () => {
		setLoading(true);
		setError('');
		try {
			const [response, statsResponse] = await Promise.all([
				tenderAPI.getAll(),
				tenderAPI.getDashboardStats(),
			]);
			const payload = Array.isArray(response.data) ? response.data : [];
			const recent = payload.filter((item) => isWithinRecentWindow(item?.deadline));
			const keywordRecent = recent.filter(hasKeywordTrace);
			const effective = (keywordRecent.length > 0 ? keywordRecent : recent)
				.sort((a, b) => asTime(a.deadline) - asTime(b.deadline));

			setTenders(effective.map(normalizeTender));

			const relevant = effective.filter((item) => ['High', 'Urgent'].includes(item.priority)).length;
			const pending = effective.filter((item) => ['new', 'review', 'PENDING_ANALYSIS'].includes(item.status)).length;
			const total = effective.length;
			const successRate = total > 0 ? `${Math.round((relevant / total) * 100)}%` : '0%';

			const serverStats = statsResponse?.data || {};
			setStats({
				total,
				relevant,
				pending,
				successRate: typeof serverStats.success_rate === 'string' && total === 0 ? serverStats.success_rate : successRate,
			});
		} catch (err) {
			setError(err?.response?.data?.detail || 'Failed to load tenders.');
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadTenders();
	}, [loadTenders]);

	useEffect(() => {
		const interval = setInterval(() => {
			loadTenders();
		}, 30 * 60 * 1000);
		return () => clearInterval(interval);
	}, [loadTenders]);

	return {
		tenders,
		loading,
		error,
		stats,
		reload: loadTenders,
	};
}
