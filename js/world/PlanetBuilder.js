import * as THREE from 'three';
import Windmill from '../entities/props/Windmill.js';
import Tree from '../entities/props/Tree.js';
import Volcano from '../entities/props/Volcano.js';
import LampPost from '../entities/props/LampPost.js';

const TALL_WINDMILL_DIR = new THREE.Vector3(-0.62, 1, 0.18);
const SHORT_WINDMILL_DIR = new THREE.Vector3(0.88, 0.72, -0.52);
const SMALL_WINDMILL_DIR = new THREE.Vector3(-0.85, 0.62, -0.48);
const SMALLER_WINDMILL_DIR = new THREE.Vector3(0.15, -1.0, 0.6);

export default class PlanetBuilder {
	constructor(planets, assets = {}) {
		this.planets = planets;
		this.assets = assets;
	}

	populate() {
		this._populateLavaPlanet();
		this._populateGreenPlanet();
	}

	_populateLavaPlanet() {
		const lavaPlanet = this.planets.lava;

		if (!lavaPlanet) {
			console.warn('Lava planet not found.');
			return;
		}

		this._addLavaPlanetVolcanoes(lavaPlanet);
		this._addLavaPlanetLampPosts(lavaPlanet);
	}

	_populateGreenPlanet() {
		const greenPlanet = this.planets.green;

		if (!greenPlanet) {
			console.warn('Green planet not found.');
			return;
		}

		this._addGreenPlanetWindmills(greenPlanet);
		this._addGreenPlanetTrees(greenPlanet);
	}

	_addLavaPlanetVolcanoes(lavaPlanet) {
		const volcanoConfigs = [
			{
				direction: new THREE.Vector3(0.2, 1, 0.15),
				height: 0.09,
				width: 0.16,
				rotation: 0.3
			},
			{
				direction: new THREE.Vector3(-0.55, 0.65, 0.4),
				height: 0.08,
				width: 0.13,
				rotation: 1.7,
				rockColor: 0x33140f
			},
			{
				direction: new THREE.Vector3(0.62, -0.4, -0.55),
				height: 0.07,
				width: 0.14,
				rotation: -1.2,
				lavaColor: 0xff6a1f
			}
		];

		volcanoConfigs.forEach((config, index) => {
			const volcano = new Volcano({
				height: config.height,
				width: config.width,
				phase: index * 1.2
			});

			lavaPlanet.addProp(
				volcano,
				config.direction,
				0.04,
			);

			volcano.root.rotateY(config.rotation);
		});
	}

	_addLavaPlanetLampPosts(lavaPlanet) {
		const lampConfigs = [
			{
				direction: new THREE.Vector3(0.9, 0.2, 0.35),
				height: 0.52,
				width: 0.05,
				rotation: -0.8
			},
			{
				direction: new THREE.Vector3(-0.35, 0.85, -0.25),
				height: 0.48,
				width: 0.045,
				rotation: 1.4
			},
			{
				direction: new THREE.Vector3(-0.65, -0.35, 0.55),
				height: 0.46,
				width: 0.04,
				rotation: 2.6
			}
		];

		lampConfigs.forEach((config, index) => {
			const lampPost = new LampPost({
				gltf: this.assets.lampPostGLTF,
				height: config.height,
				width: config.width,
				initiallyLit: true,
				phase: index * 1.7
			});

			lavaPlanet.addProp(
				lampPost,
				config.direction,
				0
			);

			lampPost.root.rotateY(config.rotation);
		});
	}

	_addGreenPlanetWindmills(greenPlanet) {
		const tallWindmill = new Windmill({
			height: 0.82,
			width: 0.48,
			spinSpeed: 1.0
		});

		greenPlanet.addProp(
			tallWindmill,
			TALL_WINDMILL_DIR,
			0.03
		);

		tallWindmill.root.rotateY(0.65);

		const shortWindmill = new Windmill({
			height: 0.50,
			width: 0.58,
			spinSpeed: 0.65,
			bodyColor: 0xcdbb91,
			roofColor: 0x9f2f2f
		});

		greenPlanet.addProp(
			shortWindmill,
			SHORT_WINDMILL_DIR,
			0.026
		);

		shortWindmill.root.rotateY(-1.85);

		const smallWindmill = new Windmill({
			height: 0.48,
			width: 0.34,
			spinSpeed: 1.25,
			bodyColor: 0xd6c4a0,
			roofColor: 0xb84a38,
			bladeColor: 0xf5e7c8
		});

		greenPlanet.addProp(
			smallWindmill,
			SMALL_WINDMILL_DIR,
			0.024
		);

		smallWindmill.root.rotateY(2.25);

		const smallerWindmill = new Windmill({
			height: 0.42,
			width: 0.32,
			spinSpeed: 1.3,
			bodyColor: 0xd1bd95,
			roofColor: 0xa84838,
			bladeColor: 0xf2e8c9
		});

		greenPlanet.addProp(
			smallerWindmill,
			SMALLER_WINDMILL_DIR,
			0.024
		);

		smallerWindmill.root.rotateY(1.4);
	}

