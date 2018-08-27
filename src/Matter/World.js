import GetTileAt from 'phaser/src/tilemaps/components/GetTileAt';
import Bounds from 'phaser/src/physics/matter-js/lib/geometry/Bounds';
import Vector from 'phaser/src/physics/matter-js/lib/geometry/Vector';
import Constants from '../Constants';
import Axes from './Axes';

/**
 * Determine whether a tile is irrelevant to the plugin's edge processing.
 *
 * @param {Phaser.Tilemaps.Tile} tile
 * @return {boolean}
 */
function isIrrelevant(tile) {
	return !tile
		|| !tile.physics
		|| !tile.physics.matterBody
		|| !tile.physics.matterBody.body
		|| !tile.physics.matterBody.body.vertices
		|| !tile.physics.slopes
		|| !tile.physics.slopes.neighbours
		|| !tile.physics.slopes.edges;
}

/**
 * Calculate the squared distance between the given Vectors.
 *
 * @param {object} firstVector
 * @param {object} secondVector
 * @return {number}
 */
function distance(firstVector, secondVector) {
	return Vector.magnitudeSquared(Vector.sub(firstVector, secondVector));
}

/**
 * Determine whether a normal is contained in a set of normals.
 *
 * Skips over ignored normals.
 *
 * @param {Object} normal    - The normal to look for.
 * @param {Object[]} normals - The normals to search.
 * @return {boolean} Whether the normal is in the list of normals.
 */
function containsNormal(normal, normals) {
	let n;
	
	for (n = 0; n < normals.length; n++) {
		if (!normals[n].ignore && Vector.dot(normal, normals[n]) === 1) {
			return true;
		}
	}
	
	return false;
}

/**
 * Build a vertex for an edge.
 *
 * @param {int} index
 * @param {number} x
 * @param {number} y
 * @param {Object} tileBody
 * @param {boolean} [isGhost]
 */
function buildEdgeVertex(index, x, y, tileBody, isGhost) {
	let vertex = {
		x: x,
		y: y,
		index: index,
		body: tileBody,
		isInternal: false,
		isGhost: isGhost,
		contact: null
	};
	
	vertex.contact = {
		vertex: vertex,
		normalImpulse: 0,
		tangentImpulse: 0
	};
	
	return vertex;
}

/**
 * Build a ghost edge for a tile body.
 *
 * @param {Object} vertex1 - The first vertex of the central edge.
 * @param {Object} vertex2 - The second vertex of the central edge.
 * @param {Object} tileBody - The tile body the ghost edge belongs to.
 * @param {Object} [vertex0] - The vertex of the leading ghost edge.
 * @param {Object} [vertex3] - The vertex of the trailing ghost edge.
 */
function buildEdge(vertex1, vertex2, tileBody, vertex0, vertex3) {
	vertex0 = vertex0 || null;
	vertex3 = vertex3 || null;

	let vertices = [];
	
	// Build the vertices
	vertices.push(
		vertex0 ? buildEdgeVertex(0, vertex0.x, vertex0.y, tileBody, true) : null,
		buildEdgeVertex(1, vertex1.x, vertex1.y, tileBody),
		buildEdgeVertex(2, vertex2.x, vertex2.y, tileBody),
		vertex3 ? buildEdgeVertex(3, vertex3.x, vertex3.y, tileBody, true) : null
	);
	
	// Build the edge
	let edge = {
		vertices: vertices,
		normals: null
	};
	
	// Calculate normals
	edge.normals = Axes.fromVertices(edge.vertices);
	
	// Calculate position
	edge.position = Vector.create(
		(vertex1.x + vertex2.x) / 2,
		(vertex1.y + vertex2.y) / 2
	);
	
	edge.index = vertex1.index;
	
	return edge;
}

/**
 * Build edge normal ranges used to restrain collision responses.
 *
 * Builds ranges for front and back collisions. Which to use can be decided at
 * collision time based on the centroid of a colliding polygon being in front
 * of or behind the edges.
 *
 * Adapted from Box2D's edge collision algorithm. This implementation is used
 * to pre-process the normal ranges of edges of static bodies, rather than
 * calculating per-collision.
 *
 * @see {@link https://github.com/erincatto/Box2D/blob/336992f/Box2D/Collision/b2CollideEdge.cpp#L221-L456}
 * @param {Object} edge - The edge to build normal ranges for.
 */
