import type { DiagramNode, NodeType, NodeSection, ArrowHeadType } from '../types';
import { autoLayoutNodes } from './layoutEngine';

const generateId = () => Math.random().toString(36).substring(2, 9);

// ─── MAIN ENTRY ────────────────────────────────────────────────────

export function parseMermaid(code: string): DiagramNode[] | null {
  const trimmed = code.trim();
  const firstLine = trimmed.split('\n')[0].trim().toLowerCase();

  const unsupportedTypes = [
    'sequencediagram', 'gantt', 'pie', 'gitgraph', 'xychart', 
    'journey', 'timeline', 'quadrantchart', 'sankey-beta', 'block-beta'
  ];

  if (unsupportedTypes.some(type => firstLine.startsWith(type))) {
    const typeName = firstLine.split(/\s+/)[0];
    throw new Error(`The diagram type '${typeName}' is not supported because it represents a timeline or chart rather than a spatial node canvas. Please use flowchart, classDiagram, stateDiagram, erDiagram, or mindmap.`);
  }

  if (firstLine.startsWith('classdiagram')) {
    return parseClassDiagram(trimmed);
  }
  if (firstLine.startsWith('statediagram')) {
    return parseStateDiagram(trimmed);
  }
  if (firstLine.startsWith('erdiagram')) {
    return parseErDiagram(trimmed);
  }
  if (firstLine.startsWith('mindmap')) {
    return parseMindmap(trimmed);
  }
  // Default: flowchart / graph
  return parseFlowchart(trimmed);
}

// ─── FLOWCHART PARSER ──────────────────────────────────────────────

const flowEdgeSplitRegex = /(-->|---|-\.->|==>)/;

const parseFlowNode = (nodeStr: string): { id: string; content: string; type: NodeType } => {
  nodeStr = nodeStr.trim();
  const nodeRegex = /^([a-zA-Z0-9_-]+)(?:\[\((.*?)\)\]|\[\/(.*?)\/\]|\(\((.*?)\)\)|\{(.*?)\}|\(\[(.*?)\]\)|\((.*?)\)|\[(.*?)\])?$/;
  const match = nodeStr.match(nodeRegex);
  if (!match) return { id: nodeStr, content: nodeStr, type: 'box' };

  const id = match[1];
  let type: NodeType = 'box';
  let content = id;

  if (match[2] !== undefined) { type = 'database'; content = match[2]; }
  else if (match[3] !== undefined) { type = 'parallelogram'; content = match[3]; }
  else if (match[4] !== undefined) { type = 'circle'; content = match[4]; }
  else if (match[5] !== undefined) { type = 'diamond'; content = match[5]; }
  else if (match[6] !== undefined) { type = 'pill'; content = match[6]; }
  else if (match[7] !== undefined) { type = 'rounded-rect'; content = match[7]; }
  else if (match[8] !== undefined) { type = 'box'; content = match[8]; }

  return { id, content, type };
};

function createFlowNode(id: string, content: string, type: NodeType, groupId: string | null): DiagramNode {
  return {
    id, type,
    position: { x: 0, y: 0 },
    dimensions: { width: 140, height: 60 },
    content,
    groupId: groupId || undefined,
    style: { backgroundColor: '#0d1117' }
  };
}

