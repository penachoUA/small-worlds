import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

import { renderer, scene, initComposer, getComposer } from './scene.js';
import Planet from '../entities/Planet.js';
import Star from '../entities/Star.js';
import Player from '../entities/Player.js';
import PlayerController from '../controllers/PlayerController.js';
import CameraController from '../controllers/CameraController.js';
import CameraRig from '../camera/CameraRig.js';
import InputHandler from './InputHandler.js';
import PlanetBuilder from '../world/PlanetBuilder.js';
import Skybox from './Skybox.js';

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
	constructor(onReady = null, debug = false) {
		this.onReady = onReady;
		this.clock = new THREE.Clock();
		this.input = new InputHandler();
		this.cameraRig = new CameraRig();

		this.planets = {};

		initComposer(this.cameraRig.camera);

		this._loadAssets().then(() => {
			this.skybox = new Skybox().addTo(scene);
			this._initLighting();
			this._initSystem();
			this._initPlayer();
			this._initControllers();
			this._initResizeHandler();
			this._initShadows();
			this.setCameraMode('system');

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

		if (
			this.cameraMode === CAMERA_MODES.THIRD_PERSON ||
			this.cameraMode === CAMERA_MODES.FIRST_PERSON
		) {
			this.playerController.update(delta);
		}

		if (this.input.isTapped(CONTROLS.CYCLE_CAMERA)) {
			this.cycleCameraMode();
		}

		this._handlePlanetTravelInput();

		this.activeCameraController.update(this.player.isMoving);

		this._updateShadowLight();

		getComposer().render();

		if (this.input.isTapped(CONTROLS.TOGGLE_DEBUG)) {
			this._toggleDebugMode();
		}

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
				this.cameraRig.setCameraPosition(
					0,
					this.player.height * 0.6,
					this.player.height * 1.3
				);
				break;

			case CAMERA_MODES.FIRST_PERSON:
				this.player.attachToModel(this.cameraRig);
				this.cameraRig.setPosition(0, this.player.height * 0.8, 0);
				this.cameraRig.setCameraPosition(0, 0, 0);
				break;

			case CAMERA_MODES.PLANET:
				this.currentPlanet.addPivotToPlanet(this.cameraRig);
				this.cameraRig.setPosition(0, 0, 0);
				this.cameraRig.setCameraPosition(0, 0, this.currentPlanet.radius * 2);
				break;

			case CAMERA_MODES.SYSTEM:
				this.cameraRig.addTo(scene);
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

	changePlanet(planetId) {
		if (this.cameraMode === CAMERA_MODES.SYSTEM) return;

		const targetPlanet = this._getPlanetById(planetId);

		if (!targetPlanet) {
			console.warn(`No planet found with id ${planetId}`);
			return;
		}

		this.currentPlanet = targetPlanet;
		this.player.moveToPlanet(this.currentPlanet);
		this._configureShadowCamera();
		this.setCameraMode(this.cameraMode);
	}

	_handlePlanetTravelInput() {
		const planetCount = this._getPlanetList().length;

		for (let i = 0; i < planetCount; i++) {
			if (this.input.isTapped(`${CONTROLS.PLANET_PREFIX}${i + 1}`)) {
				this.changePlanet(i);
			}
		}
	}

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

	_initLighting() {
		this.shadowLight = new THREE.DirectionalLight(0xffffff, 1.0);
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
				rotationAxis: 23
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
				rotationAxis: 7
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
				rotationAxis: 12
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

	_configureShadowCamera() {
		if (!this.currentPlanet) return;

		const r = this.currentPlanet.radius;
		const cam = this.shadowLight.shadow.camera;

		const s = r * 2;

		cam.left = -s;
		cam.right = s;
		cam.top = s;
		cam.bottom = -s;
		cam.near = r * 3;
		cam.far = r * 7;
		cam.updateProjectionMatrix();
	}

	_updateShadowLight() {
		if (!this.currentPlanet) return;

		const planetPos = new THREE.Vector3();

		this.currentPlanet.mesh.getWorldPosition(planetPos);

		const sunDir = planetPos.clone().normalize();
		const r = this.currentPlanet.radius;

		this.shadowLight.position.copy(planetPos).addScaledVector(sunDir, -(r * 5));
		this.shadowLight.target.position.copy(planetPos);
		this.shadowLight.target.updateMatrixWorld();

		const dist = planetPos.length();
		const pointLightIntensity = STAR_INTENSITY / (1.5 * dist * dist);

		this.shadowLight.intensity = pointLightIntensity;
	}

	_toggleDebugMode() {
		this.debugActive = !this.debugActive;

		if (this.debugActive) {
			this._getPlanetList().forEach((planet) => {
				planet.activateDebugMode();
			});

			this.player.activateDebugMode();
		} else {
			this._getPlanetList().forEach((planet) => {
				planet.deactivateDebugMode();
			});

			this.player.deactivateDebugMode();
		}
	}

	async _loadAssets() {
		const loader = new GLTFLoader();

		this.playerGLTF = await loader.loadAsync('./assets/little-prince.glb');
		this.lampPostGLTF = await loader.loadAsync('./assets/lamp_post.glb');
	}

	_initPlanetObjects() {
		const builder = new PlanetBuilder(this.planets, {
			lampPostGLTF: this.lampPostGLTF
		});

		builder.populate();
	}
}
