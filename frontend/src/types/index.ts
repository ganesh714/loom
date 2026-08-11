export interface Position {
  x: number;
  y: number;
}

export interface Dimensions {
  width: number;
  height: number;
}

export interface NodeStyle {
  backgroundColor?: string;
  borderColor?: string;
  color?: string;
  fontSize?: string;
  fontFamily?: string;
  borderRadius?: string;
  boxShadow?: string;
  fontWeight?: string;
  textAlign?: 'left' | 'center' | 'right';
  opacity?: string;
  clipPath?: string;
  background?: string;
  transform?: string;
  backdropFilter?: string;
  filter?: string;
  borderWidth?: string;
  borderStyle?: string;
  customCss?: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface Connection {
  nodeId: string;
  anchor: 'top' | 'bottom' | 'left' | 'right' | 'closest';
  offset?: number; // 0 to 100 percentage. 50 is center.
}

export interface NodeSection {
  title?: string;
  items: string[];
  style?: Partial<NodeStyle>;
}

export type SemanticTag = 
  'interface' | 'abstract' | 'class' | 'enum' | 'object' |
  'service' | 'controller' | 'repository' | 'entity' |
  'client' | 'server' | 'database' | 'queue' | 'cache' | 'gateway' |
  'input' | 'output' | 'decision' | 'start' | 'end';

export type ArrowHeadType = 
  'filled' | 'hollow' | 'open' | 
  'diamond-filled' | 'diamond-hollow' | 
  'circle' | 'none';

export type NodeType = 
  // Existing
  'box' | 'rectangle' | 'diamond' | 'circle' | 'triangle' | 'star' | 'pill' |
  'hexagon' | 'parallelogram' | 'database' | 'note' | 'path' | 'comment' |
  'line' | 'arrow' |
  // UML
  'uml-class' | 'uml-interface' | 'uml-abstract' | 'uml-enum' |
  'actor' | 'use-case' | 'component' |
  // Flowchart
  'rounded-rect' | 'terminator' | 'process' | 'document' |
  'manual-input' | 'decision-merge' | 'io-data' |
  // Architecture / Infrastructure
  'cylinder' | 'cloud' | 'queue' | 'browser' | 'mobile' | 'server' |
  // Layout / Annotation
  'group-frame' | 'callout' | 'badge' | 'text' |
  // Power-user escape hatches
  'custom-block' | 'custom-connector';

export interface DiagramNode {
  id: string;
  type: NodeType;
  position: Position;
  dimensions: Dimensions;
  content: string;
  style?: NodeStyle;
  rotation?: number;
  startPoint?: Point;
  endPoint?: Point;
  startConnection?: Connection;
  endConnection?: Connection;
  lineStyle?: 'solid' | 'dashed' | 'dotted' | 'double';
  lineCurve?: 'straight' | 'curved';
  arrowType?: 'none' | 'single' | 'double';
  points?: Point[];
  customConnectorStyle?: Record<string, string | number>;
  groupId?: string;

  // Connector enhancements
  arrowHead?: ArrowHeadType;
  arrowTail?: ArrowHeadType;
  routing?: 'straight' | 'curved' | 'elbow';
  label?: string;
  labelPosition?: 'mid' | 'start' | 'end';
  waypoints?: Point[];

  // UML / rich node enhancements
  stereotype?: string;
  sections?: NodeSection[];
  tag?: SemanticTag;

  // Grouping
  groupTitle?: string;
  groupColor?: string;
}