function parseFlowchart(code: string): DiagramNode[] | null {
  const lines = code.split('\n');
  const nodes = new Map<string, DiagramNode>();
  const edges: DiagramNode[] = [];
  let currentGroup: string | null = null;
  const groups = new Map<string, string[]>();

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('%%')) continue;
    if (line.startsWith('graph ') || line.startsWith('flowchart ')) continue;

    if (line.startsWith('subgraph ')) {
      const match = line.match(/^subgraph\s+([a-zA-Z0-9_-]+)(?:\s*\[(.*?)\])?/);
      if (match) {
        currentGroup = match[1];
        const groupLabel = match[2] || match[1];
        nodes.set(currentGroup, {
          id: currentGroup, type: 'group-frame',
          position: { x: 0, y: 0 }, dimensions: { width: 300, height: 300 },
          content: groupLabel, style: { backgroundColor: 'transparent' }
        });
        groups.set(currentGroup, []);
      }
      continue;
    }
    if (line === 'end' && currentGroup) { currentGroup = null; continue; }

    let label = '';
    const pipeLabelMatch = line.match(/\|(.*?)\|/);
    if (pipeLabelMatch) { label = pipeLabelMatch[1]; line = line.replace(`|${label}|`, ''); }
    const textLabelMatch = line.match(/--\s+(.*?)\s+-->/);
    if (textLabelMatch) { label = textLabelMatch[1]; line = line.replace(textLabelMatch[0], '-->'); }

    const parts = line.split(flowEdgeSplitRegex);
    if (parts.length >= 3) {
      const left = parseFlowNode(parts[0]);
      const edgeTypeStr = parts[1];
      const right = parseFlowNode(parts.slice(2).join(''));

      let lineStyle: 'solid' | 'dashed' | 'dotted' | 'double' = 'solid';
      let arrowType: 'none' | 'single' | 'double' = 'single';
      if (edgeTypeStr === '---') arrowType = 'none';
      else if (edgeTypeStr === '-.->') lineStyle = 'dashed';
      else if (edgeTypeStr === '==>') lineStyle = 'double';

      // Upsert nodes
      for (const info of [left, right]) {
        if (!nodes.has(info.id)) {
          nodes.set(info.id, createFlowNode(info.id, info.content, info.type, currentGroup));
          if (currentGroup) groups.get(currentGroup)?.push(info.id);
        } else if (info.content !== info.id) {
          const existing = nodes.get(info.id)!;
          existing.content = info.content;
          existing.type = info.type;
        }
      }

      edges.push({
        id: `edge_${generateId()}`, type: arrowType === 'none' ? 'line' : 'arrow',
        position: { x: 0, y: 0 }, dimensions: { width: 0, height: 0 }, content: '',
        label, lineStyle, arrowType,
        startConnection: { nodeId: left.id, anchor: 'closest' },
        endConnection: { nodeId: right.id, anchor: 'closest' }
      });
    } else {
      const info = parseFlowNode(line);
      if (info.id && !nodes.has(info.id)) {
        nodes.set(info.id, createFlowNode(info.id, info.content, info.type, currentGroup));
        if (currentGroup) groups.get(currentGroup)?.push(info.id);
      } else if (info.id && nodes.has(info.id)) {
        const existing = nodes.get(info.id)!;
        existing.content = info.content;
        existing.type = info.type;
      }
    }
  }

  return layoutResult(nodes, edges);
}

// ─── CLASS DIAGRAM PARSER ──────────────────────────────────────────

