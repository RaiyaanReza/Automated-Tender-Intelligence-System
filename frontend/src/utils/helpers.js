const EGP_BASE = 'https://www.eprocure.gov.bd/resources/common/';

const toStringSafe = (value) => String(value || '').trim();

const isHttpUrl = (value) => value.startsWith('http://') || value.startsWith('https://');

const isDisallowedProtocol = (value) =>
	value.startsWith('javascript:') || value.startsWith('data:') || value.startsWith('about:');

const isGenericListingUrl = (value) => /alltenders\.jsp/i.test(value);

export const buildTenderCanonicalUrl = (tenderId) => {
	const id = toStringSafe(tenderId);
	if (!id || !/^\d{5,}$/.test(id)) return '';
	return `${EGP_BASE}ViewTender.jsp?id=${id}&h=t`;
};

export const resolveTenderSourceUrl = (tender) => {
	const ai = tender?.ai_summary && typeof tender.ai_summary === 'object' ? tender.ai_summary : {};
	const candidates = [ai.source_url, ai.detail_url, tender?.source_url, tender?.detail_url];

	for (const raw of candidates) {
		const value = toStringSafe(raw);
		if (!value || isDisallowedProtocol(value)) continue;
		try {
			const normalized = isHttpUrl(value) ? value : new URL(value, EGP_BASE).toString();
			if (isDisallowedProtocol(normalized) || isGenericListingUrl(normalized)) {
				continue;
			}
			return normalized;
		} catch {
			// Try next candidate.
		}
	}

	return buildTenderCanonicalUrl(tender?.tender_id);
};

export const getTenderOrganization = (tender) => {
	const ai = tender?.ai_summary && typeof tender.ai_summary === 'object' ? tender.ai_summary : {};
	const candidates = [
		tender?.organization,
		ai.procuring_entity,
		ai.organization,
		ai.buyer_name,
	];

	for (const value of candidates) {
		const clean = toStringSafe(value);
		if (clean) return clean;
	}
	return 'Unknown organization';
};

export const formatDateTimeLabel = (value) => {
	if (!value) return 'N/A';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return String(value);
	return date.toLocaleString();
};

