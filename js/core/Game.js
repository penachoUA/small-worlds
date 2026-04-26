import * as THREE from 'three'
import Planet from '../entities/Planet.js';
import Star from '../entities/Star.js';
import Player from '../entities/Player.js';
import PlayerController from '../controllers/PlayerController.js'
import CameraController from '../controllers/CameraController.js';
import CameraRig from '../camera/CameraRig.js';
import InputHandler from './InputHandler.js';

const CONTROLS = {
	CYCLE_CAMERA: 'KeyV',
	PLANET_PREFIX: 'Digit',
	TOGGLE_DEBUG: 'KeyB',
};

const CAMERA_MODES = {
	SYSTEM: 'system',
	THIRD_PERSON: 'thirdPerson',
	FIRST_PERSON: 'firstPerson',
	PLANET: 'planet',
};

const CAMERA_CONFIGS = {
	[CAMERA_MODES.THIRD_PERSON]: {
		sensitivity: 0.002,
		minPitch: -1.5,
		maxPitch: 0.3,
		autoCenter: true,
		pitch: -0.2
	},
	[CAMERA_MODES.FIRST_PERSON]: {
		sensitivity: 0.001,
		minPitch: -1.0,
		maxPitch: 1.0,
		autoCenter: true
	},
	[CAMERA_MODES.PLANET]: {
		sensitivity: 0.0035,
		unconstrained: true,
	},
	[CAMERA_MODES.SYSTEM]: {
		sensitivity: 0.003,
		minPitch: -Math.PI / 2,
		maxPitch: Math.PI / 2,
		pitch: -0.2
	}
};

export default class Game {
	constructor(scene, renderer, debug = false) {
		this.clock = new THREE.Clock();
		this.scene = scene;
		this.renderer = renderer;
		this.input = new InputHandler();
		this.cameraRig = new CameraRig();

		this._initLighting();
		this._initSystem();
		this._initPlayer();
		this._initControllers();
		this._initResizeHandler();

		this.setCameraMode('system');

		this.debugActive = !debug;
		this._toggleDebugMode();

		this.renderer.setAnimationLoop(() => this.update());
	}

	update() {
		const delta = this.clock.getDelta();
		this.planets.forEach((p) => p.move());

		if (this.cameraMode === CAMERA_MODES.THIRD_PERSON || this.cameraMode === CAMERA_MODES.FIRST_PERSON) {
			this.playerController.update();
			this.player.update(delta);
		}

		// Handle camera mode changes
		if (this.input.isTapped(CONTROLS.CYCLE_CAMERA)) {
			this.cycleCameraMode();
		}

		// Handle planet change
		for (let i = 0; i < this.planets.length; i++) {
			if (this.input.isTapped(`${CONTROLS.PLANET_PREFIX}${i + 1}`)) {
				this.changePlanet(i);
			}
		}

		// Handle camera
		this.activeCameraController.update(this.player.isMoving);
		this.renderer.render(this.scene, this.cameraRig.camera);

		// Handle debug mode toggling
		if (this.input.isTapped(CONTROLS.TOGGLE_DEBUG)) {
			this._toggleDebugMode();
		}

		this.player.resetState();
		this.input.afterUpdate();
	}

	setCameraMode(mode) {
		this.cameraMode = mode;

		if (this.cameraControllers[mode]) {
			this.activeCameraController = this.cameraControllers[mode];
		} else {
			this.activeCameraController = null;
		}

		switch (this.cameraMode) {
			case CAMERA_MODES.THIRD_PERSON:
				this.player.attachToModel(this.cameraRig);
				this.cameraRig.setPosition(0, this.player.height * 0.01, 0);
				this.cameraRig.setCameraPosition(0, this.player.height * 1, this.player.height * 2);
				break;

			case CAMERA_MODES.FIRST_PERSON:
				this.player.attachToModel(this.cameraRig);
				this.cameraRig.setPosition(0, this.player.height * 0.8, 0);
				this.cameraRig.setCameraPosition(0, 0, 0);
				break;

			case CAMERA_MODES.PLANET:
				this.currentPlanet.addToSurface(this.cameraRig);
				this.cameraRig.setPosition(0, 0, 0);
				this.cameraRig.setCameraPosition(0, 0, this.currentPlanet.radius * 2);
				break;

			case CAMERA_MODES.SYSTEM:
				this.cameraRig.addTo(this.scene);
				this.cameraRig.setPosition(0, 0, 0);
				this.cameraRig.setCameraPosition(0, 0, 70);
				break;
		}

		if (this.activeCameraController) {
			this.activeCameraController.reset();
		}
	}