function parseClassDiagram(code: string): DiagramNode[] | null {
  const lines = code.split('\n');
  const nodes = new Map<string, DiagramNode>();
  const edges: DiagramNode[] = [];

  let currentClassName: string | null = null;
  let currentMethods: string[] = [];
  let currentProperties: string[] = [];
  let currentStereotype: string | undefined = undefined;

  // Class diagram edge regex:
  // Matches: A --> B, A --|> B, A ..> B, A ..|> B, A -- B
  // With optional label: A --> B : label
  const classEdgeRegex = /^([a-zA-Z0-9_]+)\s+(-->|--|>|\.\.>|\.\.\|>|--|\*--|o--|<\|--|<\.\.)\s+([a-zA-Z0-9_]+)(?:\s*:\s*(.*))?$/;

  const flushClass = () => {
    if (!currentClassName) return;

    const isInterface = currentStereotype === 'interface';
    const isAbstract = currentStereotype === 'abstract';
    const isEnum = currentStereotype === 'enumeration';

    let type: NodeType = 'uml-class';
    if (isInterface) type = 'uml-interface';
    else if (isAbstract) type = 'uml-abstract';
    else if (isEnum) type = 'uml-enum';

    const sections: NodeSection[] = [];
    if (currentProperties.length > 0) {
      sections.push({ title: 'Properties', items: currentProperties });
    }
    if (currentMethods.length > 0) {
      sections.push({ title: 'Methods', items: currentMethods });
    }

    // Calculate dimensions based on content
    const longestItem = [currentClassName, ...currentProperties, ...currentMethods]
      .reduce((a, b) => a.length > b.length ? a : b, '');
    const width = Math.max(180, longestItem.length * 8 + 40);
    const height = Math.max(80, 40 + (currentProperties.length + currentMethods.length) * 22 + 20);

    nodes.set(currentClassName, {
      id: currentClassName,
      type,
      position: { x: 0, y: 0 },
      dimensions: { width, height },
      content: currentClassName,
      stereotype: currentStereotype,
      sections,
      tag: isInterface ? 'interface' : isAbstract ? 'abstract' : isEnum ? 'enum' : 'class',
      style: { backgroundColor: '#0d1117' }
    });

    currentClassName = null;
    currentMethods = [];
    currentProperties = [];
    currentStereotype = undefined;
  };

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('%%')) continue;
    if (line.toLowerCase().startsWith('classdiagram')) continue;
    if (line.toLowerCase().startsWith('direction ')) continue;

    // Opening a class block: class ClassName {
    const classBlockMatch = line.match(/^class\s+([a-zA-Z0-9_]+)\s*\{\s*$/);
    if (classBlockMatch) {
      flushClass();
      currentClassName = classBlockMatch[1];
      continue;
    }

    // Closing brace
    if (line === '}') {
      flushClass();
      continue;
    }

    // Inside a class block
    if (currentClassName) {
      // Stereotype: <<interface>>
      const stereoMatch = line.match(/^<<\s*(.*?)\s*>>$/);
      if (stereoMatch) {
        currentStereotype = stereoMatch[1].toLowerCase();
        continue;
      }

      // Method or property line (e.g., +createProductA() AbstractProductA)
      const memberLine = line.replace(/^\s*/, '');
      if (memberLine) {
        if (memberLine.includes('(')) {
          currentMethods.push(memberLine);
        } else {
          currentProperties.push(memberLine);
        }
      }
      continue;
    }

    // Simple class declaration without block: class ConcreteProductA1
    const simpleClassMatch = line.match(/^class\s+([a-zA-Z0-9_]+)\s*$/);
    if (simpleClassMatch) {
      const className = simpleClassMatch[1];
      if (!nodes.has(className)) {
        nodes.set(className, {
          id: className, type: 'uml-class',
          position: { x: 0, y: 0 },
          dimensions: { width: Math.max(180, className.length * 8 + 40), height: 50 },
          content: className,
          tag: 'class',
          style: { backgroundColor: '#0d1117' }
        });
      }
      continue;
    }

    // Edge/relationship line
    const edgeMatch = line.match(classEdgeRegex);
    if (edgeMatch) {
      const sourceId = edgeMatch[1];
      const edgeTypeStr = edgeMatch[2];
      const targetId = edgeMatch[3];
      const label = edgeMatch[4]?.trim() || '';

      // Ensure both nodes exist (they may not have had a class block)
      for (const id of [sourceId, targetId]) {
        if (!nodes.has(id)) {
          nodes.set(id, {
            id, type: 'uml-class',
            position: { x: 0, y: 0 },
            dimensions: { width: Math.max(180, id.length * 8 + 40), height: 50 },
            content: id, tag: 'class',
            style: { backgroundColor: '#0d1117' }
          });
        }
      }

      // Map Mermaid edge types to Arc arrow styles
      let lineStyle: 'solid' | 'dashed' | 'dotted' | 'double' = 'solid';
      let arrowHead: ArrowHeadType = 'filled';
      let arrowTail: ArrowHeadType = 'none';

      if (edgeTypeStr === '-->') {
        // Dependency (dashed arrow in UML, but mermaid uses solid)
        lineStyle = 'solid'; arrowHead = 'open';
      } else if (edgeTypeStr === '--|>') {
        // Inheritance
        lineStyle = 'solid'; arrowHead = 'hollow';
      } else if (edgeTypeStr === '..>') {
        // Dependency (dashed)
        lineStyle = 'dashed'; arrowHead = 'open';
      } else if (edgeTypeStr === '..|>') {
        // Implementation
        lineStyle = 'dashed'; arrowHead = 'hollow';
      } else if (edgeTypeStr === '--') {
        // Association
        lineStyle = 'solid'; arrowHead = 'none';
      } else if (edgeTypeStr === '*--') {
        // Composition
        lineStyle = 'solid'; arrowTail = 'diamond-filled';
      } else if (edgeTypeStr === 'o--') {
        // Aggregation
        lineStyle = 'solid'; arrowTail = 'diamond-hollow';
      } else if (edgeTypeStr === '<|--') {
        // Reverse inheritance
        lineStyle = 'solid'; arrowTail = 'hollow';
      } else if (edgeTypeStr === '<..') {
        // Reverse implementation
        lineStyle = 'dashed'; arrowTail = 'hollow';
      }

      edges.push({
        id: `edge_${generateId()}`, type: 'arrow',
        position: { x: 0, y: 0 }, dimensions: { width: 0, height: 0 },
        content: '', label, lineStyle,
        arrowHead, arrowTail,
        startConnection: { nodeId: sourceId, anchor: 'closest' },
        endConnection: { nodeId: targetId, anchor: 'closest' }
      });
      continue;
    }
  }

  // Flush any remaining class being parsed
  flushClass();

  return layoutResult(nodes, edges);
}

