import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { renderer, scene, initComposer, getComposer } from './scene.js';
import Planet from '../entities/Planet.js';
import Star from '../entities/Star.js';
import Player from '../entities/Player.js';
import PlayerController from '../controllers/PlayerController.js';
import CameraController from '../controllers/CameraController.js';
import CameraRig from '../camera/CameraRig.js';
import CameraTransitionEngine from '../camera/CameraTransitionEngine.js';
import InputHandler from './InputHandler.js';
import PlanetBuilder from '../world/PlanetBuilder.js';
import CollectibleManager from '../world/CollectibleManager.js';
import Skybox from './Skybox.js';
import Hud from '../ui/Hud.js';

const STAR_INTENSITY = 140;

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
		minYaw: -Math.PI * 0.45,
		maxYaw: Math.PI * 0.45,
		minPitch: -1.0,
		maxPitch: 1.0,
		autoCenter: true,
		pitch: -0.15
	},
	[CAMERA_MODES.PLANET]: {
		sensitivity: 0.0035,
		unconstrained: true,
		autoCenter: true,
	},
	[CAMERA_MODES.SYSTEM]: {
		sensitivity: 0.003,
		minPitch: -Math.PI / 2,
		maxPitch: Math.PI / 2,
		autoCenter: true,
		pitch: -0.2
	}
};

const PLANET_TRAVEL_TRANSITION = {
	DURATION: 0.9
};

const CAMERA_MODE_TRANSITION = {
	DURATION: 0.35
};

const _planetWorldPosition = new THREE.Vector3();
const _sunDirection = new THREE.Vector3();

export default class Game {
	constructor(onReady = null, debug = false) {
		this.onReady = onReady;
		this.clock = new THREE.Clock();
		this.input = new InputHandler();
		this.cameraRig = new CameraRig();

		this.cameraTransitionEngine = new CameraTransitionEngine({
			cameraRig: this.cameraRig,
			scene,
			getPlayer: () => this.player,
			getCurrentPlanet: () => this.currentPlanet,
			modes: CAMERA_MODES,
			defaultDuration: CAMERA_MODE_TRANSITION.DURATION
		});

		this.planets = {};
		this.planetTravel = null;

		this.hud = new Hud();

		initComposer(this.cameraRig.camera);

		this._loadAssets().then(() => {
			this.skybox = new Skybox().addTo(scene);

			this._initLighting();
			this._initSystem();
			this._initPlayer();
			this._initCollectibles();
			this._initControllers();
			this._initResizeHandler();
			this._initShadows();

			this.setCameraMode(CAMERA_MODES.SYSTEM);

			this.debugActive = !debug;
			this._toggleDebugMode();

			renderer.setAnimationLoop(() => this.update());

			if (this.onReady) this.onReady();
		});
	}

	update() {
		const delta = this.clock.getDelta();
		const elapsed = this.clock.getElapsedTime();

		this.skybox.update(elapsed);
		this.star.update(elapsed);

		this._getPlanetList().forEach((planet) => {
			planet.update(delta);
		});

		if (this.cameraTransitionEngine.isActive) {
			this.cameraTransitionEngine.update(delta);

			if (this.cameraTransitionEngine.consumeFinished()) {
				this._handleCameraTransitionFinished();
			}

			this._updateShadowLight();
			this._renderFrame();
			return;
		}

		this._updatePlayerAndCamera(delta);
		this.collectibleManager.update();
		this._handleInput();

		this.activeCameraController?.update(this.player.isMoving);

		this._updateShadowLight();
		this._renderFrame();
	}

	setCameraMode(mode) {
		this.cameraMode = mode;

		this._activateCameraController(mode);
		this.cameraTransitionEngine.setMode(mode);
		this.activeCameraController?.reset();
	}

	transitionToCameraMode(mode) {
		if (this.cameraMode === mode) return;
		if (this.cameraTransitionEngine.isActive || this.planetTravel) return;

		this._startCameraModeTransition(mode);
	}

	cycleCameraMode() {
		if (this.cameraTransitionEngine.isActive || this.planetTravel) return;

		const modes = Object.values(CAMERA_MODES);
		const index = modes.indexOf(this.cameraMode);
		const nextMode = modes[(index + 1) % modes.length];

		this.transitionToCameraMode(nextMode);
	}

	changePlanet(planetId) {
		if (this.cameraTransitionEngine.isActive || this.planetTravel) return;

		const targetPlanet = this._getPlanetById(planetId);

		if (!targetPlanet) {
			console.warn(`No planet found with id ${planetId}`);
			return;
		}

		if (targetPlanet === this.currentPlanet) return;

		this._startPlanetTravel(targetPlanet);
	}

	_updatePlayerAndCamera(delta) {
		if (
			this.cameraMode === CAMERA_MODES.THIRD_PERSON ||
			this.cameraMode === CAMERA_MODES.FIRST_PERSON
		) {
			this.playerController.update(delta);

			this.cameraRig.stabilizeVerticalTarget(
				this.player.playerModel.position.y,
				0.035
			);
		} else {
			this.cameraRig.clearVerticalStabilizer();
		}
	}

