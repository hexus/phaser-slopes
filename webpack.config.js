const path = require('path');

module.exports = {
	mode: 'production',
	output: {
		path: path.join(__dirname, 'dist'),
		publicPath: '/dist/',
		filename: 'phaser-slopes.min.js'
	},
	resolve: {
		modules: [
			path.resolve(__dirname, 'src'), path.resolve(__dirname, 'node_modules')
		],
	}
};