	cycleCameraMode() {
		const modesArray = Object.values(CAMERA_MODES);
		const i = modesArray.indexOf(this.cameraMode);
		this.setCameraMode(modesArray[(i + 1) % modesArray.length]);
	}

	changePlanet(planetIndex) {
		if (this.cameraMode === CAMERA_MODES.SYSTEM) return;

		this.currentPlanet = this.planets[planetIndex];
		this.player.moveToPlanet(this.currentPlanet);
		this.setCameraMode(this.cameraMode); // Refresh the rig parenting
	}

	_initLighting() {
		this.ambientLight = new THREE.AmbientLight(0xffffff, 0.1);
		this.scene.add(this.ambientLight);
	}

	_initSystem() {
		// Star
		this.star = new Star({
			radius: 4,
			color: 0xf9a308
		});

		this.star.addTo(this.scene);
		// Planets
		this.planets = [
			new Planet({
				radius: 0.5,
				color1: 0x1a0a00,  // dark basalt
				color2: 0x8b1a00,  // deep red rock
				color3: 0xff4500,  // bright lava
				orbitRadius: 13,
				orbitSpeed: 0.021,
				orbitAngle: 2,
				orbitInclination: -10,
				rotationSpeed: 0.022,
				rotationAxis: 23
			}),
			new Planet({
				radius: 1.5,
				color1: 0x1a3a6e,  // deep blue cracks
				color2: 0x60c8e8,  // bright ice blue
				color3: 0xf0f8ff,  // white snow
				orbitRadius: 25,
				orbitSpeed: 0.013,
				orbitAngle: 4,
				orbitInclination: 20,
				rotationSpeed: 0.012,
				rotationAxis: 7
			}),
			new Planet({
				radius: 2,
				color1: 0x1a6b2e,  // deep jungle
				color2: 0x4caf50,  // mid green land
				color3: 0xc8d97a,  // dry/sandy highlands
				orbitRadius: 50,
				orbitSpeed: 0.012,
				orbitAngle: 0,
				orbitInclination: 15,
				rotationSpeed: 0.01,
				rotationAxis: 12
			}),
		];

		this.planets.forEach((p) => p.addTo(this.scene))
		this.currentPlanet = this.planets[0];
	}

	_initPlayer() {
		this.player = new Player({ height: 0.5, speed: 0.005 });
		this.player.moveToPlanet(this.currentPlanet);
	}

	_initControllers() {
		this.playerController = new PlayerController({ player: this.player, input: this.input });

		this.cameraControllers = {
			thirdPerson: new CameraController({
				cameraRig: this.cameraRig,
				input: this.input,
				config: CAMERA_CONFIGS[CAMERA_MODES.THIRD_PERSON]
			}),
			firstPerson: new CameraController({
				cameraRig: this.cameraRig,
				input: this.input,
				config: CAMERA_CONFIGS[CAMERA_MODES.FIRST_PERSON]
			}),
			planet: new CameraController({
				cameraRig: this.cameraRig,
				input: this.input,
				config: CAMERA_CONFIGS[CAMERA_MODES.PLANET]
			}),
			system: new CameraController({
				cameraRig: this.cameraRig,
				input: this.input,
				config: CAMERA_CONFIGS[CAMERA_MODES.SYSTEM]
			})

		};

		this.activeCameraController = this.cameraControllers.thirdPerson;
	}

	_initResizeHandler() {
		window.addEventListener('resize', () => {
			const width = window.innerWidth;
			const height = window.innerHeight;
			const aspect = width / height;

			this.renderer.setSize(width, height);

			this.cameraRig.camera.aspect = aspect;
			this.cameraRig.camera.updateProjectionMatrix();
		})
	}

	_toggleDebugMode() {
		this.debugActive = !this.debugActive;
		if (this.debugActive) {
			this.planets.forEach((p) => { p.activateDebugMode() });
			this.player.activateDebugMode();
		} else {
			this.planets.forEach(p => p.deactivateDebugMode());
			this.player.deactivateDebugMode();
		}
	}
}

