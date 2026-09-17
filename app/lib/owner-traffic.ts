export const OWNER_TRAFFIC_RANGES = ["24h", "7d", "30d"] as const;

export type OwnerTrafficRange = (typeof OWNER_TRAFFIC_RANGES)[number];

export type OwnerTrafficSource = {
  source: string;
  visitors: number;
  pageviews: number;
};

export type OwnerTrafficReport = {
  range: OwnerTrafficRange;
  since: string;
  until: string;
  fetchedAt: string;
  visitors: number;
  pageviews: number;
  searches: number | null;
  outboundClicks: number | null;
  sources: OwnerTrafficSource[] | null;
  partial: boolean;
  warnings: string[];
};
