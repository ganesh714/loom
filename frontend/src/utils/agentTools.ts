import type { DiagramNode, NodeType, SemanticTag, ArrowHeadType } from '../types';

export const AGENT_TOOLS = [
  {
    name: "add_node",
    description: "Add a new node to the canvas.",
    parameters: {
      type: "object",
      properties: {
        type: { type: "string" },
        content: { type: "string" },
        tag: { type: "string" },
        x: { type: "number" },
        y: { type: "number" },
        width: { type: "number" },
        height: { type: "number" },
        backgroundColor: { type: "string" },
        borderColor: { type: "string" },
        textColor: { type: "string" }
      },
      required: ["type", "content", "x", "y", "width", "height"]
    }
  },
  {
    name: "delete_node",
    description: "Remove a node from the canvas.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string" }
      },
      required: ["nodeId"]
    }
  },
  {
    name: "update_content",
    description: "Change the text content of a node.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string" },
        content: { type: "string" }
      },
      required: ["nodeId", "content"]
    }
  },
  {
    name: "move_node",
    description: "Reposition a node on the canvas.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string" },
        x: { type: "number" },
        y: { type: "number" }
      },
      required: ["nodeId", "x", "y"]
    }
  },
  {
    name: "resize_node",
    description: "Change dimensions of a node.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string" },
        width: { type: "number" },
        height: { type: "number" }
      },
      required: ["nodeId", "width", "height"]
    }
  },
  {
    name: "style_node",
    description: "Change visual properties of a node.",
    parameters: {
      type: "object",
      properties: {
        nodeId: { type: "string" },
        backgroundColor: { type: "string" },
        borderColor: { type: "string" },
        textColor: { type: "string" },
        fontSize: { type: "string" },
        fontWeight: { type: "string" },
        borderRadius: { type: "string" },
        opacity: { type: "string" }
      },
      required: ["nodeId"]
    }
  },
  {
    name: "connect_nodes",
    description: "Draw an arrow/line between two existing nodes.",
    parameters: {
      type: "object",
      properties: {
        sourceId: { type: "string" },
        targetId: { type: "string" },
        label: { type: "string" },
        lineStyle: { type: "string", enum: ["solid", "dashed", "dotted"] },
        arrowHead: { type: "string" },
        arrowTail: { type: "string" },
        routing: { type: "string", enum: ["straight", "elbow", "curved"] }
      },
      required: ["sourceId", "targetId"]
    }
  },
  {
    name: "disconnect_nodes",
    description: "Remove a connection edge.",
    parameters: {
      type: "object",
      properties: {
        edgeId: { type: "string" }
      },
      required: ["edgeId"]
    }
  },
  {
    name: "auto_layout",
    description: "Auto-arrange all nodes using the layout engine.",
    parameters: {
      type: "object",
      properties: {}
    }
  },
  {
    name: "align_nodes",
    description: "Align multiple nodes.",
    parameters: {
      type: "object",
      properties: {
        nodeIds: { type: "array", items: { type: "string" } },
        alignment: { type: "string", enum: ["left", "center", "right", "top", "middle", "bottom"] }
      },
      required: ["nodeIds", "alignment"]
    }
  },
  {
    name: "group_nodes",
    description: "Group multiple nodes together.",
    parameters: {
      type: "object",
      properties: {
        nodeIds: { type: "array", items: { type: "string" } },
        groupTitle: { type: "string" },
        groupColor: { type: "string" }
      },
      required: ["nodeIds"]
    }
  },
  {
    name: "detect_collisions",
    description: "Run the collision detector to check for and fix overlaps.",
    parameters: {
      type: "object",
      properties: {}
    }
  }
];

export interface ToolCall {
  tool: string;
  args: any;
}

