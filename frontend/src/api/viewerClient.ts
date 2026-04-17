import axios from 'axios';
import type { Channel, Upload } from '../types/viewer';

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || ''}/api`,
  headers: { 'Content-Type': 'application/json' },
});

export const channelApi = {
  getAll: () => api.get<Channel[]>('/channels'),
  getById: (id: number) => api.get<Channel>(`/channels/${id}`),
};

export const dataApi = {
  uploadCSV: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/data/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  getDates: (channelId: number) => api.get<Upload[]>(`/data/dates/${channelId}`),
  getStats: (channelId: number, startDate: string, endDate: string | null) => {
    if (endDate) return api.get(`/data/stats/${channelId}/${startDate}/${endDate}`);
    return api.get(`/data/stats/${channelId}/${startDate}`);
  },
};

export default api;
