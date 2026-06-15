import type { GeoEvent } from '../types';
import * as THREE from 'three';

export interface LayerPlugin {
  id: string;
  label: string;
  fetchEvents(params: Record<string, string>): Promise<GeoEvent[]>;
  createMarkers(events: GeoEvent[], cameraDistance: number): THREE.Group;
  updateAnimation?(group: THREE.Group, time: number, delta: number): void;
  defaultVisible: boolean;
  pollIntervalMs: number;
}