// ─── STATE DIAGRAM PARSER ──────────────────────────────────────────

function parseStateDiagram(code: string): DiagramNode[] | null {
  const lines = code.split('\n');
  const nodes = new Map<string, DiagramNode>();
  const edges: DiagramNode[] = [];

  // State edge regex: StateA --> StateB : label
  const stateEdgeRegex = /^(\[\*\]|[a-zA-Z0-9_]+)\s*-->\s*(\[\*\]|[a-zA-Z0-9_]+)(?:\s*:\s*(.*))?$/;
  // State definition: state "Description" as alias
  const stateDefRegex = /^state\s+"(.*?)"\s+as\s+([a-zA-Z0-9_]+)$/;
  // Simple state with description: state name : description
  const stateDescRegex = /^state\s+([a-zA-Z0-9_]+)\s*:\s*(.*)$/;


  const ensureNode = (id: string) => {
    if (nodes.has(id)) return;
    // [*] = start or end state — handled in edge creation below
    if (id === '[*]') return;
    nodes.set(id, {
      id, type: 'rounded-rect',
      position: { x: 0, y: 0 },
      dimensions: { width: Math.max(140, id.length * 9 + 30), height: 50 },
      content: id,
      style: { backgroundColor: '#0d1117', borderRadius: '12px' }
    });
  };

  // First pass: collect all state definitions
  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('%%')) continue;
    if (line.toLowerCase().startsWith('statediagram')) continue;
    if (line.toLowerCase().startsWith('direction ')) continue;

    const defMatch = line.match(stateDefRegex);
    if (defMatch) {
      const description = defMatch[1];
      const alias = defMatch[2];
      nodes.set(alias, {
        id: alias, type: 'rounded-rect',
        position: { x: 0, y: 0 },
        dimensions: { width: Math.max(140, description.length * 8 + 30), height: 50 },
        content: description,
        style: { backgroundColor: '#0d1117', borderRadius: '12px' }
      });
      continue;
    }

    const descMatch = line.match(stateDescRegex);
    if (descMatch) {
      const stateId = descMatch[1];
      const description = descMatch[2];
      nodes.set(stateId, {
        id: stateId, type: 'rounded-rect',
        position: { x: 0, y: 0 },
        dimensions: { width: Math.max(140, description.length * 8 + 30), height: 50 },
        content: description,
        style: { backgroundColor: '#0d1117', borderRadius: '12px' }
      });
      continue;
    }
  }

  // Second pass: edges and remaining nodes
  let startId = '__start__';
  let endId = '__end__';
  let hasStart = false;
  let hasEnd = false;

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('%%')) continue;
    if (line.toLowerCase().startsWith('statediagram')) continue;
    if (line.toLowerCase().startsWith('direction ')) continue;
    if (line.match(stateDefRegex) || line.match(stateDescRegex)) continue;

    const edgeMatch = line.match(stateEdgeRegex);
    if (edgeMatch) {
      let sourceId = edgeMatch[1];
      let targetId = edgeMatch[2];
      const label = edgeMatch[3]?.trim() || '';

      // Handle [*] start/end
      if (sourceId === '[*]') {
        sourceId = startId;
        if (!hasStart) {
          nodes.set(startId, {
            id: startId, type: 'circle',
            position: { x: 0, y: 0 },
            dimensions: { width: 40, height: 40 },
            content: '',
            tag: 'start',
            style: { backgroundColor: '#e6edf3' }
          });
          hasStart = true;
        }
      }
      if (targetId === '[*]') {
        targetId = endId;
        if (!hasEnd) {
          nodes.set(endId, {
            id: endId, type: 'circle',
            position: { x: 0, y: 0 },
            dimensions: { width: 40, height: 40 },
            content: '',
            tag: 'end',
            style: { backgroundColor: '#e6edf3', borderWidth: '3px' }
          });
          hasEnd = true;
        }
      }

      ensureNode(sourceId);
      ensureNode(targetId);

      edges.push({
        id: `edge_${generateId()}`, type: 'arrow',
        position: { x: 0, y: 0 }, dimensions: { width: 0, height: 0 },
        content: '', label, lineStyle: 'solid',
        startConnection: { nodeId: sourceId, anchor: 'closest' },
        endConnection: { nodeId: targetId, anchor: 'closest' }
      });
    }
  }

  return layoutResult(nodes, edges);
}

