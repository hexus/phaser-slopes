# Phaser 3 Slopes Plugin

A [Phaser 3](https://github.com/photonstorm/phaser) Plugin that smooths out MatterJS Tilemap Layer collisions.

<img width="49%" src="screenshots/before.gif"/> <img width="49%" src="screenshots/after.gif"/>

:hammer_and_wrench: This plugin is under development. Feel free to
[report any issues](https://github.com/hexus/phaser-slopes/issues/new) that you find.

---

Looking for a [Phaser CE](https://github.com/photonstorm/phaser-ce) plugin?
Check out [Phaser Arcade Slopes](https://github.com/hexus/phaser-arcade-slopes).

## Compatibility

| Phaser               | Phaser Slopes |
|----------------------|---------------|
| 3.12.0-beta - 3.55.x | ^0.1.0        |
| 3.60.0-beta.4+       | ^0.2.0-beta   |

## Usage

Install the plugin as a dependency of your project using [npm](https://www.npmjs.com/).

```bash
npm install phaser-slopes
```

Load the plugin into your Scene.

```js
import Slopes from 'phaser-slopes';

class GameScene extends Phaser.Scene
{
    preload() {
        this.load.scenePlugin('Slopes', Slopes);
    }
}
```

You can use Phaser to load the plugin as a script if you're not using [npm](https://www.npmjs.com/) for dependency
management.

```js
class GameScene extends Phaser.Scene
{
    preload() {
        this.load.scenePlugin('Slopes', 'phaser-slopes.min.js');
    }
}
```

Any MatterJS Tilemap Layers you create within the Scene will automatically collide smoothly with other physics bodies.