	_handleInput() {
		if (this.input.isTapped(CONTROLS.CYCLE_CAMERA)) {
			this.cycleCameraMode();
		}

		this._handlePlanetTravelInput();
	}

	_renderFrame() {
		getComposer().render();

		if (this.input.isTapped(CONTROLS.TOGGLE_DEBUG)) {
			this._toggleDebugMode();
		}

		this.input.afterUpdate();
	}

	_startCameraModeTransition(mode, duration = CAMERA_MODE_TRANSITION.DURATION) {
		if (this.cameraMode === mode) return false;

		this.cameraMode = mode;
		this._activateCameraController(mode);

		this.activeCameraController?.startAutoCenter?.();

		const started = this.cameraTransitionEngine.transitionToMode(mode, {
			duration
		});

		if (!started) {
			this.activeCameraController?.reset();
		}

		return started;
	}

	_handleCameraTransitionFinished() {
		if (this.planetTravel?.phase === 'toSystem') {
			this._transitionFromSystemToPlanet();
			return;
		}

		if (this.planetTravel?.phase === 'toTarget') {
			this._finishPlanetTravel();
		}
	}

	_activateCameraController(mode) {
		this.activeCameraController = this.cameraControllers[mode] ?? null;

		Object.entries(this.cameraControllers).forEach(([otherMode, controller]) => {
			if (otherMode === mode) return;

			controller.resetState?.();
		});
	}

	_startPlanetTravel(targetPlanet) {
		const returnMode = this.cameraMode === CAMERA_MODES.FIRST_PERSON
			? CAMERA_MODES.FIRST_PERSON
			: CAMERA_MODES.THIRD_PERSON;

		this.planetTravel = {
			targetPlanet,
			returnMode,
			phase: 'toSystem'
		};

		this._startCameraModeTransition(
			CAMERA_MODES.SYSTEM,
			PLANET_TRAVEL_TRANSITION.DURATION * 0.5
		);
	}

	_transitionFromSystemToPlanet() {
		const travel = this.planetTravel;
		if (!travel) return;

		travel.phase = 'toTarget';

		this.currentPlanet = travel.targetPlanet;
		this.player.moveToPlanet(this.currentPlanet);
		this._configureShadowCamera();

		this._startCameraModeTransition(
			travel.returnMode,
			PLANET_TRAVEL_TRANSITION.DURATION * 0.5
		);
	}

	_finishPlanetTravel() {
		this.planetTravel = null;
	}

	_handlePlanetTravelInput() {
		const planetCount = this._getPlanetList().length;

		for (let i = 0; i < planetCount; i++) {
			if (this.input.isTapped(`${CONTROLS.PLANET_PREFIX}${i + 1}`)) {
				this.changePlanet(i);
			}
		}
	}

	// ---------------------------------------------------------------------
	// Scene setup
	// ---------------------------------------------------------------------

	async _loadAssets() {
		const loader = new GLTFLoader();

		this.playerGLTF = await loader.loadAsync('./assets/little-prince.glb');
		this.lampPostGLTF = await loader.loadAsync('./assets/lamp_post.glb');
		this.iglooGLTF = await loader.loadAsync('./assets/igloo.glb');
	}

	_initLighting() {
		this.ambientLight = new THREE.AmbientLight(0xffffff, 0.05);
		scene.add(this.ambientLight);
	}

	_initSystem() {
		this.star = new Star({
			radius: 8,
			light_intensity: STAR_INTENSITY,
		});

		this.star.addTo(scene);

		this._addPlanet(
			new Planet({
				name: 'lava',
				radius: 0.5,
				color1: 0x1a0a00,
				color2: 0x8b1a00,
				color3: 0xff4500,
				orbitRadius: 13,
				orbitSpeed: 0.0042,
				orbitAngle: 2,
				orbitInclination: -10,
				rotationSpeed: 0.0044,
				rotationAxis: 23,
				terrainAmplitude: 0.1,
			})
		);

		this._addPlanet(
			new Planet({
				name: 'green',
				radius: 1.5,
				color1: 0x1a6b2e,
				color2: 0x4caf50,
				color3: 0xc8d97a,
				orbitRadius: 25,
				orbitSpeed: 0.0026,
				orbitAngle: 4,
				orbitInclination: 20,
				rotationSpeed: 0.0024,
				rotationAxis: 7,
				terrainAmplitude: 0.025,
			})
		);

		this._addPlanet(
			new Planet({
				name: 'ice',
				radius: 2,
				color1: 0x1a3a6e,
				color2: 0x60c8e8,
				color3: 0xf0f8ff,
				orbitRadius: 50,
				orbitSpeed: 0.0024,
				orbitAngle: 0,
				orbitInclination: 15,
				rotationSpeed: 0.002,
				rotationAxis: 12,
				terrainAmplitude: 0.03,
			})
		);

		this._initPlanetObjects();

		this._getPlanetList().forEach((planet) => {
			planet.addTo(scene);
		});

		this.currentPlanet = this._getPlanetById(0);
	}

