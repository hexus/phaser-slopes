import Vector from 'phaser/src/physics/matter-js/lib/geometry/Vector';

let Resolver = {};

/**
 * Vertex body and edge body collision pairs, keyed by vertex body ID.
 *
 * The shortest separation for a body from its colliding edge bodies can be
 * resolved from these lists of pairs.
 *
 * @type {{}}
 * @var edgePairsMap
 */

/**
 * Prepare pairs for position solving.
 *
 * This override includes handling for body vs. edge collisions.
 *
 * Groups regular bodies with their edge collisions and, for each of them:
 * - Finds and activates the shortest edge collision
 * - Activates similar collisions to the shortest, or those from edges concave
 *   to that of the shortest
 *
 * TODO: Move this override to an isolated event listener.
 *
 * @param {Object[]} pairs
 */
Resolver.preSolvePosition = function (pairs) {
	let i,
		pair,
		activeCount,
		hasEdgesA,
		hasEdgesB,
		vertexBody,
		edgeBody,
		j,
		edgePairsMap = {},
		edgePairs,
		minimumDepth,
		shortestPair;
	
	const debug = scene.ecs.engine.systems.debug;
	
	// Find the total number of contacts on each body, build a map of vertex
	// bodies to their colliding edges
	for (i = 0; i < pairs.length; i++) {
		pair = pairs[i];
		
		if (!pair.isActive) {
			continue;
		}
		
		// Retain a list of edge collision pairs
		hasEdgesA = !!pair.collision.parentA.edges;
		hasEdgesB = !!pair.collision.parentB.edges;
		
		if ((hasEdgesA && !hasEdgesB) || (!hasEdgesA && hasEdgesB)) {
			edgeBody = hasEdgesA ? pair.collision.parentA : pair.collision.parentB;
			vertexBody = hasEdgesA ? pair.collision.parentB : pair.collision.parentA;
			
			// Disable all edge collisions until we flag the smallest and
			// accumulate its total contacts
			pair.isActive = false;
			
			if (!edgePairsMap[vertexBody.id]) {
				edgePairsMap[vertexBody.id] = [];
			}
			
			edgePairsMap[vertexBody.id].push(pair);
			
			// Prevent these pairs from contributing to total contacts here
			continue;
		}
		
		// Accumulate total contacts for both bodies in the pair
		activeCount = pair.activeContacts.length;
		pair.collision.parentA.totalContacts += activeCount;
		pair.collision.parentB.totalContacts += activeCount;
	}
	
	// Enable the shortest edge collision pair and accumulate its contacts,
	// then enable pairs similar to or roughly concave to that shortest edge
	for (i in edgePairsMap) {
		edgePairs = edgePairsMap[i];
		
		if (!edgePairs.length) {
			continue;
		}
		
		// Find the shortest pair
		minimumDepth = Number.MAX_VALUE;
		shortestPair = null;
		
		for (j = 0; j < edgePairs.length; j++) {
			pair = edgePairs[j];
			
			if (pair.collision.depth < minimumDepth) {
				minimumDepth = pair.collision.depth;
				shortestPair = pair;
			}
		}
		
		if (!shortestPair) {
			continue;
		}
		
		// Enable the shortest pair
		shortestPair.isActive = true;
		
		// Accumulate the contacts of the shortest pair
		shortestPair.collision.parentA.totalContacts += shortestPair.activeContacts.length;
		shortestPair.collision.parentB.totalContacts += shortestPair.activeContacts.length;
		
		// Activate edges similar to or concave to the shortest edge
		for (j = 0; j < edgePairs.length; j++) {
			pair = edgePairs[j];
			
			// Skip the shortest pair, it's already active
			if (pair === shortestPair) {
				debug.renderEdgeCollision(pair.collision);
				debug.writeCollision(pair.collision, { primary: true });
				continue;
			}
			
			// Enable edges with normals similar to the shortest edge's collision normal
			// and edges with normals similar to the shortest edge's actual normal
			let edgeNormalIsSimilar = Vector.dot(shortestPair.collision.edge.normals[1], pair.collision.edge.normals[1]) > 0.99;
			let edgeCollisionIsSimilar = Vector.dot(shortestPair.collision.normal, pair.collision.normal) > 0.99;
			let edgeNormalIsSimilarToCollision = Vector.dot(shortestPair.collision.normal, pair.collision.edge.normals[1]) > 0.99;
			
			if (edgeNormalIsSimilar || edgeCollisionIsSimilar || edgeNormalIsSimilarToCollision) {
				pair.isActive = true;
			}
			
			// If the vector between this edge and the shortest oppose the
			// normal of the shortest, we can assume it's concave
			let edgePositionDelta = Vector.sub(pair.collision.edge.position, shortestPair.collision.edge.position);
			let edgeIsConcave = Vector.dot(edgePositionDelta, shortestPair.collision.edge.normals[1]) >= 0;
			let edgeCollisionIsConcave = Vector.dot(edgePositionDelta, pair.collision.normal) >= 0;
			
			if (edgeIsConcave || edgeCollisionIsConcave) {
				pair.isActive = true;
			}
			
			// Accumulate the contacts of any activated pairs
			if (pair.isActive) {
				pair.collision.parentA.totalContacts += pair.activeContacts.length;
				pair.collision.parentB.totalContacts += pair.activeContacts.length;
			}
			
			// Debug rendering
			if (pair.isActive) {
				debug.renderEdgeCollision(pair.collision, { lineColor: 0x00ffff }, { fillColor: 0x00ffff });
				debug.writeCollision(pair.collision, { secondary: true });
			} else {
				debug.renderEdgeCollision(pair.collision, { lineColor: 0xff0000 }, { fillColor: 0xff0000 });
				debug.writeCollision(pair.collision, { disabled: true });
			}
		}
	}
};

export default Resolver;
