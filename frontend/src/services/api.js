import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:5000/api/v1',
});

export async function getInvestigations() {
  const { data } = await api.get('/investigations');
  return data;
}

export async function getInvestigation(customerId) {
  const { data } = await api.get(`/investigations/${customerId}`);
  return data;
}

export default api;