	_initPlayer() {
		this.player = new Player({
			height: 0.5,
			speed: 0.005,
			gltf: this.playerGLTF
		});

		this.player.moveToPlanet(this.currentPlanet);
	}

	_initControllers() {
		this.playerController = new PlayerController({
			player: this.player,
			input: this.input
		});

		this.cameraControllers = {
			[CAMERA_MODES.THIRD_PERSON]: new CameraController({
				cameraRig: this.cameraRig,
				input: this.input,
				config: CAMERA_CONFIGS[CAMERA_MODES.THIRD_PERSON]
			}),
			[CAMERA_MODES.FIRST_PERSON]: new CameraController({
				cameraRig: this.cameraRig,
				input: this.input,
				config: CAMERA_CONFIGS[CAMERA_MODES.FIRST_PERSON]
			}),
			[CAMERA_MODES.PLANET]: new CameraController({
				cameraRig: this.cameraRig,
				input: this.input,
				config: CAMERA_CONFIGS[CAMERA_MODES.PLANET]
			}),
			[CAMERA_MODES.SYSTEM]: new CameraController({
				cameraRig: this.cameraRig,
				input: this.input,
				config: CAMERA_CONFIGS[CAMERA_MODES.SYSTEM]
			})
		};

		this.activeCameraController = this.cameraControllers[CAMERA_MODES.THIRD_PERSON];
	}

	_initCollectibles() {
		this.collectibleManager = new CollectibleManager({
			planets: this.planets,
			player: this.player,
			onCollect: (score) => this.hud.setOrbCount(score)
		});
	}

	_initResizeHandler() {
		window.addEventListener('resize', () => {
			const width = window.innerWidth;
			const height = window.innerHeight;
			const aspect = width / height;

			renderer.setSize(width, height);
			getComposer().setSize(width, height);

			this.cameraRig.camera.aspect = aspect;
			this.cameraRig.camera.updateProjectionMatrix();
		});
	}

	_initShadows() {
		this.shadowLight = new THREE.DirectionalLight(0xffffff, 0.8);
		this.shadowLight.castShadow = true;
		this.shadowLight.shadow.mapSize.set(8192, 8192);
		this.shadowLight.shadow.normalBias = 0.02;

		scene.add(this.shadowLight);
		scene.add(this.shadowLight.target);

		this._configureShadowCamera();
	}

	_initPlanetObjects() {
		const builder = new PlanetBuilder(this.planets, {
			lampPostGLTF: this.lampPostGLTF,
			iglooGLTF: this.iglooGLTF
		});

		builder.populate();
	}

	// ---------------------------------------------------------------------
	// Planets
	// ---------------------------------------------------------------------

	_addPlanet(planet) {
		this.planets[planet.name] = planet;
		return planet;
	}

	_getPlanetList() {
		return Object.values(this.planets).sort((a, b) => a.id - b.id);
	}

	_getPlanetById(id) {
		return this._getPlanetList().find((planet) => planet.id === id);
	}

	// ---------------------------------------------------------------------
	// Shadows
	// ---------------------------------------------------------------------

	_configureShadowCamera() {
		if (!this.currentPlanet) return;

		const r = this.currentPlanet.radius;
		const cam = this.shadowLight.shadow.camera;
		const size = r * 2;

		cam.left = -size;
		cam.right = size;
		cam.top = size;
		cam.bottom = -size;
		cam.near = r * 3;
		cam.far = r * 7;
		cam.updateProjectionMatrix();
	}

	_updateShadowLight() {
		if (!this.currentPlanet) return;

		this.currentPlanet.mesh.getWorldPosition(_planetWorldPosition);

		_sunDirection.copy(_planetWorldPosition).normalize();

		const radius = this.currentPlanet.radius;

		this.shadowLight.position
			.copy(_planetWorldPosition)
			.addScaledVector(_sunDirection, -(radius * 5));

		this.shadowLight.target.position.copy(_planetWorldPosition);
		this.shadowLight.target.updateMatrixWorld();

		const distanceToSun = _planetWorldPosition.length();
		const pointLightIntensity = STAR_INTENSITY / (1.5 * distanceToSun * distanceToSun);

		this.shadowLight.intensity = pointLightIntensity;
	}

	// ---------------------------------------------------------------------
	// Debug
	// ---------------------------------------------------------------------

	_toggleDebugMode() {
		this.debugActive = !this.debugActive;

		this._getPlanetList().forEach((planet) => {
			if (this.debugActive) {
				planet.activateDebugMode();
			} else {
				planet.deactivateDebugMode();
			}
		});

		if (this.debugActive) {
			this.player.activateDebugMode();
		} else {
			this.player.deactivateDebugMode();
		}
	}
}