export function executeToolCalls(
  toolCalls: ToolCall[],
  currentNodes: DiagramNode[]
): DiagramNode[] {
  let nodes = JSON.parse(JSON.stringify(currentNodes)) as DiagramNode[];
  const newNodesMap = new Map<string, string>(); // Maps $$NEW_0$$ to actual UUID
  
  let tempIdCounter = 0;

  const resolveId = (id: string) => {
    return newNodesMap.get(id) || id;
  };

  const createUuid = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  for (let i = 0; i < toolCalls.length; i++) {
    const call = toolCalls[i];
    const { tool, args } = call;

    try {
      if (tool === 'add_node') {
        const id = createUuid();
        newNodesMap.set(`$$NEW_${tempIdCounter++}$$`, id);
        
        const newNode: DiagramNode = {
          id,
          type: (args.type as NodeType) || 'box',
          content: args.content || '',
          tag: (args.tag as SemanticTag),
          position: { x: args.x || 0, y: args.y || 0 },
          dimensions: { width: args.width || 220, height: args.height || 90 },
          style: {
            ...(args.backgroundColor && { backgroundColor: args.backgroundColor }),
            ...(args.borderColor && { borderColor: args.borderColor }),
            ...(args.textColor && { color: args.textColor })
          }
        };
        nodes.push(newNode);
      } 
      else if (tool === 'delete_node') {
        const id = resolveId(args.nodeId);
        nodes = nodes.filter(n => n.id !== id);
        // Also remove any edges connected to this node
        nodes = nodes.filter(n => !(n.startConnection?.nodeId === id || n.endConnection?.nodeId === id));
      }
      else if (tool === 'update_content') {
        const id = resolveId(args.nodeId);
        const nodeIndex = nodes.findIndex(n => n.id === id);
        if (nodeIndex !== -1) {
          nodes[nodeIndex].content = args.content;
        }
      }
      else if (tool === 'move_node') {
        const id = resolveId(args.nodeId);
        const nodeIndex = nodes.findIndex(n => n.id === id);
        if (nodeIndex !== -1) {
          nodes[nodeIndex].position = { x: args.x, y: args.y };
        }
      }
      else if (tool === 'resize_node') {
        const id = resolveId(args.nodeId);
        const nodeIndex = nodes.findIndex(n => n.id === id);
        if (nodeIndex !== -1) {
          nodes[nodeIndex].dimensions = { width: args.width, height: args.height };
        }
      }
      else if (tool === 'style_node') {
        const id = resolveId(args.nodeId);
        const nodeIndex = nodes.findIndex(n => n.id === id);
        if (nodeIndex !== -1) {
          nodes[nodeIndex].style = {
            ...nodes[nodeIndex].style,
            ...(args.backgroundColor && { backgroundColor: args.backgroundColor }),
            ...(args.borderColor && { borderColor: args.borderColor }),
            ...(args.textColor && { color: args.textColor }),
            ...(args.fontSize && { fontSize: args.fontSize }),
            ...(args.fontWeight && { fontWeight: args.fontWeight }),
            ...(args.borderRadius && { borderRadius: args.borderRadius }),
            ...(args.opacity && { opacity: args.opacity })
          };
        }
      }
      else if (tool === 'connect_nodes') {
        const sourceId = resolveId(args.sourceId);
        const targetId = resolveId(args.targetId);
        const id = createUuid();
        newNodesMap.set(`$$NEW_${tempIdCounter++}$$`, id);
        
        const edgeNode: DiagramNode = {
          id,
          type: 'arrow',
          content: '',
          position: { x: 0, y: 0 },
          dimensions: { width: 0, height: 0 },
          startConnection: { nodeId: sourceId, anchor: 'closest' },
          endConnection: { nodeId: targetId, anchor: 'closest' },
          label: args.label || '',
          lineStyle: args.lineStyle || 'solid',
          arrowHead: (args.arrowHead as ArrowHeadType) || 'filled',
          arrowTail: (args.arrowTail as ArrowHeadType) || 'none',
          routing: args.routing || 'elbow'
        };
        nodes.push(edgeNode);
      }
      else if (tool === 'disconnect_nodes') {
        const id = resolveId(args.edgeId);
        nodes = nodes.filter(n => n.id !== id);
      }
      else if (tool === 'align_nodes') {
        const ids = (args.nodeIds || []).map((id: string) => resolveId(id));
        const targetNodes = nodes.filter(n => ids.includes(n.id));
        if (targetNodes.length > 1) {
          let targetValue = 0;
          switch (args.alignment) {
            case 'left': targetValue = Math.min(...targetNodes.map(n => n.position.x)); break;
            case 'right': targetValue = Math.max(...targetNodes.map(n => n.position.x + n.dimensions.width)); break;
            case 'center': 
              targetValue = targetNodes.reduce((sum, n) => sum + n.position.x + n.dimensions.width/2, 0) / targetNodes.length; 
              break;
            case 'top': targetValue = Math.min(...targetNodes.map(n => n.position.y)); break;
            case 'bottom': targetValue = Math.max(...targetNodes.map(n => n.position.y + n.dimensions.height)); break;
            case 'middle': 
              targetValue = targetNodes.reduce((sum, n) => sum + n.position.y + n.dimensions.height/2, 0) / targetNodes.length; 
              break;
          }
          
          nodes = nodes.map(n => {
            if (ids.includes(n.id)) {
              if (['left', 'right', 'center'].includes(args.alignment)) {
                let x = n.position.x;
                if (args.alignment === 'left') x = targetValue;
                if (args.alignment === 'right') x = targetValue - n.dimensions.width;
                if (args.alignment === 'center') x = targetValue - n.dimensions.width / 2;
                return { ...n, position: { ...n.position, x } };
              } else {
                let y = n.position.y;
                if (args.alignment === 'top') y = targetValue;
                if (args.alignment === 'bottom') y = targetValue - n.dimensions.height;
                if (args.alignment === 'middle') y = targetValue - n.dimensions.height / 2;
                return { ...n, position: { ...n.position, y } };
              }
            }
            return n;
          });
        }
      }
      // Note: auto_layout, group_nodes, detect_collisions are better handled post-execution 
      // or at the DiagramContext level if they are requested, but for now we apply what we can locally.
    } catch (e) {
      console.error(`Failed to execute tool ${tool}:`, e);
    }
  }

  return nodes;
}
