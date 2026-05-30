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

const PLANET_TRANSITION = {
	DURATION: 0.9,
	PULLBACK_MULTIPLIER: 2.15,
	FOV_PEAK: 96,
	MIN_FAR_DISTANCE: 1.8
};

const CAMERA_MODE_TRANSITION = {
	DURATION: 0.35
};

export default class Game {
	constructor(onReady = null, debug = false) {
		this.onReady = onReady;
		this.clock = new THREE.Clock();
		this.input = new InputHandler();
		this.cameraRig = new CameraRig();

		this.planets = {};
		this.planetTransition = null;
		this.cameraModeTransition = null;

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

		if (this.planetTransition) {
			this._updatePlanetTransition(delta);
			this._updateShadowLight();

			getComposer().render();

			if (this.input.isTapped(CONTROLS.TOGGLE_DEBUG)) {
				this._toggleDebugMode();
			}

			this.input.afterUpdate();
			return;
		}

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

		if (this.cameraModeTransition) {
			this._updateCameraModeTransition(delta);
			this._updateShadowLight();

			getComposer().render();

			if (this.input.isTapped(CONTROLS.TOGGLE_DEBUG)) {
				this._toggleDebugMode();
			}

			this.input.afterUpdate();
			return;
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

	transitionToCameraMode(mode) {
		if (this.cameraMode === mode) return;

		if (this.planetTransition || this.cameraModeTransition) return;

		if (this._canUseLocalCameraModeTransition(this.cameraMode, mode)) {
			this._startLocalCameraModeTransition(mode);
			return;
		}

		this.setCameraMode(mode);
	}

	setCameraMode(mode) {
		this.cameraMode = mode;

		this._setActiveCameraController(mode);
		this._applyCameraModeRig(mode);
		this._resetActiveCameraController();
	}

	_startLocalCameraModeTransition(targetMode) {
		const fromMode = this.cameraMode;

		const startRigPosition = this.cameraRig.root.position.clone();
		const startCameraPosition = this.cameraRig.camera.position.clone();
		const startFov = this.cameraRig.camera.fov;

		/*
			Apply the target mode to capture its desired local setup.
			Since third-person and first-person share the same parent, this is safe.
		*/
		this.setCameraMode(targetMode);

		const targetRigPosition = this.cameraRig.root.position.clone();
		const targetCameraPosition = this.cameraRig.camera.position.clone();
		const targetFov = this.cameraRig.camera.fov;

		/*
			Restore starting visual state, but keep logical mode/controller as target.
			That means input is frozen during transition, then target mode is already active.
		*/
		this.cameraRig.root.position.copy(startRigPosition);
		this.cameraRig.camera.position.copy(startCameraPosition);
		this.cameraRig.camera.fov = startFov;
		this.cameraRig.camera.updateProjectionMatrix();

		this.cameraModeTransition = {
			fromMode,
			targetMode,
			elapsed: 0,
			duration: CAMERA_MODE_TRANSITION.DURATION,

			startRigPosition,
			targetRigPosition,
			startCameraPosition,
			targetCameraPosition,
			startFov,
			targetFov
		};
	}

	_updateCameraModeTransition(delta) {
		const transition = this.cameraModeTransition;
		if (!transition) return;

		transition.elapsed += delta;

		const rawT = THREE.MathUtils.clamp(
			transition.elapsed / transition.duration,
			0,
			1
		);

		const t = this._easeInOutCubic(rawT);

		this.cameraRig.root.position.lerpVectors(
			transition.startRigPosition,
			transition.targetRigPosition,
			t
		);

		this.cameraRig.camera.position.lerpVectors(
			transition.startCameraPosition,
			transition.targetCameraPosition,
			t
		);

		this.cameraRig.camera.fov = THREE.MathUtils.lerp(
			transition.startFov,
			transition.targetFov,
			t
		);

		this.cameraRig.camera.updateProjectionMatrix();

		if (rawT >= 1) {
			this._finishCameraModeTransition();
		}
	}

	_finishCameraModeTransition() {
		const transition = this.cameraModeTransition;
		if (!transition) return;

		this.cameraRig.root.position.copy(transition.targetRigPosition);
		this.cameraRig.camera.position.copy(transition.targetCameraPosition);
		this.cameraRig.camera.fov = transition.targetFov;
		this.cameraRig.camera.updateProjectionMatrix();

		this.cameraModeTransition = null;
	}

	_canUseLocalCameraModeTransition(fromMode, toMode) {
		const localModes = [
			CAMERA_MODES.THIRD_PERSON,
			CAMERA_MODES.FIRST_PERSON
		];

		return localModes.includes(fromMode) && localModes.includes(toMode);
	}
	_setActiveCameraController(mode) {
		this.activeCameraController = this.cameraControllers[mode] ?? null;
	}

	_applyCameraModeRig(mode) {
		switch (mode) {
			case CAMERA_MODES.THIRD_PERSON:
			case CAMERA_MODES.FIRST_PERSON:
				this.player.attachToModel(this.cameraRig);
				break;

			case CAMERA_MODES.PLANET:
				this.currentPlanet.addPivotToPlanet(this.cameraRig);
				break;

			case CAMERA_MODES.SYSTEM:
				this.cameraRig.addTo(scene);
				break;
		}

		const rigPosition = this._getCameraModeRigPosition(mode);
		const cameraPosition = this._getCameraModeCameraPosition(mode);

		this.cameraRig.setPosition(
			rigPosition.x,
			rigPosition.y,
			rigPosition.z
		);

		this.cameraRig.setCameraPosition(
			cameraPosition.x,
			cameraPosition.y,
			cameraPosition.z
		);
	}

	_resetActiveCameraController() {
		if (this.activeCameraController) {
			this.activeCameraController.reset();
		}
	}

	_getCameraModeRigPosition(mode, target = new THREE.Vector3()) {
		switch (mode) {
			case CAMERA_MODES.THIRD_PERSON:
				return target.set(0, this.player.height * 0.01, 0);

			case CAMERA_MODES.FIRST_PERSON:
				return target.set(0, this.player.height * 0.8, 0);

			case CAMERA_MODES.PLANET:
			case CAMERA_MODES.SYSTEM:
			default:
				return target.set(0, 0, 0);
		}
	}

	_getCameraModeCameraPosition(mode, target = new THREE.Vector3()) {
		switch (mode) {
			case CAMERA_MODES.THIRD_PERSON:
				return target.set(
					0,
					this.player.height * 0.6,
					this.player.height * 1.3
				);

			case CAMERA_MODES.FIRST_PERSON:
				return target.set(0, 0, 0);

			case CAMERA_MODES.PLANET:
				return target.set(0, 0, this.currentPlanet.radius * 2);

			case CAMERA_MODES.SYSTEM:
				return target.set(0, 0, 70);

			default:
				return target.set(0, 0, 0);
		}
	}

	cycleCameraMode() {
		if (this.planetTransition || this.cameraModeTransition) return;

		const modesArray = Object.values(CAMERA_MODES);
		const i = modesArray.indexOf(this.cameraMode);

		this.transitionToCameraMode(modesArray[(i + 1) % modesArray.length]);
	}

	changePlanet(planetId) {
		if (this.planetTransition || this.cameraModeTransition) return;

		if (
			this.cameraMode === CAMERA_MODES.SYSTEM ||
			this.cameraMode === CAMERA_MODES.PLANET
		) {
			return;
		}

		const targetPlanet = this._getPlanetById(planetId);

		if (!targetPlanet) {
			console.warn(`No planet found with id ${planetId}`);
			return;
		}

		if (targetPlanet === this.currentPlanet) {
			return;
		}

		this._startPlanetTransition(targetPlanet);
	}

	_startPlanetTransition(targetPlanet) {
		/*
			Simple local teleport pulse.

			Important:
			setCameraMode(THIRD_PERSON) happens before capturing startCameraPosition,
			so every transition starts from the canonical third-person camera distance,
			not from a previously pulled-back transition distance.
		*/
		this.setCameraMode(CAMERA_MODES.THIRD_PERSON);

		const startCameraPosition = this.cameraRig.camera.position.clone();
		const farCameraPosition = startCameraPosition.clone();

		farCameraPosition.z = Math.max(
			startCameraPosition.z * PLANET_TRANSITION.PULLBACK_MULTIPLIER,
			PLANET_TRANSITION.MIN_FAR_DISTANCE
		);

		farCameraPosition.y = startCameraPosition.y * 1.15;

		this.planetTransition = {
			targetPlanet,
			elapsed: 0,
			duration: PLANET_TRANSITION.DURATION,
			switched: false,

			startCameraPosition,
			farCameraPosition,
			targetCameraPosition: startCameraPosition.clone(),

			startFov: this.cameraRig.camera.fov,
			peakFov: PLANET_TRANSITION.FOV_PEAK,
			targetFov: this.cameraRig.camera.fov
		};
	}

	_updatePlanetTransition(delta) {
		const transition = this.planetTransition;
		if (!transition) return;

		transition.elapsed += delta;

		const rawT = THREE.MathUtils.clamp(
			transition.elapsed / transition.duration,
			0,
			1
		);

		if (rawT >= 0.5 && !transition.switched) {
			this._switchPlanetAtTransitionPeak(transition);
		}

		if (rawT < 0.5) {
			const t = this._easeInOutCubic(rawT / 0.5);

			this.cameraRig.camera.position.lerpVectors(
				transition.startCameraPosition,
				transition.farCameraPosition,
				t
			);

			this.cameraRig.camera.fov = THREE.MathUtils.lerp(
				transition.startFov,
				transition.peakFov,
				t
			);
		} else {
			const t = this._easeInOutCubic((rawT - 0.5) / 0.5);

			this.cameraRig.camera.position.lerpVectors(
				transition.farCameraPosition,
				transition.targetCameraPosition,
				t
			);

			this.cameraRig.camera.fov = THREE.MathUtils.lerp(
				transition.peakFov,
				transition.targetFov,
				t
			);
		}

		this.cameraRig.camera.updateProjectionMatrix();

		if (rawT >= 1) {
			this._finishPlanetTransition();
		}
	}

	_switchPlanetAtTransitionPeak(transition) {
		transition.switched = true;

		this.currentPlanet = transition.targetPlanet;
		this.player.moveToPlanet(this.currentPlanet);
		this._configureShadowCamera();

		/*
			Reset to the correct third-person setup for the new planet/player.
			Then capture that as the real target.
		*/
		this.setCameraMode(CAMERA_MODES.THIRD_PERSON);

		transition.targetCameraPosition.copy(this.cameraRig.camera.position);
		transition.targetFov = transition.startFov;

		/*
			Continue the visual transition from the pulled-back position.
			Do not let the temporary far distance become the new normal distance.
		*/
		this.cameraRig.camera.position.copy(transition.farCameraPosition);
		this.cameraRig.camera.fov = transition.peakFov;
		this.cameraRig.camera.updateProjectionMatrix();
	}

	_finishPlanetTransition() {
		const transition = this.planetTransition;
		if (!transition) return;

		/*
			End exactly at the captured target position.
			Do not call setCameraMode() here, because that would reset the camera
			after the lerp and can create a visible snap.
		*/
		this.cameraRig.camera.position.copy(transition.targetCameraPosition);
		this.cameraRig.camera.fov = transition.targetFov;
		this.cameraRig.camera.updateProjectionMatrix();

		this.planetTransition = null;
	}

	_easeInOutCubic(t) {
		return t < 0.5
			? 4 * t * t * t
			: 1 - Math.pow(-2 * t + 2, 3) / 2;
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
		this.iglooGLTF = await loader.loadAsync('./assets/igloo.glb');
	}

	_initPlanetObjects() {
		const builder = new PlanetBuilder(this.planets, {
			lampPostGLTF: this.lampPostGLTF,
			iglooGLTF: this.iglooGLTF
		});

		builder.populate();
	}
}
