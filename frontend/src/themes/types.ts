export interface GlobeTheme {
  id: string;
  name: string;
  description: string;
  /** URL of the earth texture, or null for procedural */
  earthTextureUrl: string | null;
  /** Fallback if texture fails to load */
  earthFallbackColor: number;
  /** Atmosphere/scene background color */
  backgroundColor: number | string;
  /** Ambient light color */
  ambientColor: number;
  /** Ambient light intensity */
  ambientIntensity: number;
  /** Directional light color */
  directionalColor: number;
  /** Directional light intensity */
  directionalIntensity: number;
  /** Grid layer color */
  gridColor: number;
  /** Grid layer opacity */
  gridOpacity: number;
  /** Country border color */
  borderColor: number;
  /** Country border opacity */
  borderOpacity: number;
  /** Marker color scheme name */
  markerScheme: 'default' | 'hot' | 'cool' | 'mono';
  /** Whether to show starfield background */
  showStarfield: boolean;
  /** Starfield color tint */
  starfieldColor?: number;
  /** Globe material properties */
  roughness: number;
  metalness: number;
  /** Whether to add atmosphere glow effect */
  atmosphereGlow: boolean;
  /** Atmosphere glow color */
  atmosphereColor?: number;
  /** Thumbnail/preview description */
  preview: string;
}
