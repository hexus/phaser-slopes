import Vector from 'phaser/src/physics/matter-js/lib/geometry/Vector';

const Axes = {
	/**
	 * Calculate the normals of the given vertices.
	 *
	 * Assumes vertices are specified clockwise.
	 *
	 * @param {Object[]} vertices
	 * @return {Object[]}
	 */
	fromVertices: function (vertices) {
		let i, j, normals = [];
		
		for (i = 0; i < vertices.length; i++) {
			j = (i + 1) % vertices.length;
			
			if (!vertices[i] || !vertices[j]) {
				normals[i] = null;
				continue;
			}
			
			// Normalise, perp, subtract
			normals[i] = Vector.normalise({
				x: vertices[j].y - vertices[i].y,
				y: vertices[i].x - vertices[j].x
			});
		}
		
		return normals;
	}
};

export default Axes;