function buildEdgeNormalRanges(edge) {
	let front = {};
	let back = {};
	
	let m_v0 = edge.vertices[0];
	let m_v1 = edge.vertices[1];
	let m_v2 = edge.vertices[2];
	let m_v3 = edge.vertices[3];
	
	let hasVertex0 = !!m_v0;
	let hasVertex3 = !!m_v3;
	
	let edge0;
	let edge1 = Vector.sub(m_v2, m_v1);
	edge1 = Vector.normalise(edge1);
	let edge2;
	
	let m_normal0 = edge.normals[0];
	let m_normal1 = edge.normals[1];
	let m_normal2 = edge.normals[2];

	let convex1 = false;
	let convex2 = false;
	
	// Is there a leading edge, is it convex?
	if (hasVertex0) {
		edge0 = Vector.sub(m_v1, m_v0);
		edge0 = Vector.normalise(edge0);
		convex1 = Vector.cross(edge0, edge1) >= 0.0;
	}
	
	// Is there a trailing edge, is it convex?
	if (hasVertex3) {
		edge2 = Vector.sub(m_v3, m_v2);
		edge2 = Vector.normalise(edge2);
		convex2 = Vector.cross(edge1, edge2) >= 0.0;
	}
	
	// Determine collision normal limits for front and back collisions
	if (hasVertex0 && hasVertex3) {
		if (convex1 && convex2) {
			front.normal = m_normal1;
			front.lowerLimit = m_normal0;
			front.upperLimit = m_normal2;

			back.normal = Vector.neg(m_normal1);
			back.lowerLimit = Vector.neg(m_normal1);
			back.upperLimit = Vector.neg(m_normal1);
		}  else if (convex1) {
			front.normal = m_normal1;
			front.lowerLimit = m_normal0;
			front.upperLimit = m_normal1;
			
			back.normal = Vector.neg(m_normal1);
			back.lowerLimit = Vector.neg(m_normal2);
			back.upperLimit = Vector.neg(m_normal1);
		} else if (convex2)	{
			front.normal = m_normal1;
			front.lowerLimit = m_normal1;
			front.upperLimit = m_normal2;
			
			back.normal = Vector.neg(m_normal1);
			back.lowerLimit = Vector.neg(m_normal1);
			back.upperLimit = Vector.neg(m_normal0);
		} else {
			front.normal = m_normal1;
			front.lowerLimit = m_normal1;
			front.upperLimit = m_normal1;

			back.normal = Vector.neg(m_normal1);
			back.lowerLimit = Vector.neg(m_normal2);
			back.upperLimit = Vector.neg(m_normal0);
		}
	} else if (hasVertex0) {
		if (convex1) {
			front.normal = m_normal1;
			front.lowerLimit = m_normal0;
			front.upperLimit = Vector.neg(m_normal1);
			
			back.normal = Vector.neg(m_normal1);
			back.lowerLimit = m_normal1;
			back.upperLimit = Vector.neg(m_normal1);
		} else {
			front.normal = m_normal1;
			front.lowerLimit = m_normal1;
			front.upperLimit = Vector.neg(m_normal1);
			
			back.normal = Vector.neg(m_normal1);
			back.lowerLimit = m_normal1;
			back.upperLimit = Vector.neg(m_normal0);
		}
	} else if (hasVertex3) {
		if (convex2) {
			front.normal = m_normal1;
			front.lowerLimit = Vector.neg(m_normal1);
			front.upperLimit = m_normal2;

			back.normal = Vector.neg(m_normal1);
			back.lowerLimit = Vector.neg(m_normal1);
			back.upperLimit = m_normal1;
		} else {
			front.normal = m_normal1;
			front.lowerLimit = Vector.neg(m_normal1);
			front.upperLimit = m_normal1;

			back.normal = Vector.neg(m_normal1);
			back.lowerLimit = Vector.neg(m_normal2);
			back.upperLimit = m_normal1;
		}
	} else {
		front.normal = m_normal1;
		front.lowerLimit = Vector.neg(m_normal1);
		front.upperLimit = Vector.neg(m_normal1);

		back.normal = Vector.neg(m_normal1);
		back.lowerLimit = m_normal1;
		back.upperLimit = m_normal1;
	}
	
	edge.convexPrev = convex1;
	edge.convexNext = convex2;
	
	edge.normalRanges = {
		front,
		back
	};
}

