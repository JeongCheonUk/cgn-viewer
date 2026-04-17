export interface Channel {
  id: number;
  name: string;
  created_at: string;
}

export interface Upload {
  id: number;
  upload_date: string;
  file_name: string;
  created_at: string;
}

export interface CloudFrontStat {
  country: string;
  requestCount: number;
  requestPercent: string;
  bytesMB: string;
}

export interface StatsResponse {
  date?: string;
  startDate?: string;
  endDate?: string;
  totalRequests: number;
  stats: CloudFrontStat[];
}

export type SortField = 'country' | 'requestCount' | 'requestPercent' | 'bytesMB';
export type SortOrder = 'asc' | 'desc';
