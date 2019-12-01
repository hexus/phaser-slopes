import Vector from 'phaser/src/physics/matter-js/lib/geometry/Vector';
import Vertices from 'phaser/src/physics/matter-js/lib/geometry/Vertices';

const projectionPool = [
	{ min: Number.MAX_VALUE, max: Number.MIN_VALUE },
	{ min: Number.MAX_VALUE, max: Number.MIN_VALUE }
];

const SAT = {
	/**
	 * Detect collision between two bodies using the Separating Axis Theorem.
	 *
	 * @param {Object} bodyA - The first body.
	 * @param {Object} bodyB - The second body.
	 * @param {Object} previousCollision - The previous collision.
	 * @return {Object} The collision result
	 */
	collides: function (bodyA, bodyB, previousCollision) {
		let collision = SAT.collideBodies(bodyA, bodyB, previousCollision);
		
		if (!collision.collided) {
			return collision;
		}
		
		collision.supports = SAT.findCollisionSupports(collision);
		
		return collision;
	},
	
	/**
	 * Resolve a collision response for two bodies.
	 *
	 * @param {Object} bodyA - The first body to overlap.
	 * @param {Object} bodyB - The second body to overlap.
	 * @param {Object} [previousCollision] - The previous collision response object.
	 * @returns {Object} The collision response.
	 */
	collideBodies: function (bodyA, bodyB, previousCollision) {
		let	minOverlap = { overlap: Number.MAX_VALUE },
			collision,
			canReusePrevCol = false,
			hasEdgesA,
			hasEdgesB,
			vertexBody,
			edgeBody,
			n,
			result,
			results = [],
			ignored,
			r;
		
		if (previousCollision) {
			// Estimate the total motion of the previous collision
			let parentA = bodyA.parent,
				parentB = bodyB.parent,
				motion = parentA.speed * parentA.speed + parentA.angularSpeed * parentA.angularSpeed
					+ parentB.speed * parentB.speed + parentB.angularSpeed * parentB.angularSpeed;
			
			// We may be able to (partially) reuse collision result, but
			// it's only safe if collision was resting
			canReusePrevCol = previousCollision && previousCollision.collided && motion < 0.2 && previousCollision.axisNumber >= 0;
			
			// Reuse the collision object
			collision = previousCollision;
		} else {
			collision = { collided: false, bodyA: bodyA, bodyB: bodyB };
		}
		
		// TODO: Restore collision reuse
		canReusePrevCol = false;
		
		if (previousCollision && canReusePrevCol) {
			// If we can reuse the collision result we only need to test
			// the previously found axis or normal
			let axisBodyA = collision.axisBody,
				axisBodyB = axisBodyA === bodyA ? bodyB : bodyA,
				axis = axisBodyA.axes[previousCollision.axisNumber];
			
			minOverlap = SAT.overlapAxis(axisBodyA.vertices, axisBodyB.vertices, axis);
			collision.reused = true;
			
			if (minOverlap.overlap <= 0) {
				collision.collided = false;
				return collision;
			}
		} else {
			// Perform full SAT test
			hasEdgesA = !!bodyA.edges;
			hasEdgesB = !!bodyB.edges;
			
			if (((hasEdgesA && !hasEdgesB) || (!hasEdgesA && hasEdgesB))) {
				edgeBody = hasEdgesA ? bodyA : bodyB;
				vertexBody = hasEdgesA ? bodyB : bodyA;

				result = SAT.overlapBodyWithEdges(vertexBody, edgeBody);
				
				if (result.overlap <= 0) {
					collision.collided = false;
					return collision;
				}
				
				// Set the minimum overlap
				minOverlap.overlap = result.overlap;
				minOverlap.axis = result.axis;
				minOverlap.axisBody = result.axisBody;
				minOverlap.axisNumber = result.axisNumber;
				minOverlap.edge = result.edge;
				minOverlap.flip = result.flip;
				minOverlap.type = result.type;
				minOverlap.range = result.range;
			} else {
				// TODO: Refactor into overlapBodies()
				
				// Perform overlap tests using bodyA's axes
				for (n = 0; n < bodyA.axes.length; n++) {
					result = SAT.overlapAxis(bodyA.vertices, bodyB.vertices, bodyA.axes[n]);
					
					if (result.overlap <= 0) {
						collision.collided = false;
						return collision;
					}
					
					result.axisBody = bodyA;
					result.axisNumber = n;
					results.push(result);
				}
				
				// Perform overlap tests using bodyB's axes
				for (n = 0; n < bodyB.axes.length; n++) {
					result = SAT.overlapAxis(bodyB.vertices, bodyA.vertices, bodyB.axes[n]);
					
					if (result.overlap <= 0) {
						collision.collided = false;
						return collision;
					}
					
					result.axisBody = bodyB;
					result.axisNumber = n;
					results.push(result);
				}
				
				// Choose the lesser of all results that don't need to be ignored
				for (r = 0; r < results.length; r++) {
					result = results[r];
					
					// There is a separating axis, so bail
					if (result.overlap <= 0) {
						collision.collided = false;
						return collision;
					}
					
					// This is the shortest overlap so far
					if (result.overlap < minOverlap.overlap) {
						minOverlap = result;
					}
				}
			}
			
			// The axis index is important for reuse later
			collision.axisBody = minOverlap.axisBody;
			collision.axisNumber = minOverlap.axisNumber;
		}
		
		// Set some further properties on the collision object
		collision.bodyA = bodyA.id < bodyB.id ? bodyA : bodyB;
		collision.bodyB = bodyA.id < bodyB.id ? bodyB : bodyA;
		collision.collided = true;
		collision.depth = minOverlap.overlap;
		collision.edge = minOverlap.edge;
		collision.parentA = collision.bodyA.parent;
		collision.parentB = collision.bodyB.parent;
		
		// Debug properties
		collision.type = minOverlap.type;
		collision.range = minOverlap.range;
		
		bodyA = collision.bodyA;
		bodyB = collision.bodyB;
		
		// Ensure that the collision normal is facing away from bodyA
		if (!minOverlap.flip && Vector.dot(minOverlap.axis, Vector.sub(bodyB.position, bodyA.position)) < 0) {
			collision.normal = {
				x: minOverlap.axis.x,
				y: minOverlap.axis.y
			};
		} else {
			collision.normal = {
				x: -minOverlap.axis.x,
				y: -minOverlap.axis.y
			};
		}
		
		collision.tangent = Vector.perp(collision.normal);
		
		collision.penetration = collision.penetration || {};
		collision.penetration.x = collision.normal.x * collision.depth;
		collision.penetration.y = collision.normal.y * collision.depth;
		
		return collision;
	},
	
	/**
	 * Determine the overlap between two sets of vertices using the given normal.
	 *
	 * Like overlapAxis(), except it only separates in the direction of the normal vector.
	 *
	 * Bails with an overlap of 0 if the projections don't overlap.
	 *
	 * @param {Object[]} verticesA
	 * @param {Object[]} verticesB
	 * @param {Object} normal
	 * @returns {Object}
	 */
	overlapNormal: function (verticesA, verticesB, normal) {
		let projectionA = projectionPool[0],
			projectionB = projectionPool[1],
			result = { overlap: Number.MAX_VALUE },
			overlap;
		
		// Project the vertices onto the axis
		SAT.projectToAxis(projectionA, verticesA, normal);
		SAT.projectToAxis(projectionB, verticesB, normal);
		
		// If the projected ranges don't overlap, we have a separating axis
		if (projectionA.min >= projectionB.max || projectionB.min >= projectionA.max) {
			result.overlap = 0;
			result.axis = normal;
			return result;
		}
		
		// Push A out of B
		overlap = projectionB.max - projectionA.min;
		
		result.overlap = overlap;
		result.axis = normal;
		
		return result;
	},
	
	/**
	 * Collide an edged body and a regular body.
	 *
	 * TODO: Support two-sided edge collision?
	 *
	 * @param vertexBody - The body with vertices to collide
	 * @param edgeBody - The body with edges to collide
	 */
	overlapBodyWithEdges: function (vertexBody, edgeBody) {
		let results = [];
		let result = { overlap: Number.MAX_VALUE };
		
		let e;
		let edge;
		let edgeResult;
		let r;
		let flip;
		
		// Collide each edge of the edgeBody with the vertexBody
		for (e = 0; e < edgeBody.edges.length; e++) {
			edge = edgeBody.edges[e];

			// Skip ignored edges
			if (edge.ignore) {
				continue;
			}
			
			edgeResult = SAT.overlapBodyWithEdge(vertexBody, edgeBody, edge);
			
			if (edgeResult.overlap <= 0) {
				continue;
			}
			
			results.push(edgeResult);
		}

		// Bail, we have no colliding edges
		if (!results.length) {
			result.overlap = 0;
			return result;
		}
		
		// Find and return the shortest
		for (r = 0; r < results.length; r++) {
			if (results[r].overlap < result.overlap) {
				result = results[r];
			}
		}
		
		// flip = edgeBody.id < vertexBody.id;
		//
		// result.flip = flip;
		//result.axis = Vector.dot(minOverlap.axis, Vector.sub(bodyB.position, bodyA.position)) < 0 ? Vector.neg(result.axis) : result.axis;
		
		return result;
	},
	
	overlapBodyWithEdge(vertexBody, edgeBody, edge) {
		let edgeVertices = [];
		let range;
		let edgeResult = { overlap: Number.MAX_VALUE };
		let bodyResult;
		let a;
		let axis;
		
		edgeVertices[0] = edge.vertices[1];
		edgeVertices[1] = edge.vertices[2];
		
		range = edge.normalRanges.front;
		
		edgeResult = SAT.overlapNormal(vertexBody.vertices, edgeVertices, range.normal);
		
		// We have a separating axis, skip this edge
		if (edgeResult.overlap <= 0) {
			return edgeResult;
		}
		
		edgeResult.axisBody = edgeBody;
		edgeResult.axisNumber = edge.index;
		edgeResult.edge = edge;
		edgeResult.type = 'edge';
		
		// Test each vertexBody normal
		for (a = 0; a < vertexBody.axes.length; a++) {
			axis = vertexBody.axes[a];
			
			bodyResult = SAT.overlapNormal(vertexBody.vertices, edgeVertices, axis);
			
			// We have a separating axis, skip this edge
			if (bodyResult.overlap <= 0) {
				return bodyResult;
			}
			
			// Make sure the vertexBody normal is in the edge's normal range
			if (!SAT.isVectorBetween(bodyResult.axis, range.lowerLimit, range.upperLimit)) {
				continue;
			}
			
			bodyResult.axisBody = vertexBody;
			bodyResult.axisNumber = a;
			bodyResult.edge = edge;
			bodyResult.type = 'body';
			
			// Use this result if it has the smallest overlap we've seen so far
			if (bodyResult.overlap < edgeResult.overlap) {
				edgeResult = bodyResult;
			}
		}
		
		if (edgeResult.type === 'body') {
			
			let vectorAngle = Math.atan2(edgeResult.axis.y, edgeResult.axis.x);
			let lowerAngle = Math.atan2(range.lowerLimit.y, range.lowerLimit.x);
			let upperAngle = Math.atan2(range.upperLimit.y, range.upperLimit.x);
			
			let inbetween = lowerAngle <= vectorAngle && vectorAngle <= upperAngle;
			
			inbetween = lowerAngle > upperAngle ? !inbetween : inbetween;
			
			console.log(
				vectorAngle,
				lowerAngle,
				upperAngle,
				inbetween,
				SAT.isVectorBetween(edgeResult.axis, range.lowerLimit, range.upperLimit),
				edgeResult.edge
			);
			
			//debugger;
		}
		
		edgeResult.range = range;
		
		return edgeResult;
	},
	
	/**
	 * Determine whether a vector lies between two other vectors.
	 *
	 * @param vector
	 * @param lowerLimit
	 * @param upperLimit
	 * @return {boolean}
	 */
	isVectorBetween(vector, lowerLimit, upperLimit) {
		// Deus' approach - use literal angles from atan2
		let vectorAngle = Math.atan2(vector.y, vector.x);
		let lowerAngle = Math.atan2(lowerLimit.y, lowerLimit.x);
		let upperAngle = Math.atan2(upperLimit.y, upperLimit.x);

		let inbetween = lowerAngle <= vectorAngle && vectorAngle <= upperAngle;

		return lowerAngle > upperAngle ? !inbetween : inbetween;
		
		
		// @see https://stackoverflow.com/a/43384516/1744006
		// let crossLimits = Vector.cross(upperLimit, lowerLimit);
		//
		// if (crossLimits >= 0) {
		// 	if ((Vector.cross(upperLimit, vector) >= 0 && Vector.cross(vector, lowerLimit) >= 0)) {
		// 		return true;
		// 	}
		// } else {
		// 	if (!(Vector.cross(lowerLimit, vector) >= 0 && Vector.cross(vector, upperLimit) >= 0)) {
		// 		return true;
		// 	}
		// }
		//
		// return false;
		
		// Alternative method that doesn't seem to work:
		// @see https://stackoverflow.com/a/17497339/1744006
		// return (Vector.cross(lowerLimit, normal) * Vector.cross(lowerLimit, upperLimit) >= 0) &&
		// 	(Vector.cross(upperLimit, normal) * Vector.cross(upperLimit, lowerLimit) >= 0);
	},
	
	/**
	 * Determine the overlap between two sets of vertices when projected onto the given axis.
	 *
	 * @param {Object[]} verticesA
	 * @param {Object[]} verticesB
	 * @param {Object} axis
	 * @returns {Object}
	 */
	overlapAxis: function (verticesA, verticesB, axis) {
		let projectionA = projectionPool[0],
			projectionB = projectionPool[1],
			result = { overlap: Number.MAX_VALUE },
			overlap;
		
		SAT.projectToAxis(projectionA, verticesA, axis);
		SAT.projectToAxis(projectionB, verticesB, axis);
		
		overlap = Math.min(projectionA.max - projectionB.min, projectionB.max - projectionA.min);
		
		if (overlap <= 0) {
			result.overlap = overlap;
			result.axis = axis;
			return result;
		}
		
		if (overlap < result.overlap) {
			result.overlap = overlap;
			result.axis = axis;
		}
		
		return result;
	},
	
	/**
	 * Project vertices onto an axis and return an interval.
	 *
	 * @param {Object} projection
	 * @param {Object[]} vertices
	 * @param {Object} axis
	 */
	projectToAxis: function (projection, vertices, axis) {
		let min = Vector.dot(vertices[0], axis),
			max = min,
			i,
			dot;
		
		for (i = 0; i < vertices.length; i += 1) {
			dot = Vector.dot(vertices[i], axis);
			
			if (dot < min) {
				min = dot;
			}
			
			if (dot > max) {
				max = dot;
			}
		}
		
		projection.min = min;
		projection.max = max;
	},
	
	/**
	 * Find supporting vertices given two bodies along a given direction using hill-climbing.
	 *
	 * @param {Object} bodyA
	 * @param {Object} bodyB
	 * @param {Object} normal
	 * @return Object[]
	 */
	findSupports: function (bodyA, bodyB, normal) {
		let i,
			nearestDistance = Number.MAX_VALUE,
			vertexToBody = Vector._temp[0],
			vertices = bodyB.vertices,
			bodyAPosition = bodyA.position,
			distance,
			vertex,
			vertexA,
			prevIndex,
			vertexB,
			nextIndex;
		
		// Find the closest vertex on bodyB
		for (i = 0; i < vertices.length; i++) {
			vertex = vertices[i];
			vertexToBody.x = vertex.x - bodyAPosition.x;
			vertexToBody.y = vertex.y - bodyAPosition.y;
			distance = -Vector.dot(normal, vertexToBody);
			
			if (distance < nearestDistance) {
				nearestDistance = distance;
				vertexA = vertex;
			}
		}
		
		// Find the next closest vertex using the two connected to it
		prevIndex = vertexA.index - 1 >= 0 ? vertexA.index - 1 : vertices.length - 1;
		vertex = vertices[prevIndex];
		vertexToBody.x = vertex.x - bodyAPosition.x;
		vertexToBody.y = vertex.y - bodyAPosition.y;
		nearestDistance = -Vector.dot(normal, vertexToBody);
		vertexB = vertex;
		
		nextIndex = (vertexA.index + 1) % vertices.length;
		vertex = vertices[nextIndex];
		vertexToBody.x = vertex.x - bodyAPosition.x;
		vertexToBody.y = vertex.y - bodyAPosition.y;
		distance = -Vector.dot(normal, vertexToBody);
		if (distance < nearestDistance) {
			vertexB = vertex;
		}
		
		return [vertexA, vertexB];
	},
	
	/**
	 * Find supporting vertices for a collision response.
	 *
	 * @param {Object} collision
	 * @return Object[]
	 */
	findCollisionSupports: function (collision) {
		let bodyA = collision.bodyA;
		let bodyB = collision.bodyB;
		
		// Find the support points; there is always either exactly one or two
		let verticesB = SAT.findSupports(bodyA, bodyB, collision.normal),
			supports = [];
		
		// Find the supports from bodyB that are inside bodyA
		if (Vertices.contains(bodyA.vertices, verticesB[0]))
			supports.push(verticesB[0]);
		
		if (Vertices.contains(bodyA.vertices, verticesB[1]))
			supports.push(verticesB[1]);
		
		// Find the supports from bodyA that are inside bodyB
		if (supports.length < 2) {
			let verticesA = SAT.findSupports(bodyB, bodyA, Vector.neg(collision.normal));
			
			if (Vertices.contains(bodyB.vertices, verticesA[0]))
				supports.push(verticesA[0]);
			
			if (supports.length < 2 && Vertices.contains(bodyB.vertices, verticesA[1]))
				supports.push(verticesA[1]);
		}
		
		// Account for the edge case of overlapping but no vertex containment
		if (supports.length < 1)
			supports = [verticesB[0]];
		
		return supports;
	}
};

export default SAT;
