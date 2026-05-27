import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { StateMachine, State } from '../core/Fsm.js';

const _vector = new THREE.Vector3();
const _quat = new THREE.Quaternion();
const _up = new THREE.Vector3(0, 1, 0);
const _right = new THREE.Vector3(1, 0, 0);

const CONFIG = {
	RADIUS_RATIO: 0.25,
	DEFAULT_HEIGHT: 0.1,
	DEFAULT_SPEED: 0.045,
	JUMP_HEIGHT_RATIO: 0.2,
};

const PART_COLORS = [
	0x37E71F,  // clothes (green suit)
	0xE79217,  // accessories (orange scarf and belt)
	0xE7DC00,  // hair (blonde)
	0x923C00,  // shoes and buttons (dark brown)
	0xFFB07E,  // skin
	0x000000,  // eyes
];

// Shading
const SHADE_COLORS = new Uint8Array([0, 128, 255]);
const GRADIENT_MAP = new THREE.DataTexture(
	SHADE_COLORS,
	SHADE_COLORS.length,
	1,
	THREE.RedFormat
);

GRADIENT_MAP.minFilter = THREE.NearestFilter;
GRADIENT_MAP.magFilter = THREE.NearestFilter;
GRADIENT_MAP.generateMipmaps = false;
GRADIENT_MAP.needsUpdate = true;

// Animation timing — tuned to match the jump clip's airborne phase
const JUMP_ARC_START = 0.25;
const JUMP_ARC_END = 0.65;
const JUMP_STATE_END = 0.75;

export const PLAYER_STATES = {
	IDLE: 'idle',
	WALKING: 'walking',
	RUNNING: 'running',
	JUMPING: 'jumping'
};

// Player is composed of a pivot (root) at the planet center and a model
// offset to the surface. Rotating the pivot swings the model across the sphere.
export default class Player {
	constructor({ height = CONFIG.DEFAULT_HEIGHT, speed = CONFIG.DEFAULT_SPEED }) {
		this.root = new THREE.Object3D();

		this.height = height;
		this.speed = speed;
		this.turnSpeed = 2 * speed;
		this.radius = height * CONFIG.RADIUS_RATIO;
		this.heading = 0;

		// Jump state
		this.jumpTime = 0;
		this.jumpHeight = this.height * CONFIG.JUMP_HEIGHT_RATIO;

		// Animation
		this.mixer = null;
		this.currentAction = null;

		this.fsm = new StateMachine(this);
		this._setupVisuals();
		this._setupFSM();
		this.fsm.set(PLAYER_STATES.IDLE);

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
		this.root.position.set(0, 0, 0);
		this.root.quaternion.identity();
		this.playerModel.position.set(0, planet.radius, 0);
		planet.addToSurface(this);
	}

	update(delta, input) {
		this.fsm.update(delta, input);
		if (this.mixer) this.mixer.update(delta);
	}

	get isMoving() {
		return this.fsm.current?.name !== PLAYER_STATES.IDLE;
	}

	setGroundOffset(offset) {
		this.playerModel.position.y = this.currentPlanet.radius + offset;
	}

	activateDebugMode() { this._axes.visible = true; }
	deactivateDebugMode() { this._axes.visible = false; }

	_turn(direction) {
		this.heading += this.turnSpeed * direction;
		this.playerModel.quaternion.setFromAxisAngle(_up, this.heading);
	}

	_move(direction) {
		const speed = this.fsm.current?.name === PLAYER_STATES.RUNNING
			? this.speed * 2 : this.speed;
		const moveStep = speed * direction;
		_vector.copy(_right).applyAxisAngle(_up, this.heading);
		_vector.applyQuaternion(this.root.quaternion);
		_quat.setFromAxisAngle(_vector, -moveStep);
		this.root.quaternion.premultiply(_quat);
	}

