import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api/v1',
});

// Single API client exports
export async function getSummary() {
  const { data } = await api.get('/summary');
  return data;
}

export async function getHealth() {
  const { data } = await api.get('/health');
  return data;
}

export async function getInvestigations(params = {}) {
  const { data } = await api.get('/investigations', { params });
  return data;
}

export async function getInvestigation(customerId) {
  const { data } = await api.get(`/investigations/${customerId}`);
  return data;
}

export async function getRings(params = {}) {
  const { data } = await api.get('/rings', { params });
  return data;
}

export async function getRing(ringId) {
  const { data } = await api.get(`/rings/${ringId}`);
  return data;
}

export async function getRingLifecycle(ringId) {
  const { data } = await api.get(`/rings/${ringId}/lifecycle`);
  return data;
}

export async function getAuditHistory(customerId) {
  const { data } = await api.get(`/investigations/${customerId}/history`);
  return data;
}

export async function updateDecision({ customerId, decision, reason, expectedVersion, analystId = 'ui-user' }) {
  const { data } = await api.put(
    `/investigations/${customerId}/decision`,
    { decision, reason, expectedVersion },
    { headers: { 'X-Analyst-Id': analystId } }
  );
  return data;
}

export default api;
