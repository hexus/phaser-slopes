# Phaser 3 Slopes Plugin

A [Phaser 3](https://github.com/photonstorm/phaser) Plugin that smooths out MatterJS tilemap collisions.

# Installation

## npm

Install the plugin as a dependency of your project using [npm](https://www.npmjs.com/).

```bash
npm install hexus/phaser-slopes
```

# Usage

Load the plugin into your `Scene`.

```js
import Slopes from 'phaser-slopes';

class GameScene extends Phaser.Scene
{
    preload() {
        this.load.scenePlugin('Slopes', Slopes, 'slopes');
    }
}
```

Any Tilemap Layers you create within `Scene`s that use the plugin will automatically collide smoothly with other physics
bodies.
