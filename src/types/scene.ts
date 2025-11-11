/**
 * Type definitions for the Classroom Compositor scene graph.
 */

/**
 * Transform properties for a layer.
 */
export interface Transform {
  /** Position in pixels */
  pos: { x: number; y: number };
  /** Scale factor (1.0 = 100%) */
  scale: { x: number; y: number };
  /** Rotation in degrees */
  rot: number;
  /** Opacity 0.0 to 1.0 */
  opacity: number;
}

/**
 * Base layer properties shared by all layer types.
 */
export interface BaseLayer {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Visibility toggle */
  visible: boolean;
  /** Lock state (prevents editing) */
  locked: boolean;
  /** Parent group ID, if nested */
  parentId?: string | null;
  /** Z-order for rendering */
  z: number;
  /** Transform properties */
  transform: Transform;
}

/**
 * Screen capture layer.
 */
export interface ScreenLayer extends BaseLayer {
  type: 'screen';
  /** MediaStream track ID for screen capture */
  streamId?: string;
}

/**
 * Camera (webcam) layer with circle mask and soft border.
 */
export interface CameraLayer extends BaseLayer {
  type: 'camera';
  /** MediaStream track ID for camera */
  streamId?: string;
  /** Diameter in pixels for the circular mask before transform scale */
  diameter: number;
  /** Offset of the video content relative to the mask center (scene units) */
  videoOffset?: { x: number; y: number };
  /** Additional scale factor applied to the video inside the mask */
  videoScale?: number;
}

/**
 * Image overlay layer.
 */
export interface ImageLayer extends BaseLayer {
  type: 'image';
  /** Asset reference (URI or embedded blob ID) */
  assetId: string;
  /** Image dimensions */
  width: number;
  height: number;
  /** Embedded data URI for local images (temporary until asset pipeline) */
  dataUri?: string;
  /** Maintain uniform scaling when resizing */
  scaleLocked?: boolean;
}

/**
 * Text pill layer with styling options.
 */
export interface TextLayer extends BaseLayer {
  type: 'text';
  /** Text content */
  content: string;
  /** Font family */
  font: string;
  /** Font size in pixels */
  fontSize: number;
  /** Text alignment */
  textAlign: 'left' | 'center' | 'right';
  /** Text color */
  textColor: string;
  /** Background color (CSS color string) */
  backgroundColor: string;
  /** Border radius in pixels */
  borderRadius: number;
  /** Padding in pixels */
  padding: number;
  /** Shadow CSS string */
  shadow: string;
  /** Auto-size text to fit content */
  autoSize: boolean;
}

/**
 * Rectangle shape layer.
 */
export interface ShapeLayer extends BaseLayer {
  type: 'shape';
  /** Shape type (currently only 'rect') */
  shapeType: 'rect';
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** Fill color (CSS color string) */
  fillColor: string;
  /** Stroke color (CSS color string) */
  strokeColor?: string;
  /** Stroke width in pixels */
  strokeWidth?: number;
  /** Maintain uniform scaling when resizing */
  scaleLocked?: boolean;
}

/**
 * Group layer that contains child layers.
 */
export interface GroupLayer extends BaseLayer {
  type: 'group';
  /** Array of child layer IDs */
  children: string[];
  /** Per-child visibility state (preserved when group toggles) */
  childVisibility?: Record<string, boolean>;
}

/**
 * Discriminated union of all layer types.
 */
export type Layer = ScreenLayer | CameraLayer | ImageLayer | TextLayer | ShapeLayer | GroupLayer;

/**
 * Scene data structure containing canvas dimensions and layers.
 */
export interface Scene {
  /** Scene identifier (for persistence) */
  id?: string;
  /** Scene name */
  name?: string;
  /** Canvas width in pixels */
  width: number;
  /** Canvas height in pixels */
  height: number;
  /** Ordered array of layers */
  layers: Layer[];
}
