import type { Point, DiagramNode } from '../types';

export function getClosestPointOnSegment(p: Point, a: Point, b: Point): Point {
  const atob = { x: b.x - a.x, y: b.y - a.y };
  const atop = { x: p.x - a.x, y: p.y - a.y };
  const lenSq = atob.x * atob.x + atob.y * atob.y;
  let dot = atop.x * atob.x + atop.y * atob.y;
  const t = Math.min(1, Math.max(0, lenSq > 0 ? dot / lenSq : 0));
  return { x: a.x + atob.x * t, y: a.y + atob.y * t };
}

export function getClosestPointOnLineNode(p: Point, node: DiagramNode): Point {
  if (!node.startPoint || !node.endPoint) return p;

  const points: Point[] = [node.startPoint];
  
  if (node.waypoints && node.waypoints.length > 0) {
    points.push(...node.waypoints);
  } else if (node.routing === 'elbow') {
    const startAnchor = node.startConnection?.anchor;
    const endAnchor = node.endConnection?.anchor;
    const isStartHoriz = startAnchor === 'left' || startAnchor === 'right';
    const isStartVert = startAnchor === 'top' || startAnchor === 'bottom';
    const isEndHoriz = endAnchor === 'left' || endAnchor === 'right';
    const isEndVert = endAnchor === 'top' || endAnchor === 'bottom';
    const isPerpendicular = (isStartHoriz && isEndVert) || (isStartVert && isEndHoriz);

    if (isPerpendicular) {
      // L-shape: single corner waypoint
      if (isStartHoriz) {
        points.push({ x: node.endPoint.x, y: node.startPoint.y });
      } else {
        points.push({ x: node.startPoint.x, y: node.endPoint.y });
      }
    } else {
      const isVerticalElbow = isStartVert || !startAnchor;
      if (isVerticalElbow) {
        points.push({ x: node.startPoint.x, y: (node.startPoint.y + node.endPoint.y) / 2 });
        points.push({ x: node.endPoint.x, y: (node.startPoint.y + node.endPoint.y) / 2 });
      } else {
        points.push({ x: (node.startPoint.x + node.endPoint.x) / 2, y: node.startPoint.y });
        points.push({ x: (node.startPoint.x + node.endPoint.x) / 2, y: node.endPoint.y });
      }
    }
  }

  points.push(node.endPoint);

  let closestPoint = points[0];
  let minDistanceSq = Infinity;

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    const candidate = getClosestPointOnSegment(p, a, b);
    const distSq = Math.pow(candidate.x - p.x, 2) + Math.pow(candidate.y - p.y, 2);
    if (distSq < minDistanceSq) {
      minDistanceSq = distSq;
      closestPoint = candidate;
    }
  }

  return closestPoint;
}
