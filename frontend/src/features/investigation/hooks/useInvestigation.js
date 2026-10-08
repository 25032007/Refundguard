import { useState, useEffect } from 'react';
import { getInvestigation, getDecision, updateDecision } from '../../../services/api.js';

export function useInvestigation(id) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [investigation, setInvestigation] = useState(null);
  const [decision, setDecision] = useState('UNREVIEWED');
  const [auditTrigger, setAuditTrigger] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([getInvestigation(id), getDecision(id)])
      .then(([invData, decData]) => {
        if (!cancelled) {
          setInvestigation(invData);
          setDecision(decData.decision);
        }
      })
      .catch((e) => {
        if (!cancelled) {
          console.error(e);
          setError(e);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  const saveDecision = async (newDecision, reason) => {
    const updated = await updateDecision(id, { decision: newDecision, analystId: 'analyst-1', reason });
    setDecision(updated.decision);
    setAuditTrigger(t => t + 1);
  };

  return {
    loading,
    error,
    investigation,
    decision,
    auditTrigger,
    saveDecision
  };
}
