import Vector from 'phaser/src/physics/matter-js/lib/geometry/Vector';

let Resolver = {};

/**
 * Vertex body and edge body collision pairs, keyed by vertex body ID.
 *
 * Shortest separation for a body from its colliding edge bodies can be resolved
 * from these lists of pairs.
 *
 * @type {{}}
 * @var edgePairsMap
 */

/**
 * Prepare pairs for position solving.
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
		minimumImpulsePair;
	
	// Find the total number of contacts on each body
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
			
			// Skip all edge collisions until we flag the smallest and
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
	// then enable pairs roughly concave to that edge
	for (i in edgePairsMap) {
		edgePairs = edgePairsMap[i];
		
		if (!edgePairs.length) {
			continue;
		}
		
		// Find the shortest pair
		minimumDepth = Number.MAX_VALUE;
		minimumImpulsePair = null;
		
		for (j = 0; j < edgePairs.length; j++) {
			pair = edgePairs[j];
			
			if (pair.collision.depth < minimumDepth) {
				minimumDepth = pair.collision.depth;
				minimumImpulsePair = pair;
			}
		}
		
		// Accumulate the contacts of the shortest pair
		minimumImpulsePair.isActive = true;
		minimumImpulsePair.collision.parentA.totalContacts += minimumImpulsePair.activeContacts.length;
		minimumImpulsePair.collision.parentB.totalContacts += minimumImpulsePair.activeContacts.length;
		
		// Activate edge similar to or concave to the shortest edge
		for (j = 0; j < edgePairs.length; j++) {
			pair = edgePairs[j];
			
			// Skip the minimum pair
			if (pair === minimumImpulsePair) {
				scene.ecs.engine.systems.debug.renderMatterBodyEdge(pair.collision.edge);
				continue;
			}
			
			// If this edge's normal pushes away from the delta vector between
			// itself and the other edge, we can assume concavity
			let edgePositionDelta = Vector.sub(pair.collision.edge.position, minimumImpulsePair.collision.edge.position);
			
			if (Vector.dot(edgePositionDelta, pair.collision.edge.normals[1]) <= 0) {
				pair.isActive = true;
			}
			
			// Accumulate the contacts of any pairs concave to the shortest pair
			if (pair.isActive) {
				scene.ecs.engine.systems.debug.renderMatterBodyEdge(pair.collision.edge);
				pair.collision.parentA.totalContacts += pair.activeContacts.length;
				pair.collision.parentB.totalContacts += pair.activeContacts.length;
			}
		}
	}
};

export default Resolver;
