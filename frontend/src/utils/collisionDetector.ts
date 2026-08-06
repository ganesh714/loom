import type { DiagramNode, Point } from '../types';
import { getClosestPointOnSegment } from './geometry';

export interface CollisionReport {
  nodeOverlaps: { nodeA: string; nodeB: string; overlapX: number; overlapY: number }[];
  lineIntersections: { edgeId: string; obstructingNodeId: string; intersectionPoint: Point }[];
  wasAutoFixed: boolean;
}

interface Rect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

function getNodeRect(node: DiagramNode): Rect {
  return {
    id: node.id,
    x: node.position.x,
    y: node.position.y,
    width: node.dimensions.width,
    height: node.dimensions.height,
  };
}

function rectsOverlap(a: Rect, b: Rect, padding: number): boolean {
  return !(
    a.x + a.width + padding < b.x ||
    b.x + b.width + padding < a.x ||
    a.y + a.height + padding < b.y ||
    b.y + b.height + padding < a.y
  );
}

// Distance between center points
function getOverlapVector(a: Rect, b: Rect, padding: number) {
  const centerA = { x: a.x + a.width / 2, y: a.y + a.height / 2 };
  const centerB = { x: b.x + b.width / 2, y: b.y + b.height / 2 };

  const minDistX = (a.width / 2) + (b.width / 2) + padding;
  const minDistY = (a.height / 2) + (b.height / 2) + padding;

  const dx = centerB.x - centerA.x;
  const dy = centerB.y - centerA.y;

  const overlapX = minDistX - Math.abs(dx);
  const overlapY = minDistY - Math.abs(dy);

  return { dx, dy, overlapX, overlapY };
}

export function detectCollisions(nodes: DiagramNode[], padding = 20): CollisionReport {
  const report: CollisionReport = {
    nodeOverlaps: [],
    lineIntersections: [],
    wasAutoFixed: false,
  };

  const isEdge = (n: DiagramNode) => ['arrow', 'line', 'custom-connector'].includes(n.type);
  const realNodes = nodes.filter(n => !isEdge(n));
  const edges = nodes.filter(n => isEdge(n));

  // 1. Detect Node-Node Overlaps
  for (let i = 0; i < realNodes.length; i++) {
    for (let j = i + 1; j < realNodes.length; j++) {
      const rectA = getNodeRect(realNodes[i]);
      const rectB = getNodeRect(realNodes[j]);

      if (rectsOverlap(rectA, rectB, padding)) {
        const { overlapX, overlapY } = getOverlapVector(rectA, rectB, padding);
        report.nodeOverlaps.push({ nodeA: rectA.id, nodeB: rectB.id, overlapX, overlapY });
      }
    }
  }

  // 2. Detect Line-Node Intersections
  for (const edge of edges) {
    if (!edge.startPoint || !edge.endPoint) continue;

    // Build the segments for this edge
    const points: Point[] = [edge.startPoint];
    if (edge.waypoints && edge.waypoints.length > 0) {
      points.push(...edge.waypoints);
    } else if (edge.routing === 'elbow') {
      const startAnchor = edge.startConnection?.anchor;
      const endAnchor = edge.endConnection?.anchor;
      const isStartHoriz = startAnchor === 'left' || startAnchor === 'right';
      const isStartVert = startAnchor === 'top' || startAnchor === 'bottom';
      const isEndHoriz = endAnchor === 'left' || endAnchor === 'right';
      const isEndVert = endAnchor === 'top' || endAnchor === 'bottom';
      const isPerpendicular = (isStartHoriz && isEndVert) || (isStartVert && isEndHoriz);

      if (isPerpendicular) {
        // L-shape: single corner waypoint
        if (isStartHoriz) {
          points.push({ x: edge.endPoint.x, y: edge.startPoint.y });
        } else {
          points.push({ x: edge.startPoint.x, y: edge.endPoint.y });
        }
      } else {
        const isVerticalElbow = isStartVert || !startAnchor;
        if (isVerticalElbow) {
          points.push({ x: edge.startPoint.x, y: (edge.startPoint.y + edge.endPoint.y) / 2 });
          points.push({ x: edge.endPoint.x, y: (edge.startPoint.y + edge.endPoint.y) / 2 });
        } else {
          points.push({ x: (edge.startPoint.x + edge.endPoint.x) / 2, y: edge.startPoint.y });
          points.push({ x: (edge.startPoint.x + edge.endPoint.x) / 2, y: edge.endPoint.y });
        }
      }
    }
    points.push(edge.endPoint);

    // Check against every node that is NOT the source or target
    for (const node of realNodes) {
      if (node.id === edge.startConnection?.nodeId || node.id === edge.endConnection?.nodeId) continue;
      
      const rect = getNodeRect(node);
      const inflatedRect = {
        x: rect.x - padding,
        y: rect.y - padding,
        width: rect.width + padding * 2,
        height: rect.height + padding * 2
      };

      let intersected = false;
      let intersectPoint: Point | null = null;

      for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];

        // A quick AABB check for the segment vs inflated rect
        const minX = Math.min(p1.x, p2.x);
        const maxX = Math.max(p1.x, p2.x);
        const minY = Math.min(p1.y, p2.y);
        const maxY = Math.max(p1.y, p2.y);

        if (
          maxX >= inflatedRect.x && minX <= inflatedRect.x + inflatedRect.width &&
          maxY >= inflatedRect.y && minY <= inflatedRect.y + inflatedRect.height
        ) {
           // We have a potential intersection. Let's find the closest point on the segment to the rect center
           const center = { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
           const closest = getClosestPointOnSegment(center, p1, p2);
           
           // If the closest point is inside the inflated rect, it's a collision
           if (
             closest.x >= inflatedRect.x && closest.x <= inflatedRect.x + inflatedRect.width &&
             closest.y >= inflatedRect.y && closest.y <= inflatedRect.y + inflatedRect.height
           ) {
             intersected = true;
             intersectPoint = closest;
             break;
           }
        }
      }

      if (intersected && intersectPoint) {
        report.lineIntersections.push({
          edgeId: edge.id,
          obstructingNodeId: node.id,
          intersectionPoint: intersectPoint
        });
      }
    }
  }

  return report;
}