	_addGreenPlanetTrees(greenPlanet) {
		const treeConfigs = [
			// Grove 1: fuller forest patch, front/right-ish
			{
				direction: new THREE.Vector3(0.42, 1.0, 0.62),
				height: 0.50,
				width: 0.30,
				rotation: 0.2,
				variant: 'round',
				leafColor: 0x3fa34d
			},
			{
				direction: new THREE.Vector3(0.58, 0.92, 0.52),
				height: 0.42,
				width: 0.25,
				rotation: 1.4,
				variant: 'pine',
				leafColor: 0x2f9e44
			},
			{
				direction: new THREE.Vector3(0.25, 1.05, 0.72),
				height: 0.36,
				width: 0.22,
				rotation: -0.8,
				variant: 'round',
				leafColor: 0x4caf50,
				leafLightColor: 0x8fd16a
			},
			{
				direction: new THREE.Vector3(0.72, 0.82, 0.32),
				height: 0.32,
				width: 0.20,
				rotation: 2.1,
				variant: 'pine',
				leafColor: 0x2e8f42
			},
			{
				direction: new THREE.Vector3(0.12, 1.02, 0.58),
				height: 0.44,
				width: 0.26,
				rotation: -2.5,
				variant: 'round',
				leafDarkColor: 0x1f6f35
			},

			// Grove 2: back/cold side, denser mini-forest
			{
				direction: new THREE.Vector3(-0.28, 0.78, -0.92),
				height: 0.48,
				width: 0.28,
				rotation: 0.9,
				variant: 'pine',
				leafColor: 0x2f8f3a
			},
			{
				direction: new THREE.Vector3(-0.08, 0.86, -0.98),
				height: 0.38,
				width: 0.23,
				rotation: -1.6,
				variant: 'pine',
				leafColor: 0x267a3a
			},
			{
				direction: new THREE.Vector3(-0.46, 0.7, -0.78),
				height: 0.34,
				width: 0.21,
				rotation: 2.8,
				variant: 'round',
				leafColor: 0x4caf50
			},
			{
				direction: new THREE.Vector3(-0.18, 0.62, -1.1),
				height: 0.30,
				width: 0.19,
				rotation: 0.4,
				variant: 'pine',
				leafDarkColor: 0x1c6430
			},
			{
				direction: new THREE.Vector3(-0.58, 0.84, -0.55),
				height: 0.40,
				width: 0.24,
				rotation: -2.0,
				variant: 'round',
				leafLightColor: 0x83cf63
			},

			// Grove 3: far side, breaks up empty silhouette
			{
				direction: new THREE.Vector3(-0.98, 0.38, 0.48),
				height: 0.46,
				width: 0.27,
				rotation: 1.2,
				variant: 'round',
				leafColor: 0x3fa34d
			},
			{
				direction: new THREE.Vector3(-1.08, 0.28, 0.22),
				height: 0.35,
				width: 0.22,
				rotation: -0.5,
				variant: 'pine',
				leafColor: 0x2f9e44
			},
			{
				direction: new THREE.Vector3(-0.82, 0.48, 0.72),
				height: 0.30,
				width: 0.19,
				rotation: 2.4,
				variant: 'round',
				leafColor: 0x4caf50
			},

			// A few lonely trees, intentionally not evenly spaced
			{
				direction: new THREE.Vector3(0.02, 1.08, -0.32),
				height: 0.34,
				width: 0.21,
				rotation: -1.1,
				variant: 'pine',
				leafColor: 0x2e8f42
			},
			{
				direction: new THREE.Vector3(0.64, 0.55, -0.82),
				height: 0.28,
				width: 0.18,
				rotation: 0.7,
				variant: 'round',
				leafDarkColor: 0x1f6f35
			},
			{
				direction: new THREE.Vector3(-0.34, 1.05, 0.52),
				height: 0.31,
				width: 0.19,
				rotation: -2.2,
				variant: 'pine',
				leafColor: 0x3fa34d
			},
			{
				direction: new THREE.Vector3(0.28, 0.58, 1.0),
				height: 0.33,
				width: 0.20,
				rotation: 1.9,
				variant: 'round',
				leafLightColor: 0x8fd16a
			},
			{
				direction: new THREE.Vector3(0.52, -0.82, 0.35),
				height: 0.36,
				width: 0.22,
				rotation: 1.7,
				variant: 'round',
				leafColor: 0x4caf50,
				leafLightColor: 0x8fd16a
			},
			{
				direction: new THREE.Vector3(-0.28, -0.92, 0.62),
				height: 0.40,
				width: 0.25,
				rotation: 2.4,
				variant: 'round',
				leafColor: 0x3fa34d
			},
			{
				direction: new THREE.Vector3(-0.95, -0.18, 0.45),
				height: 0.46,
				width: 0.28,
				rotation: -1.2,
				variant: 'pine',
				leafColor: 0x267a3a,
				leafLightColor: 0x75bd58
			},
			{
				direction: new THREE.Vector3(-1.1, 0.05, 0.15),
				height: 0.34,
				width: 0.21,
				rotation: 0.6,
				variant: 'round',
				leafColor: 0x4caf50
			},
			{
				direction: new THREE.Vector3(1.05, -0.05, -0.22),
				height: 0.44,
				width: 0.27,
				rotation: 1.1,
				variant: 'pine',
				leafColor: 0x2e8f42
			},
			{
				direction: new THREE.Vector3(0.72, -0.35, -0.78),
				height: 0.31,
				width: 0.19,
				rotation: -0.3,
				variant: 'round',
				leafLightColor: 0x83cf63
			},
			{
				direction: new THREE.Vector3(-0.2, -1.05, -0.28),
				height: 0.28,
				width: 0.18,
				rotation: 2.7,
				variant: 'pine',
				leafColor: 0x2f9e44
			},
			{
				direction: new THREE.Vector3(0.35, -1.0, -0.32),
				height: 0.30,
				width: 0.19,
				rotation: -1.8,
				variant: 'round',
				leafColor: 0x4caf50
			},
			{
				direction: new THREE.Vector3(1.15, 0.08, 0.18),
				height: 0.38,
				width: 0.23,
				rotation: 0.8,
				variant: 'pine',
				leafColor: 0x2f9e44
			},
			{
				direction: new THREE.Vector3(1.05, -0.04, 0.48),
				height: 0.32,
				width: 0.20,
				rotation: -1.1,
				variant: 'round',
				leafColor: 0x4caf50,
				leafLightColor: 0x83cf63
			},
			{
				direction: new THREE.Vector3(0.88, 0.02, -0.72),
				height: 0.42,
				width: 0.25,
				rotation: 2.2,
				variant: 'pine',
				leafColor: 0x267a3a
			},
			{
				direction: new THREE.Vector3(0.55, -0.08, -1.02),
				height: 0.34,
				width: 0.21,
				rotation: -2.6,
				variant: 'round',
				leafDarkColor: 0x1f6f35
			},
			{
				direction: new THREE.Vector3(-0.25, 0.05, -1.12),
				height: 0.40,
				width: 0.24,
				rotation: 1.5,
				variant: 'pine',
				leafColor: 0x2e8f42
			},
			{
				direction: new THREE.Vector3(-0.72, -0.02, -0.88),
				height: 0.31,
				width: 0.19,
				rotation: -0.4,
				variant: 'round',
				leafColor: 0x3fa34d
			},
			{
				direction: new THREE.Vector3(-1.12, 0.06, -0.25),
				height: 0.44,
				width: 0.26,
				rotation: 2.8,
				variant: 'pine',
				leafColor: 0x2f8f3a,
				leafLightColor: 0x75bd58
			},
			{
				direction: new THREE.Vector3(-1.05, -0.04, 0.42),
				height: 0.36,
				width: 0.22,
				rotation: -1.9,
				variant: 'round',
				leafColor: 0x4caf50
			},
			{
				direction: new THREE.Vector3(-0.52, 0.03, 1.02),
				height: 0.39,
				width: 0.23,
				rotation: 0.3,
				variant: 'pine',
				leafDarkColor: 0x1c6430
			},
			{
				direction: new THREE.Vector3(0.18, -0.05, 1.15),
				height: 0.33,
				width: 0.20,
				rotation: 2.0,
				variant: 'round',
				leafColor: 0x3fa34d,
				leafLightColor: 0x8fd16a
			}
		];

		treeConfigs.forEach((config, index) => {
			this._addGreenPlanetTree(greenPlanet, config, index);
		});
	}

	_addGreenPlanetTree(greenPlanet, config, index) {
		const tree = new Tree({
			height: config.height,
			width: config.width,
			variant: config.variant,
			leafColor: config.leafColor,
			leafDarkColor: config.leafDarkColor,
			leafLightColor: config.leafLightColor,
			phase: index * 1.37,
			swaySpeed: 0.85 + (index % 5) * 0.12,
			swayAmount: config.variant === 'pine' ? 0.08 : 0.103
		});

		greenPlanet.addProp(
			tree,
			config.direction,
			0.01
		);

		tree.root.rotateY(config.rotation);
	}
}
