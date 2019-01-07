import Overrides from './Overrides';

/**
 * Prototype plugin for smooth tilemap collisions with MatterJS.
 */
export default class Slopes
{
	/**
	 * Create a new Slopes plugin.
	 *
	 * @param {Phaser.Scene} scene - The Scene to which this plugin instance belongs.
	 */
	constructor(scene) {
		/**
		 * The Scene to which this plugin instance belongs.
		 *
		 * @type {Phaser.Scene} scene
		 */
		this.scene = scene;

		/**
		 * References to the original overridden methods.
		 *
		 * @type {Object.<string, Function>}
		 */
		this.overridden = {};
	}

	boot() {
		let events = this.scene.sys.events;

		events.on('start', this.start, this);
		events.on('shutdown', this.shutdown, this);
		events.on('destroy', this.destroy, this);

		this.start();
	}
	
	/**
	 * Start the plugin.
	 *
	 * Overrides functions to augment their behaviour.
	 */
	start() {
		if (!Phaser || !Phaser.Physics || !Phaser.Physics.Matter) {
			console.warn('Phaser Slopes plugin could not find Phaser or Matter.js during start up');
			return;
		}
		
		let Axes     = Phaser.Physics.Matter.Matter.Axes;
		let Resolver = Phaser.Physics.Matter.Matter.Resolver;
		let SAT      = Phaser.Physics.Matter.Matter.SAT;
		let World    = Phaser.Physics.Matter.World;
		
		// Keep references to the original methods
		this.overridden.convertTilemapLayer = World.prototype.convertTilemapLayer;
		this.overridden.processEdges = World.prototype.processEdges;
		this.overridden.collides = SAT.collides;
		this.overridden.fromVertices = Axes.fromVertices;
		this.overridden.solvePosition = Resolver.solvePosition;
		this.overridden.preSolvePosition = Resolver.preSolvePosition;
		
		// Override these methods
		Axes.fromVertices = Overrides.Matter.Axes.fromVertices;
		Resolver.preSolvePosition = Overrides.Matter.Resolver.preSolvePosition;
		SAT.collides = Overrides.Matter.SAT.collides;
		World.prototype.convertTilemapLayer = Overrides.Matter.World.convertTilemapLayer;
		World.prototype.processEdges = Overrides.Matter.World.processEdges;
		
		// Set extra properties and methods
		World.prototype.calculateBoundaryEdges = Overrides.Matter.World.calculateBoundaryEdges;
		World.prototype.compareBoundaryEdges = Overrides.Matter.World.compareBoundaryEdges;
		World.prototype.calculateEdgeNormals = Overrides.Matter.World.calculateEdgeNormals;
		World.prototype.flagInternalEdges = Overrides.Matter.World.flagInternalEdges;
		World.prototype.flagIgnoredAxes = Overrides.Matter.World.flagIgnoredAxes;
		World.prototype.flagIgnormals = Overrides.Matter.World.flagIgnormals;
	}
	
	/**
	 * Shut down the plugin.
	 *
	 * Restores original implementations of all overridden functions.
	 */
	shutdown() {
		if (!Phaser || !Phaser.Physics) {
			console.warn('Phaser Slopes plugin could not find Phaser during shutdown');
			return;
		}
		
		let Axes     = Phaser.Physics.Matter.Matter.Axes;
		let Resolver = Phaser.Physics.Matter.Matter.Resolver;
		let SAT      = Phaser.Physics.Matter.Matter.SAT;
		let World    = Phaser.Physics.Matter.World;
		
		// Restore the original methods
		Axes.fromVertices = this.overridden.fromVertices;
		Resolver.preSolvePosition = this.overridden.preSolvePosition;
		Resolver.solvePosition = this.overridden.solvePosition;
		SAT.collides = this.overridden.collides;
		World.prototype.convertTilemapLayer = this.overridden.convertTilemapLayer;
		World.prototype.processEdges = this.overridden.processEdges;
		
		// Delete the extra methods
		delete World.prototype.calculateBoundaryEdges;
		delete World.prototype.compareBoundaryEdges;
		delete World.prototype.calculateEdgeNormals;
		delete World.prototype.flagInternalEdges;
		delete World.prototype.flagIgnoredAxes;
		delete World.prototype.flagIgnormals;
	}

	destroy() {
		this.shutdown();
		
		this.scene = null;
		this.overridden = null;
	}
}