export function autoFixCollisions(nodes: DiagramNode[], maxPasses = 3): { nodes: DiagramNode[], report: CollisionReport } {
  let currentNodes = JSON.parse(JSON.stringify(nodes)) as DiagramNode[];
  let finalReport: CollisionReport = { nodeOverlaps: [], lineIntersections: [], wasAutoFixed: false };
  const padding = 30; // 30px padding for auto-fix to give breathing room

  for (let pass = 0; pass < maxPasses; pass++) {
    const report = detectCollisions(currentNodes, padding);
    
    if (report.nodeOverlaps.length === 0 && report.lineIntersections.length === 0) {
      break;
    }
    
    if (pass === 0) {
      finalReport = report; // Store the initial issues found
      finalReport.wasAutoFixed = true;
    }

    // Fix Node-Node Overlaps
    const nudgeMap = new Map<string, { dx: number, dy: number }>();
    for (const overlap of report.nodeOverlaps) {
      const nodeA = currentNodes.find(n => n.id === overlap.nodeA);
      const nodeB = currentNodes.find(n => n.id === overlap.nodeB);
      if (!nodeA || !nodeB) continue;

      const rectA = getNodeRect(nodeA);
      const rectB = getNodeRect(nodeB);
      const { dx, dy, overlapX, overlapY } = getOverlapVector(rectA, rectB, padding);

      // Nudge node B away from node A
      let nudgeX = 0;
      let nudgeY = 0;

      if (overlapX < overlapY) {
        // Horizontal nudge is smaller, do that
        nudgeX = dx > 0 ? overlapX : -overlapX;
      } else {
        // Vertical nudge is smaller
        nudgeY = dy > 0 ? overlapY : -overlapY;
      }

      const existingNudge = nudgeMap.get(overlap.nodeB) || { dx: 0, dy: 0 };
      nudgeMap.set(overlap.nodeB, { dx: existingNudge.dx + nudgeX, dy: existingNudge.dy + nudgeY });
    }

    // Apply nudges
    currentNodes = currentNodes.map(node => {
      const nudge = nudgeMap.get(node.id);
      if (nudge) {
        return {
          ...node,
          position: { x: node.position.x + nudge.dx, y: node.position.y + nudge.dy }
        };
      }
      return node;
    });

    // Fix Line-Node Intersections
    for (const intersection of report.lineIntersections) {
      const edgeIndex = currentNodes.findIndex(n => n.id === intersection.edgeId);
      const obstructNode = currentNodes.find(n => n.id === intersection.obstructingNodeId);
      if (edgeIndex === -1 || !obstructNode) continue;

      const edge = currentNodes[edgeIndex];
      const rect = getNodeRect(obstructNode);

      // Simple fix: Route the line above the obstructing node
      const waypointY = rect.y - padding;
      const waypointX = rect.x + rect.width / 2;

      const newWaypoints = [...(edge.waypoints || [])];
      newWaypoints.push({ x: waypointX, y: waypointY });

      currentNodes[edgeIndex] = {
        ...edge,
        routing: 'curved', // curved looks better with custom waypoints
        waypoints: newWaypoints
      };
    }
  }

  return { nodes: currentNodes, report: finalReport };
}