	_setupFSM() {
		this.fsm.add(PLAYER_STATES.IDLE, IdleState);
		this.fsm.add(PLAYER_STATES.WALKING, WalkState);
		this.fsm.add(PLAYER_STATES.RUNNING, RunState);
		this.fsm.add(PLAYER_STATES.JUMPING, JumpState);
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
					child.castShadow = true;
					child.material = new THREE.MeshToonMaterial({
						color: PART_COLORS[i++] ?? 0xffffff,
						gradientMap: GRADIENT_MAP
					});
				}
			});

			this.mixer = new THREE.AnimationMixer(this.modelRoot);

			const idleClip = gltf.animations.find(a => a.name === 'idle');
			const walkClip = gltf.animations.find(a => a.name === 'walking');
			const runClip = gltf.animations.find(a => a.name === 'running');
			const jumpClip = gltf.animations.find(a => a.name === 'jump');

			this.idleAction = this.mixer.clipAction(idleClip);
			this.idleAction.setLoop(THREE.LoopRepeat, Infinity);

			this.walkAction = this.mixer.clipAction(walkClip);
			this.walkAction.setLoop(THREE.LoopRepeat, Infinity);

			this.runAction = this.mixer.clipAction(runClip);
			this.runAction.setLoop(THREE.LoopRepeat, Infinity);

			this.jumpAction = this.mixer.clipAction(jumpClip);
			this.jumpAction.setLoop(THREE.LoopOnce, 1);
			this.jumpAction.clampWhenFinished = true;
			this.jumpAction.timeScale = 1.3;
			this.jumpDuration = jumpClip.duration / this.jumpAction.timeScale;

			this.fsm.set(PLAYER_STATES.IDLE);
			this.idleAction.play();
			this.currentAction = this.idleAction;

			this.playerModel.add(this.modelRoot);
		});
	}
}

// --- Animation States ---
function playAction(player, action) {
	if (player.currentAction) player.currentAction.fadeOut(0.2);
	action.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(0.2).play();
	player.currentAction = action;
}

class IdleState extends State {
	get name() { return PLAYER_STATES.IDLE; }

	enter() {
		const player = this.parent.owner;
		if (!player.idleAction) return;
		playAction(player, player.idleAction);
	}

	update(_, input) {
		if (!input) return;
		const player = this.parent.owner;
		if (input.left) player._turn(1);
		if (input.right) player._turn(-1);
		if (input.jump) {
			this.parent.set(PLAYER_STATES.JUMPING);
		} else if (input.forward || input.backward) {
			this.parent.set(input.shift ? PLAYER_STATES.RUNNING : PLAYER_STATES.WALKING);
		}
	}
}

class WalkState extends State {
	get name() { return PLAYER_STATES.WALKING; }

	enter() {
		const player = this.parent.owner;
		if (!player.walkAction) return;
		playAction(player, player.walkAction);
	}

	update(_, input) {
		if (!input) return;
		const player = this.parent.owner;
		if (input.left) player._turn(1);
		if (input.right) player._turn(-1);
		if (input.forward) player._move(1);
		if (input.backward) player._move(-1);
		if (input.jump) {
			this.parent.set(PLAYER_STATES.JUMPING);
		} else if (!input.forward && !input.backward) {
			this.parent.set(PLAYER_STATES.IDLE);
		} else if (input.shift) {
			this.parent.set(PLAYER_STATES.RUNNING);
		}
	}
}

class RunState extends State {
	get name() { return PLAYER_STATES.RUNNING; }

	enter() {
		const player = this.parent.owner;
		if (!player.runAction) return;
		playAction(player, player.runAction);
	}

	update(_, input) {
		if (!input) return;
		const player = this.parent.owner;
		if (input.left) player._turn(1);
		if (input.right) player._turn(-1);
		if (input.forward) player._move(1);
		if (input.backward) player._move(-1);
		if (input.jump) {
			this.parent.set(PLAYER_STATES.JUMPING);
		} else if (!input.forward && !input.backward) {
			this.parent.set(PLAYER_STATES.IDLE);
		} else if (!input.shift) {
			this.parent.set(PLAYER_STATES.WALKING);
		}
	}
}

class JumpState extends State {
	get name() { return PLAYER_STATES.JUMPING; }

	enter() {
		const player = this.parent.owner;
		if (!player.jumpAction) return;
		player.jumpTime = 0;
		if (player.currentAction) player.currentAction.fadeOut(0.1);
		player.jumpAction
			.reset().setEffectiveTimeScale(1).setEffectiveWeight(1).fadeIn(0.1).play();
		player.currentAction = player.jumpAction;
	}

	update(delta, input) {
		if (!input) return;
		const player = this.parent.owner;

		if (input.left) player._turn(1);
		if (input.right) player._turn(-1);
		if (input.forward) player._move(1);
		if (input.backward) player._move(-1);

		player.jumpTime += delta;
		const t = player.jumpTime / player.jumpDuration;

		if (t > JUMP_ARC_START && t < JUMP_ARC_END) {
			const arcT = (t - JUMP_ARC_START) / (JUMP_ARC_END - JUMP_ARC_START);
			player.setGroundOffset(player.jumpHeight * 4 * arcT * (1 - arcT));
		} else {
			player.setGroundOffset(0);
		}

		if (t >= JUMP_STATE_END) {
			player.setGroundOffset(0);
			const next = (input.forward || input.backward)
				? (input.shift ? PLAYER_STATES.RUNNING : PLAYER_STATES.WALKING)
				: PLAYER_STATES.IDLE;
			this.parent.set(next);
		}
	}
}
