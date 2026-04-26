import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const _vector = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const _right = new THREE.Vector3(1, 0, 0);

const CONFIG = {
	HEIGHT_RATIO: 0.8,
	RADIUS_RATIO: 0.25,
	COLOR: 0x00ff00,
	DEFAULT_HEIGHT: 0.1,
	DEFAULT_SPEED: 0.045
};

const PART_COLORS = [
	0x37E71F,   // 0 — clothes (green suit)
	0xE79217,   // 1 — accessories (orange scarf and belt)
	0xE7DC00,   // 2 — hair (blonde)
	0x923C00,   // 3 — shoes and buttons (dark brown)
	0xFFB07E,   // 4 — skin
	0x000000,   // 5 — eyes (dark)
];

export const PLAYER_STATES = {
	IDLE: 'idle',
	WALKING: 'walking',
	RUNNING: 'running'
};

// Player is composed of a pivot at the center of the planet and the actual model placed
// at the surface. This facilitates rotation: rotate the pivot and the model follows
export default class Player {
	constructor({ height = CONFIG.DEFAULT_HEIGHT, speed = CONFIG.DEFAULT_SPEED }) {
		this.root = new THREE.Object3D();

		this.height = height;
		this.speed = speed;
		this.turnSpeed = 2 * speed;
		this.radius = height * CONFIG.RADIUS_RATIO;

		this.heading = 0;

		this._setupVisuals();

		// Animation
		this.state = PLAYER_STATES.IDLE;
		this.currentAction = null;
		this.mixer = null;

		// Debugging feature
		this._axes = new THREE.AxesHelper(1);
		this.playerModel.add(this._axes);
	}

	addTo(parent) {
		parent.add(this.root);
		return this;
	}

	attachToModel(object) {
		object.addTo(this.playerModel);
	}

	moveToPlanet(planet) {
		this.currentPlanet = planet;

		// The pivot stays at 0,0,0 relative to the planet
		this.root.position.set(0, 0, 0);
		this.root.quaternion.identity();

		// Move the model + camera to the surface
		this.playerModel.position.set(0, planet.radius, 0);

		planet.addToSurface(this);
	}

	update(delta) {
		if (this.mixer) this._updateAnimation(delta);
	}

	turn(direction = 1) {
		this.heading += this.turnSpeed * direction;

		this.playerModel.quaternion.setFromAxisAngle(_up, this.heading);
	}

	move(direction = 1) {
		const speed = this.state === PLAYER_STATES.RUNNING ? this.speed * 2 : this.speed;

		const moveStep = speed * direction;

		// Calculate right axis
		_vector.copy(_right).applyAxisAngle(_up, this.heading);

		// Convert to planet right axis
		_vector.applyQuaternion(this.root.quaternion);

		// Apply rotation to pivot
		_quat.setFromAxisAngle(_vector, -moveStep);
		this.root.quaternion.premultiply(_quat);
	}

	get isMoving() {
		return this.state !== PLAYER_STATES.IDLE;
	}

	setState(state) {
		this.state = state;
	}

	resetState() {
		this.state = PLAYER_STATES.IDLE;
	}

	activateDebugMode() {
		this._axes.visible = true;
	}

	deactivateDebugMode() {

		this._axes.visible = false;
	}

	_setupVisuals() {
		this.playerModel = new THREE.Group();
		this.root.add(this.playerModel);
		const loader = new GLTFLoader();

		loader.load('./assets/little-prince.glb', (gltf) => {
			this.modelRoot = gltf.scene;

			this.modelRoot.scale.setScalar(this.height / 3.5);
			this.modelRoot.position.y = 0;
			this.modelRoot.rotation.y = Math.PI;

			let i = 0;
			this.modelRoot.traverse((child) => {
				if (child.isMesh) {
					child.material = new THREE.MeshToonMaterial({
						color: PART_COLORS[i++] ?? 0xffffff
					});
				}
			});

			// Animations
			this.mixer = new THREE.AnimationMixer(this.modelRoot);
			this.walkAction = this.mixer.clipAction(gltf.animations[2]);
			this.walkAction.setLoop(THREE.LoopRepeat, Infinity);

			this.runAction = this.mixer.clipAction(gltf.animations[1]);
			this.runAction.setLoop(THREE.LoopRepeat, Infinity);

			this.idleAction = this.mixer.clipAction(gltf.animations[0]);
			this.idleAction.setLoop(THREE.LoopRepeat, Infinity);

			// Start with idle
			this.idleAction.play();
			this.currentAction = this.idleAction;

			this.playerModel.add(this.modelRoot);
		});
	}

	_updateAnimation(delta) {
		if (!this.mixer) return;
		this.mixer.update(delta);

		const target = this.state === PLAYER_STATES.RUNNING ? this.runAction
			: this.state === PLAYER_STATES.WALKING ? this.walkAction
				: this.idleAction;

		if (this.currentAction !== target) {
			this._switchAnimation(this.currentAction, target);
		}
	}

	_switchAnimation(from, to) {
		if (from == to) return;
		if (from) from.fadeOut(0.2);
		to.reset().fadeIn(0.2).play();
		this.currentAction = to;
	}
}
