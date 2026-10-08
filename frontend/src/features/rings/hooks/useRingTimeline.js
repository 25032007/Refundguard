import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getTemporalData } from '../../../services/api.js';

export function useRingTimeline() {
  const [searchParams, setSearchParams] = useSearchParams();
  const asOf = searchParams.get('asOf') || '2011-12-09';
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const fetchTemporalData = useCallback((dateStr) => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getTemporalData(dateStr ? new Date(dateStr).toISOString() : '')
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(err);
          setError(err);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    return fetchTemporalData(asOf);
  }, [asOf, fetchTemporalData]);

  const setAsOf = (date) => {
    const newParams = new URLSearchParams(searchParams);
    newParams.set('asOf', date);
    setSearchParams(newParams);
  };

  return { loading, error, data, asOf, setAsOf };
}
