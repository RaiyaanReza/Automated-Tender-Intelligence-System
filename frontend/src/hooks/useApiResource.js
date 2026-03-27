import { useCallback, useEffect, useState } from 'react';

export default function useApiResource(fetcher) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetcher();
      if (Array.isArray(response.data)) {
        setData(response.data);
      } else if (response.data && typeof response.data === 'object') {
        setData([response.data]);
      } else {
        setData([]);
      }
    } catch (err) {
      setError(err?.response?.data?.detail || 'Failed to load data.');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [fetcher]);

  useEffect(() => {
    load();
  }, [load]);

  return {
    data,
    loading,
    error,
    reload: load,
  };
}
