import { useState, useEffect, useCallback } from 'react';
import { getInvestigations, getDecision } from '../../../services/api.js';

export function useTriageCases() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cases, setCases] = useState([]);
  const [fetchTrigger, setFetchTrigger] = useState(0);

  const retry = useCallback(() => {
    setFetchTrigger((t) => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getInvestigations()
      .then(async (investigationsData) => {
        if (cancelled) return;
        const validData = Array.isArray(investigationsData) ? investigationsData : [];

        // Fetch decisions for all cases since we need them for KPI and Table
        // The current API contract does not provide a bulk decision fetch
        const casesWithDecisions = await Promise.all(
          validData.map(async (inv) => {
            try {
              const dec = await getDecision(inv.customer.customerId);
              return { ...inv, decision: dec.decision };
            } catch (e) {
              return { ...inv, decision: 'UNREVIEWED' }; // fallback if missing
            }
          })
        );

        if (!cancelled) {
          setCases(casesWithDecisions);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          console.error(e);
          setError(e);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchTrigger]);

  return { loading, error, cases, retry };
}
