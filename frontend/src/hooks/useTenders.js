import { useCallback, useEffect, useState } from 'react';
import { tenderAPI } from '../services/api';

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
	deadlineLabel: formatDateLabel(tender.deadline),
	priority: tender.priority || 'Low',
	value: tender.value || 'N/A',
	status: tender.status || 'new',
});

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
			setTenders(payload.map(normalizeTender));

			const serverStats = statsResponse?.data || {};
			setStats({
				total: Number.isFinite(serverStats.total) ? serverStats.total : payload.length,
				relevant: Number.isFinite(serverStats.relevant) ? serverStats.relevant : 0,
				pending: Number.isFinite(serverStats.pending) ? serverStats.pending : 0,
				successRate: typeof serverStats.success_rate === 'string' ? serverStats.success_rate : '0%',
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

	return {
		tenders,
		loading,
		error,
		stats,
		reload: loadTenders,
	};
}