// ─── ER DIAGRAM PARSER ─────────────────────────────────────────────

function parseErDiagram(code: string): DiagramNode[] | null {
  const lines = code.split('\n');
  const entities = new Map<string, { id: string; attributes: string[] }>();
  const edges: DiagramNode[] = [];

  // Relationship: ENTITY1 ||--o{ ENTITY2 : "label"
  const relRegex = /^([a-zA-Z0-9_]+)\s+(\|\||\}\||\|\{|\}\{|o\||\|o|o\{|\}o)(--)(\|\||\}\||\|\{|\}\{|o\||\|o|o\{|\}o)\s+([a-zA-Z0-9_]+)\s*:\s*"?(.*?)"?\s*$/;
  // Attribute: type name
  const attrRegex = /^\s+([a-zA-Z0-9_]+)\s+([a-zA-Z0-9_]+)(?:\s+(PK|FK|UK))?$/;
  // Entity block: ENTITY {
  const entityBlockRegex = /^([a-zA-Z0-9_]+)\s*\{$/;

  let currentEntity: string | null = null;

  for (let line of lines) {
    line = line.trim();
    if (!line || line.startsWith('%%')) continue;
    if (line.toLowerCase().startsWith('erdiagram')) continue;

    // Closing brace
    if (line === '}') {
      currentEntity = null;
      continue;
    }

    // Entity block opening
    const blockMatch = line.match(entityBlockRegex);
    if (blockMatch) {
      currentEntity = blockMatch[1];
      if (!entities.has(currentEntity)) {
        entities.set(currentEntity, { id: currentEntity, attributes: [] });
      }
      continue;
    }

    // Inside entity block - attribute
    if (currentEntity) {
      const attrMatch = line.match(attrRegex);
      if (attrMatch) {
        const constraint = attrMatch[3] ? ` ${attrMatch[3]}` : '';
        entities.get(currentEntity)!.attributes.push(`${attrMatch[1]} ${attrMatch[2]}${constraint}`);
      }
      continue;
    }

    // Relationship line
    const relMatch = line.match(relRegex);
    if (relMatch) {
      const sourceId = relMatch[1];
      const targetId = relMatch[5];
      const label = relMatch[6] || '';

      // Ensure entities exist
      if (!entities.has(sourceId)) entities.set(sourceId, { id: sourceId, attributes: [] });
      if (!entities.has(targetId)) entities.set(targetId, { id: targetId, attributes: [] });

      edges.push({
        id: `edge_${generateId()}`, type: 'arrow',
        position: { x: 0, y: 0 }, dimensions: { width: 0, height: 0 },
        content: '', label, lineStyle: 'solid',
        startConnection: { nodeId: sourceId, anchor: 'closest' },
        endConnection: { nodeId: targetId, anchor: 'closest' }
      });
    }
  }

  // Convert entities to DiagramNodes
  const nodes = new Map<string, DiagramNode>();
  entities.forEach((entity) => {
    const sections: NodeSection[] = [];
    if (entity.attributes.length > 0) {
      sections.push({ title: 'Attributes', items: entity.attributes });
    }
    const longestLine = [entity.id, ...entity.attributes]
      .reduce((a, b) => a.length > b.length ? a : b, '');
    const width = Math.max(180, longestLine.length * 8 + 40);
    const height = Math.max(60, 40 + entity.attributes.length * 22 + 10);

    nodes.set(entity.id, {
      id: entity.id, type: 'uml-class',
      position: { x: 0, y: 0 },
      dimensions: { width, height },
      content: entity.id, sections,
      tag: 'entity',
      style: { backgroundColor: '#0d1117' }
    });
  });

  return layoutResult(nodes, edges);
}

// ─── MINDMAP PARSER ────────────────────────────────────────────────

function parseMindmap(code: string): DiagramNode[] | null {
  const lines = code.split('\n');
  const nodes = new Map<string, DiagramNode>();
  const edges: DiagramNode[] = [];

  // Track indentation stack: each entry is { indent, id }
  const stack: { indent: number; id: string }[] = [];
  let nodeCounter = 0;

  for (let line of lines) {
    if (!line.trim() || line.trim().startsWith('%%')) continue;
    if (line.trim().toLowerCase().startsWith('mindmap')) continue;

    // Calculate indentation level (number of leading spaces)
    const indent = line.search(/\S/);
    if (indent < 0) continue;
    const text = line.trim();
    if (!text) continue;

    // Extract label: remove Mermaid shape wrappers if any
    let label = text;
    let type: NodeType = 'rounded-rect';

    // Root node (first entry, no indent) gets special type
    if (stack.length === 0) {
      type = 'box';
    }

    // Handle shapes: [text], (text), ((text)), {text}
    const shapeMatch = text.match(/^\(\((.*?)\)\)$/) ||
                       text.match(/^\((.*?)\)$/) ||
                       text.match(/^\[(.*?)\]$/) ||
                       text.match(/^\{(.*?)\}$/);
    if (shapeMatch) {
      label = shapeMatch[1];
      if (text.startsWith('((')) type = 'circle';
      else if (text.startsWith('{')) type = 'diamond';
      else if (text.startsWith('[')) type = 'box';
      else type = 'rounded-rect';
    }

    const id = `mm_${nodeCounter++}`;
    const width = Math.max(100, label.length * 8 + 30);
    nodes.set(id, {
      id, type,
      position: { x: 0, y: 0 },
      dimensions: { width, height: 45 },
      content: label,
      style: { backgroundColor: '#0d1117' }
    });

    // Pop stack until we find a parent with less indentation
    while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
      stack.pop();
    }

    // Connect to parent if any
    if (stack.length > 0) {
      const parentId = stack[stack.length - 1].id;
      edges.push({
        id: `edge_${generateId()}`, type: 'line',
        position: { x: 0, y: 0 }, dimensions: { width: 0, height: 0 },
        content: '', lineStyle: 'solid', arrowType: 'none',
        startConnection: { nodeId: parentId, anchor: 'closest' },
        endConnection: { nodeId: id, anchor: 'closest' }
      });
    }

    stack.push({ indent, id });
  }

  return layoutResult(nodes, edges);
}

// ─── SHARED LAYOUT ─────────────────────────────────────────────────

function layoutResult(nodes: Map<string, DiagramNode>, edges: DiagramNode[]): DiagramNode[] | null {
  const allNodes = Array.from(nodes.values()).concat(edges);
  if (allNodes.length === 0) return null;

  try {
    return autoLayoutNodes(allNodes);
  } catch (e) {
    console.error('Layout engine failed on mermaid parse', e);
    return allNodes;
  }
}
