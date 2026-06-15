export interface LayerInfo {
  id: number;
  type: string;
  enabled: boolean;
  last_sync: string | null;
}

export interface GeoEvent {
  id: number;
  type: string;
  source: string;
  latitude: number;
  longitude: number;
  magnitude?: number;
  depth_km?: number;
  timestamp: string;
  metadata: Record<string, unknown>;
}

export interface EventsResponse {
  status: string;
  data: GeoEvent[];
  total?: number;
}

export interface ConfigResponse {
  status: string;
  data: {
    layers: LayerInfo[];
  };
}

export interface RefreshResponse {
  status: string;
  data: {
    sync_status: string;
    message: string;
  };
}
