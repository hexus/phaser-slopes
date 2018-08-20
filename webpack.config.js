const path = require('path');

module.exports = {
	mode: 'production',
	output: {
		path: path.join(__dirname, 'dist'),
		filename: 'phaser-slopes.min.js',
		library: 'Slopes',
		libraryExport: 'default',
		libraryTarget: 'umd',
		umdNamedDefine: true
	},
	resolve: {
		modules: [
			path.resolve(__dirname, 'src'), path.resolve(__dirname, 'node_modules')
		],
	}
};