/**
 * Determine whether a vector is aligned with a 2D axis.
 *
 * @param {Object} vector
 * @returns {boolean}
 */
function isAxisAligned(vector) {
	for (let d in Constants.Directions) {
		let direction = Constants.Directions[d];
		
		if (Vector.dot(direction, vector) === 1) {
			return true;
		}
	}
	
	return false;
}

const World = {
	convertTilemapLayer: function (tilemapLayer, options) {
		let layerData = tilemapLayer.layer;
		let tiles = tilemapLayer.getTilesWithin(0, 0, layerData.width, layerData.height, { isColliding: true });
		
		this.convertTiles(tiles, options);
		this.processEdges(tilemapLayer, tiles);
		
		return this;
	},
	
	/**
	 * Process the edges of the given tiles.
	 *
	 * @param {Phaser.Tilemaps.DynamicTilemapLayer|Phaser.Tilemaps.StaticTilemapLayer} tilemapLayer - The layer the tiles belong to.
	 * @param {Phaser.Tilemaps.Tile[]} tiles - The tiles to process.
	 */
	processEdges: function (tilemapLayer, tiles) {
		let i, layerData = tilemapLayer.layer;
		
		// Pre-process the tiles
		for (i in tiles) {
			let tile = tiles[i];
			
			tile.physics.slopes = tile.physics.slopes || {};
			
			tile.physics.slopes = {
				neighbours: {
					up: GetTileAt(tile.x, tile.y - 1, true, layerData),
					down: GetTileAt(tile.x, tile.y + 1, true, layerData),
					left: GetTileAt(tile.x - 1, tile.y, true, layerData),
					right: GetTileAt(tile.x + 1, tile.y, true, layerData),
					topLeft: GetTileAt(tile.x - 1, tile.y - 1, true, layerData),
					topRight: GetTileAt(tile.x + 1, tile.y - 1, true, layerData),
					bottomLeft: GetTileAt(tile.x - 1, tile.y + 1, true, layerData),
					bottomRight: GetTileAt(tile.x + 1, tile.y + 1, true, layerData),
				},
				edges: {
					top: Constants.INTERESTING,
					bottom: Constants.INTERESTING,
					left: Constants.INTERESTING,
					right: Constants.INTERESTING
				}
			};
		}
		
		// Calculate boundary edges
		this.calculateBoundaryEdges(tiles);
		
		// Flag internal edges
		this.flagInternalEdges(tiles);
		
		// Build ghost edges and flag ignormals
		this.flagIgnormals(tiles);
	},
	
	/**
	 * Calculate the boundary edges of each tile.
	 *
	 * @param {Phaser.Tilemaps.Tile[]} tiles - The tiles to flag boundary edges for.
	 */
	calculateBoundaryEdges: function (tiles) {
		const maxDist = 5;
		
		let t, tile, i;
		
		let topLeft = Vector._temp[0],
			topRight = Vector._temp[1],
			bottomLeft = Vector._temp[2],
			bottomRight = Vector._temp[3];
		
		// Calculate initial boundary edges
		for (t = 0; t < tiles.length; t++) {
			tile = tiles[t];
			
			// Skip over irrelevant tiles
			if (isIrrelevant(tile)) {
				continue;
			}
			
			let body = tile.physics.matterBody.body;
			let vertices = body.vertices;
			
			let left = tile.pixelX;
			let right = tile.pixelX + tile.width;
			let top = tile.pixelY;
			let bottom = tile.pixelY + tile.height;
			
			topLeft.y = top;
			topLeft.x = left;
			topRight.y = top;
			topRight.x = right;
			bottomLeft.y = bottom;
			bottomLeft.x = left;
			bottomRight.y = bottom;
			bottomRight.x = right;
			
			// Identify solid boundary edges
			for (i = 0; i < vertices.length; i++) {
				let firstVertex = vertices[i];
				let secondVertex = vertices[(i + 1) % vertices.length];
				
				// Top
				if (distance(firstVertex, topLeft) < maxDist && distance(secondVertex, topRight) < maxDist) {
					tile.physics.slopes.edges.top = Constants.SOLID;
				}
				
				// Bottom
				if (distance(firstVertex, bottomRight) < maxDist && distance(secondVertex, bottomLeft) < maxDist) {
					tile.physics.slopes.edges.bottom = Constants.SOLID;
				}
				
				// Left
				if (distance(firstVertex, bottomLeft) < maxDist && distance(secondVertex, topLeft) < maxDist) {
					tile.physics.slopes.edges.left = Constants.SOLID;
				}
				
				// Right
				if (distance(firstVertex, topRight) < maxDist && distance(secondVertex, bottomRight) < maxDist) {
					tile.physics.slopes.edges.right = Constants.SOLID;
				}
			}
		}
		
		// Compare neighbouring boundary edges
		for (t = 0; t < tiles.length; t++) {
			tile = tiles[t];
			
			// Skip over irrelevant tiles
			if (isIrrelevant(tile)) {
				continue;
			}
			
			let tileEdges = tile.physics.slopes.edges;
			let neighbours = tile.physics.slopes.neighbours;
			
			let up = neighbours.up;
			let down = neighbours.down;
			let left = neighbours.left;
			let right = neighbours.right;
			
			// Identify empty edges
			if (!isIrrelevant(up)) {
				tileEdges.top = this.compareBoundaryEdges(tileEdges.top, up.physics.slopes.edges.bottom);
				tile.collideUp = tileEdges.top !== Constants.EMPTY;
			}
			
			if (!isIrrelevant(down)) {
				tileEdges.bottom = this.compareBoundaryEdges(tileEdges.bottom, down.physics.slopes.edges.top);
				tile.collideDown = tileEdges.bottom !== Constants.EMPTY;
			}
			
			if (!isIrrelevant(left)) {
				tileEdges.left = this.compareBoundaryEdges(tileEdges.left, left.physics.slopes.edges.right);
				tile.collideLeft = tileEdges.left !== Constants.EMPTY;
			}
			
			if (!isIrrelevant(right)) {
				tileEdges.right = this.compareBoundaryEdges(tileEdges.right, right.physics.slopes.edges.left);
				tile.collideRight = tileEdges.right !== Constants.EMPTY;
			}
		}
	},
	
	/**
	 * Resolve the given flags of two shared tile boundary edges.
	 *
	 * Returns the new flag to use for the first edge after comparing it with
	 * the second edge.
	 *
	 * If both edges are solid, or the first is solid and second is empty, then
	 * the empty edge flag is returned. Otherwise the first edge is returned.
	 *
	 * This compares boundary edges of each tile, not polygon edges.
	 *
	 * @method Phaser.Plugin.ArcadeSlopes.TileSlopeFactory#compareBoundaryEdges
	 * @param  {int} firstEdge  - The edge to resolve.
	 * @param  {int} secondEdge - The edge to compare against.
	 * @return {int}            - The resolved edge.
	 */
	compareBoundaryEdges: function (firstEdge, secondEdge) {
		if (firstEdge === Constants.SOLID && secondEdge === Constants.SOLID) {
			return Constants.EMPTY;
		}
		
		if (firstEdge === Constants.SOLID && secondEdge === Constants.EMPTY) {
			return Constants.EMPTY;
		}
		
		return firstEdge;
	},
	
	/**
	 * Flag the internal edges of each tile.
	 *
	 * Compares the edges of the given tiles with their direct neighbours and
	 * flags those that match.
	 *
	 * Because the polygons are represented by a set of vertices, instead of
	 * actual edges, the first vector (assuming they are specified clockwise)
	 * of each edge is flagged instead.
	 *
	 * The same applies for edge normals, and these are also flagged to be
	 * ignored in line with their respective vertices.
	 *
	 * @param {Phaser.Tilemaps.Tile[]} tiles - The tiles to flag edges for.
	 */
	flagInternalEdges: function (tiles) {
		const maxDist = 5;
		const directNeighbours = ['up', 'down', 'left', 'right'];
		
		let t, tile, n, neighbour, i, j, tv, nv, tn, nn;
		
		for (t = 0; t < tiles.length; t++) {
			tile = tiles[t];
			
			// Skip over irrelevant tiles
			if (isIrrelevant(tile)) {
				continue;
			}
			
			// Grab the tile's body and vertices to compare with its neighbours
			let tileBody = tile.physics.matterBody.body;
			let tileVertices = tileBody.vertices;
			
			// Iterate over each direct neighbour
			for (n in directNeighbours) {
				neighbour = tile.physics.slopes.neighbours[directNeighbours[n]];
				
				// Skip over irrelevant neighbouring tiles
				if (isIrrelevant(neighbour)) {
					continue;
				}
				
				// Grab the neighbour's body and vertices
				let neighbourBody = neighbour.physics.matterBody.body;
				let neighbourVertices = neighbourBody.vertices;
				
				// Skip over tile-neighbour pairs that don't overlap
				if (!Bounds.overlaps(tileBody.bounds, neighbourBody.bounds)) {
					continue;
				}
				
				tv = tileVertices;
				nv = neighbourVertices;
				tn = tileBody.axes;
				nn = neighbourBody.axes;
				
				// Iterate over the vertices of both the tile and its neighbour
				for (i = 0; i < tv.length; i++) {
					for (j = 0; j < nv.length; j++) {
						// Find distances between the vertices
						let da = Vector.magnitudeSquared(Vector.sub(tv[(i + 1) % tv.length], nv[j])),
							db = Vector.magnitudeSquared(Vector.sub(tv[i], nv[(j + 1) % nv.length]));
						
						// If both vertices are very close, consider the edge coincident (internal)
						if (da < maxDist && db < maxDist) {
							tv[i].isInternal = true;
							nv[j].isInternal = true;
							tn[i].ignore = true;
							nn[j].ignore = true;
						}
					}
				}
			}
		}
	},
	
	/**
	 * Flag normals to ignore for collision responses.
	 *
	 * Finds, builds and stores neighbouring edges leading into and out of each tile as part of this process.
	 *
	 * @param {Phaser.Tilemaps.Tile[]} tiles - The tiles to flag ignormals for.
	 */
	flagIgnormals: function (tiles) {
		const maxDist = 5;
		
		let t, tile, tileBody, tileVertices, n, neighbour, neighbourBody, neighbourVertices, i, j, tv0, tv1, tv2, tv3, nv1, nv2, edge;
		
		for (t = 0; t < tiles.length; t++) {
			tile = tiles[t];
			
			// Skip over irrelevant tiles
			if (isIrrelevant(tile)) {
				continue;
			}
			
			// Grab the tile's body and vertices to build its edges and compare with neighbours
			tileBody = tile.physics.matterBody.body;
			tileVertices = tileBody.vertices;
			
			tileBody.edges = [];
			tileBody.ignormals = [];
			
			for (i = 0; i < tileVertices.length; i++) {
				tv1 = tileVertices[i];
				tv2 = tileVertices[(i + 1) % tileVertices.length];
				
				// Find or build the edge for this tile vertex
				edge = tileBody.edges[i];
				
				// Build the edge
				edge = buildEdge(tv1, tv2, tileBody);
				edge.ignore = tv1.isInternal;
				
				// Add it to the tile's edge list
				tileBody.edges[i] = edge;
			}
			
			for (n in tile.physics.slopes.neighbours) {
				neighbour = tile.physics.slopes.neighbours[n];
				
				// Skip over irrelevant neighbouring tiles
				if (isIrrelevant(neighbour)) {
					continue;
				}
				
				// Grab the neighbour's body and vertices
				neighbourBody = neighbour.physics.matterBody.body;
				neighbourVertices = neighbourBody.vertices;
				
				// Skip over tile-neighbour pairs that don't overlap
				if (!Bounds.overlaps(tileBody.bounds, neighbourBody.bounds)) {
					continue;
				}
				
				// Iterate over the vertices of both the tile and its neighbour
				for (i = 0; i < tileVertices.length; i++) {
					tv1 = tileVertices[i];
					tv2 = tileVertices[(i + 1) % tileVertices.length];
					
					// Find the edge for this tile vertex
					edge = tileBody.edges[i];
					
					// Find neighbouring edges leading into this vertex
					for (j = 0; j < neighbourVertices.length; j++) {
						nv1 = neighbourVertices[j];
						nv2 = neighbourVertices[(j + 1) % neighbourVertices.length];
						
						// Skip internal neighbouring edges
						if (nv1.isInternal) {
							continue;
						}
						
						// Check for a leading or trailing ghost edges
						let leadingEdge = distance(tv1, nv2) < maxDist;
						let trailingEdge = distance(tv2, nv1) < maxDist;
						
						if (leadingEdge || trailingEdge) {
							// Add leading/trailing edge vertices
							if (leadingEdge && !edge.vertices[0]) {
								edge.vertices[0] = buildEdgeVertex(0, nv1.x, nv1.y, tileBody, true);
								
								// Link edges to each other
								if (neighbourBody.edges) {
									edge.prev = neighbourBody.edges[j];
									neighbourBody.edges[j].next = edge;
								}
							}
							
							if (trailingEdge && !edge.vertices[3]) {
								edge.vertices[3] = buildEdgeVertex(3, nv2.x, nv2.y, tileBody, true);
							}
							
							// Find the ignormals
							let ignormalVertex = leadingEdge ? nv2 : nv1;
							let tileEdgeNormal = tileBody.axes[i];
							let neighbourEdgeNormal = neighbourBody.axes[j];
							let ignormalCandidate = Vector.dot(tileEdgeNormal, neighbourEdgeNormal) > 0;// && !isAxisAligned(tileEdgeNormal) && !isAxisAligned(neighbourEdgeNormal);
							
							// If the tile edge normal and its neighbouring ghost edge normal are less than
							// 90 degrees different, we can set ignormals based on which bounds the joining
							// vertex lands on
							if (ignormalCandidate) {
								/**
								 * If the joining vertex is on a bounds edge, and the normal of its edge and the
								 * the neighbouring edge are not exactly the same as the corresponding direction
								 * constant, we can add an axis aligned ignormal
								 */
								
								// Leftwards ignormal
								if (Math.abs(ignormalVertex.x - tileBody.bounds.min.x) < 1 && !containsNormal(Constants.Directions.LEFT, tileBody.axes) && Vector.dot(tileEdgeNormal, Constants.Directions.LEFT) < 1 && Vector.dot(neighbourEdgeNormal, Constants.Directions.LEFT) < 1) {
									tileBody.ignormals.push(Constants.Directions.LEFT);
								}
								
								// Upwards ignormal
								if (Math.abs(ignormalVertex.y - tileBody.bounds.min.y) < 1 && !containsNormal(Constants.Directions.UP, tileBody.axes) && Vector.dot(tileEdgeNormal, Constants.Directions.UP) < 1 && Vector.dot(neighbourEdgeNormal, Constants.Directions.UP) < 1) {
									tileBody.ignormals.push(Constants.Directions.UP);
								}
								
								// Rightwards ignormal
								if (Math.abs(ignormalVertex.x - tileBody.bounds.max.x) < 1 && !containsNormal(Constants.Directions.RIGHT, tileBody.axes) && Vector.dot(tileEdgeNormal, Constants.Directions.RIGHT) < 1 && Vector.dot(neighbourEdgeNormal, Constants.Directions.RIGHT) < 1) {
									tileBody.ignormals.push(Constants.Directions.RIGHT);
								}
								
								// Downwards ignormal
								if (Math.abs(ignormalVertex.y - tileBody.bounds.max.y) < 1 && !containsNormal(Constants.Directions.DOWN, tileBody.axes) && Vector.dot(tileEdgeNormal, Constants.Directions.DOWN) < 1 && Vector.dot(neighbourEdgeNormal, Constants.Directions.DOWN) < 1) {
									tileBody.ignormals.push(Constants.Directions.DOWN);
								}
							}
						}
					}
				}
			}
			
			// Resolve edge normal data, now that we've seen all the neighbours
			// and ensure ghost vertices are set on each edge
			for (i = 0; i < tileVertices.length; i++) {
				edge = tileBody.edges[i];
				
				if (edge.ignore) {
					continue;
				}
				
				tv0 = tileVertices[((i - 1) % tileVertices.length + tileVertices.length) % tileVertices.length];
				tv1 = tileVertices[i];
				tv2 = tileVertices[(i + 1) % tileVertices.length];
				tv3 = tileVertices[(i + 2) % tileVertices.length];
				
				// Use this body's vertices as ghost vertices if neighbours
				// haven't provided them, and if they aren't internal edges
				if (!edge.vertices[0] && !tv0.isInternal) {
					edge.vertices[0] = buildEdgeVertex(0, tv0.x, tv0.y, tileBody, true);
				}
				
				if (!edge.vertices[3] && !tv2.isInternal) {
					edge.vertices[3] = buildEdgeVertex(3, tv3.x, tv3.y, tileBody, true);
				}
				
				// Calculate edge normals
				edge.normals = Axes.fromVertices(edge.vertices);
				
				// Calculate edge normal ranges
				buildEdgeNormalRanges(edge);
			}
		}
	}
};

export default World;
