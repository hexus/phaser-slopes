
const Constants = {
	/**
	 * An empty tile boundary edge.
	 *
	 * @type {int}
	 */
	EMPTY: 0,
	
	/**
	 * A solid tile boundary edge.
	 *
	 * @type {int}
	 */
	SOLID: 1,
	
	/**
	 * An interesting tile boundary edge.
	 *
	 * @type {int}
	 */
	INTERESTING: 2,
	
	Directions: {
		
		/**
		 * An upward facing unit vector.
		 *
		 * @type {Object}
		 */
		UP: {x: 0.0, y: -1.0, name: 'UP'},
		
		/**
		 * A downward facing unit vector.
		 *
		 * @type {Object}
		 */
		DOWN: {x: 0.0, y: 1.0, name: 'DOWN'},
		
		/**
		 * A leftward facing unit vector.
		 *
		 * @type {Object}
		 */
		LEFT: {x: -1.0, y: 0.0, name: 'LEFT'},
		
		/**
		 * A rightward facing unit vector.
		 *
		 * @type {Object}
		 */
		RIGHT: {x: 1.0, y: 0.0, name: 'RIGHT'}
	}
};

export default Constants;
