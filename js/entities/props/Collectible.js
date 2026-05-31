import * as THREE from 'three';

const DEFAULT_OPTIONS = {
	SIZE: 0.1,
	CORE_COLOR: 0xff7ab6,
	GLOW_COLOR: 0xff4fd8,
	PARTICLE_COLOR: 0xffd1f0,
	PULSE_SPEED: 2.0,
	SPIN_SPEED: 1.4,
	PARTICLE_COUNT: 150,
	MOTE_COUNT: 7
};

const SHAPE = {
	COLLECT_RADIUS_RATIO: 0.05,

	CORE_SCALE: 0.24,
	HOVER_HEIGHT_RATIO: 1.05,
	HOVER_BOB_RATIO: 0.09,
	PULSE_SCALE_RATIO: 0.055,

	OUTER_GLOW_SCALE: 2.8,
	INNER_GLOW_SCALE: 1.45,

	LIGHT_INTENSITY: 0.14,
	LIGHT_PULSE: 0.035,
	LIGHT_DISTANCE_RATIO: 4.5
};

const PARTICLES = {
	TEXTURE_SIZE: 64,
	GLOW_TEXTURE_SIZE: 128,

	SHELL_MIN_RADIUS_RATIO: 0.48,
	SHELL_RADIUS_VARIATION: 0.58,
	SHELL_Y_SCALE: 0.9,

	SHELL_POINT_SIZE_RATIO: 0.085,
	RING_POINT_SIZE_RATIO: 0.055,

	SHELL_ROTATION_SPEED_RATIO: 0.45,
	SHELL_WOBBLE_SPEED: 0.32,
	SHELL_WOBBLE_AMOUNT: 0.18,

	RING_NOISE_AMOUNT_RATIO: 0.08,
	RING_VERTICAL_WAVE_RATIO: 0.035
};

const OPACITY = {
	INNER_GLOW_BASE: 0.50,
	INNER_GLOW_PULSE: 0.10,

	OUTER_GLOW_BASE: 0.20,
	OUTER_GLOW_PULSE: 0.06,

	PARTICLES_BASE: 0.58,
	PARTICLES_PULSE: 0.10,

	RINGS_BASE: 0.62,
	RINGS_PULSE: 0.12
};

const MOTE = {
	MIN_ORBIT_RADIUS_RATIO: 0.62,
	ORBIT_RADIUS_VARIATION: 0.34,

	MIN_SCALE_RATIO: 0.045,
	SCALE_VARIATION: 0.035,

	INITIAL_HEIGHT_RANGE_RATIO: 0.35,
	HEIGHT_RANGE_RATIO: 0.32,
	BOB_RATIO: 0.12,

	MIN_SPEED_RATIO: 0.65,
	SPEED_VARIATION: 0.7,

	GROUP_ROTATION_SPEED_RATIO: -0.65,
	PULSE_SPEED: 2.1,
	PULSE_AMOUNT: 0.18
};

const RING_LAYOUTS = [
	{
		count: 90,
		radiusX: 1.0,
		radiusZ: 0.62,
		rotation: [0.9, 0.15, 0.25],
		seed: 10
	},
	{
		count: 70,
		radiusX: 0.82,
		radiusZ: 0.46,
		rotation: [-0.45, 0.7, -0.35],
		seed: 40
	},
	{
		count: 55,
		radiusX: 0.66,
		radiusZ: 0.34,
		rotation: [0.2, -0.55, 0.9],
		seed: 80
	}
];

const SHELL_NOISE = {
	THETA_FREQUENCY_A: 5,
	Z_FREQUENCY_A: 8,
	AMPLITUDE_A_RATIO: 0.035,

	THETA_FREQUENCY_B: 2.2,
	INDEX_FREQUENCY_B: 0.31,
	AMPLITUDE_B_RATIO: 0.025
};

const RANDOM_SEEDS = {
	SHELL_Z: 1.73,
	SHELL_THETA: 9.91,
	SHELL_RADIUS: 21.7,

	MOTE_RADIUS: 100,
	MOTE_SCALE: 200,
	MOTE_INITIAL_HEIGHT: 300,
	MOTE_HEIGHT: 400,
	MOTE_SPEED: 500,
	MOTE_PHASE: 600
};

const GEOMETRIES = {
	core: new THREE.SphereGeometry(1, 16, 10),
	mote: new THREE.SphereGeometry(1, 8, 6)
};

const MATERIAL_CACHE = new Map();

const PARTICLE_TEXTURE = createRadialTexture(PARTICLES.TEXTURE_SIZE);
const GLOW_TEXTURE = createRadialTexture(PARTICLES.GLOW_TEXTURE_SIZE);

function createRadialTexture(size) {
	const canvas = document.createElement('canvas');
	canvas.width = size;
	canvas.height = size;

	const ctx = canvas.getContext('2d');
	const center = size / 2;
	const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);

	gradient.addColorStop(0, 'rgba(255,255,255,1)');
	gradient.addColorStop(0.25, 'rgba(255,255,255,0.55)');
	gradient.addColorStop(0.65, 'rgba(255,255,255,0.12)');
	gradient.addColorStop(1, 'rgba(255,255,255,0)');

	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, size, size);

	return new THREE.CanvasTexture(canvas);
}

function seededRandom(seed) {
	const x = Math.sin(seed * 999.91) * 43758.5453123;
	return x - Math.floor(x);
}

function materialKey(prefix, color, opacity, extra = '') {
	return `${prefix}-${new THREE.Color(color).getHexString()}-${opacity}-${extra}`;
}

export default class Collectible {
	constructor({
		size = DEFAULT_OPTIONS.SIZE,
		color = DEFAULT_OPTIONS.CORE_COLOR,
		glowColor = DEFAULT_OPTIONS.GLOW_COLOR,
		particleColor = DEFAULT_OPTIONS.PARTICLE_COLOR,
		pulseSpeed = DEFAULT_OPTIONS.PULSE_SPEED,
		spinSpeed = DEFAULT_OPTIONS.SPIN_SPEED,
		particleCount = DEFAULT_OPTIONS.PARTICLE_COUNT,
		moteCount = DEFAULT_OPTIONS.MOTE_COUNT
	} = {}) {
		this.root = new THREE.Object3D();
		this.visual = new THREE.Object3D();
		this.glowGroup = new THREE.Object3D();
		this.particleGroup = new THREE.Object3D();
		this.moteGroup = new THREE.Object3D();

		this.root.add(this.visual);
		this.visual.add(this.glowGroup);
		this.visual.add(this.particleGroup);
		this.visual.add(this.moteGroup);

		this.size = size;
		this.collectRadius = size * SHAPE.COLLECT_RADIUS_RATIO;
		this.pulseSpeed = pulseSpeed;
		this.spinSpeed = spinSpeed;
		this.elapsed = 0;

		this.planet = null;
		this.surfaceNormal = new THREE.Vector3();
		this.motes = [];

		this.materials = {
			core: this._meshMaterial(color, 1, true),
			mote: this._meshMaterial(particleColor, 0.85, true),
			innerGlow: this._spriteMaterial(glowColor, OPACITY.INNER_GLOW_BASE),
			outerGlow: this._spriteMaterial(glowColor, OPACITY.OUTER_GLOW_BASE),
			particles: this._pointsMaterial(
				particleColor,
				OPACITY.PARTICLES_BASE,
				size * PARTICLES.SHELL_POINT_SIZE_RATIO
			),
			ringParticles: this._pointsMaterial(
				glowColor,
				OPACITY.RINGS_BASE,
				size * PARTICLES.RING_POINT_SIZE_RATIO
			)
		};

		this._createModel({ particleCount, moteCount, glowColor });
	}

	addTo(parent) {
		parent.add(this.root);
		return this;
	}

	update(delta) {
		this.elapsed += delta;

		const pulse = Math.sin(this.elapsed * this.pulseSpeed);
		const hover = Math.sin(this.elapsed * this.pulseSpeed * 0.72) *
			this.size *
			SHAPE.HOVER_BOB_RATIO;
		const scale = 1 + pulse * SHAPE.PULSE_SCALE_RATIO;

		this.visual.position.y = this.size * SHAPE.HOVER_HEIGHT_RATIO + hover;
		this.visual.scale.setScalar(scale);

		this.particleGroup.rotation.y += delta *
			this.spinSpeed *
			PARTICLES.SHELL_ROTATION_SPEED_RATIO;
		this.particleGroup.rotation.x =
			Math.sin(this.elapsed * PARTICLES.SHELL_WOBBLE_SPEED) *
			PARTICLES.SHELL_WOBBLE_AMOUNT;

		this.moteGroup.rotation.y += delta *
			this.spinSpeed *
			MOTE.GROUP_ROTATION_SPEED_RATIO;

		this._updateMotes();
		this._updateMaterialPulse(pulse);

		if (this.light) {
			this.light.intensity =
				SHAPE.LIGHT_INTENSITY +
				pulse * SHAPE.LIGHT_PULSE;
		}
	}

	_createModel({ particleCount, moteCount, glowColor }) {
		this._sprite(this.materials.outerGlow, this.size * SHAPE.OUTER_GLOW_SCALE);
		this._sprite(this.materials.innerGlow, this.size * SHAPE.INNER_GLOW_SCALE);

		this._mesh(GEOMETRIES.core, this.materials.core, this.size * SHAPE.CORE_SCALE);

		this._createParticleShell(particleCount);
		this._createParticleRings();
		this._createMotes(moteCount);

		this.light = new THREE.PointLight(
			glowColor,
			SHAPE.LIGHT_INTENSITY,
			this.size * SHAPE.LIGHT_DISTANCE_RATIO
		);

		this.visual.add(this.light);
	}

	_updateMotes() {
		this.motes.forEach((mote) => {
			const angle = this.elapsed * mote.speed + mote.phase;

			mote.mesh.position.set(
				Math.cos(angle) * mote.radius,
				mote.height + Math.sin(angle * 1.7) * this.size * MOTE.BOB_RATIO,
				Math.sin(angle) * mote.radius
			);

			mote.mesh.scale.setScalar(
				mote.baseScale *
				(1 + Math.sin(this.elapsed * MOTE.PULSE_SPEED + mote.phase) * MOTE.PULSE_AMOUNT)
			);
		});
	}

	_updateMaterialPulse(pulse) {
		this.materials.innerGlow.opacity =
			OPACITY.INNER_GLOW_BASE +
			pulse * OPACITY.INNER_GLOW_PULSE;

		this.materials.outerGlow.opacity =
			OPACITY.OUTER_GLOW_BASE +
			pulse * OPACITY.OUTER_GLOW_PULSE;

		this.materials.particles.opacity =
			OPACITY.PARTICLES_BASE +
			pulse * OPACITY.PARTICLES_PULSE;

		this.materials.ringParticles.opacity =
			OPACITY.RINGS_BASE +
			pulse * OPACITY.RINGS_PULSE;
	}

	_createParticleShell(count) {
		const positions = new Float32Array(count * 3);

		for (let i = 0; i < count; i++) {
			const z = seededRandom(i + RANDOM_SEEDS.SHELL_Z) * 2 - 1;
			const theta = seededRandom(i + RANDOM_SEEDS.SHELL_THETA) * Math.PI * 2;
			const radius = Math.sqrt(1 - z * z);
			const shellRadius = this.size * (
				PARTICLES.SHELL_MIN_RADIUS_RATIO +
				seededRandom(i + RANDOM_SEEDS.SHELL_RADIUS) *
				PARTICLES.SHELL_RADIUS_VARIATION
			);

			const noise = this._shellNoise(theta, z, i);
			const finalRadius = shellRadius + noise;

			positions[i * 3] = Math.cos(theta) * radius * finalRadius;
			positions[i * 3 + 1] = z * finalRadius * PARTICLES.SHELL_Y_SCALE;
			positions[i * 3 + 2] = Math.sin(theta) * radius * finalRadius;
		}

		this.particleGroup.add(this._points(positions, this.materials.particles));
	}

	_shellNoise(theta, z, index) {
		return (
			Math.sin(
				theta * SHELL_NOISE.THETA_FREQUENCY_A +
				z * SHELL_NOISE.Z_FREQUENCY_A
			) *
			this.size *
			SHELL_NOISE.AMPLITUDE_A_RATIO
		) + (
				Math.cos(
					theta * SHELL_NOISE.THETA_FREQUENCY_B +
					index * SHELL_NOISE.INDEX_FREQUENCY_B
				) *
				this.size *
				SHELL_NOISE.AMPLITUDE_B_RATIO
			);
	}

	_createParticleRings() {
		RING_LAYOUTS.forEach((ring) => {
			const positions = new Float32Array(ring.count * 3);

			for (let i = 0; i < ring.count; i++) {
				const angle = (i / ring.count) * Math.PI * 2;
				const jitter = (seededRandom(ring.seed + i * 2.7) - 0.5) *
					this.size *
					PARTICLES.RING_NOISE_AMOUNT_RATIO;

				positions[i * 3] =
					Math.cos(angle) *
					this.size *
					(ring.radiusX + jitter);

				positions[i * 3 + 1] =
					Math.sin(angle * 3 + ring.seed) *
					this.size *
					PARTICLES.RING_VERTICAL_WAVE_RATIO;

				positions[i * 3 + 2] =
					Math.sin(angle) *
					this.size *
					(ring.radiusZ + jitter);
			}

			const points = this._points(positions, this.materials.ringParticles);
			points.rotation.set(...ring.rotation);
			this.particleGroup.add(points);
		});
	}

	_createMotes(count) {
		for (let i = 0; i < count; i++) {
			const angle = i * (Math.PI * 2 / count);
			const radius = this.size * (
				MOTE.MIN_ORBIT_RADIUS_RATIO +
				seededRandom(i + RANDOM_SEEDS.MOTE_RADIUS) *
				MOTE.ORBIT_RADIUS_VARIATION
			);

			const baseScale = this.size * (
				MOTE.MIN_SCALE_RATIO +
				seededRandom(i + RANDOM_SEEDS.MOTE_SCALE) *
				MOTE.SCALE_VARIATION
			);

			const mesh = this._mesh(
				GEOMETRIES.mote,
				this.materials.mote,
				baseScale,
				[
					Math.cos(angle) * radius,
					(seededRandom(i + RANDOM_SEEDS.MOTE_INITIAL_HEIGHT) - 0.5) *
					this.size *
					MOTE.INITIAL_HEIGHT_RANGE_RATIO,
					Math.sin(angle) * radius
				],
				this.moteGroup
			);

			this.motes.push({
				mesh,
				radius,
				baseScale,
				height: (seededRandom(i + RANDOM_SEEDS.MOTE_HEIGHT) - 0.5) *
					this.size *
					MOTE.HEIGHT_RANGE_RATIO,
				speed: this.spinSpeed * (
					MOTE.MIN_SPEED_RATIO +
					seededRandom(i + RANDOM_SEEDS.MOTE_SPEED) *
					MOTE.SPEED_VARIATION
				),
				phase: angle + seededRandom(i + RANDOM_SEEDS.MOTE_PHASE) * Math.PI
			});
		}
	}

	_mesh(geometry, material, scale, position = [0, 0, 0], parent = this.visual) {
		const mesh = new THREE.Mesh(geometry, material);

		mesh.position.set(...position);
		mesh.scale.setScalar(scale);
		mesh.castShadow = false;
		mesh.receiveShadow = false;

		parent.add(mesh);
		return mesh;
	}

	_sprite(material, scale) {
		const sprite = new THREE.Sprite(material);

		sprite.scale.setScalar(scale);
		sprite.renderOrder = 10;

		this.glowGroup.add(sprite);
		return sprite;
	}

	_points(positions, material) {
		const geometry = new THREE.BufferGeometry();
		geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

		const points = new THREE.Points(geometry, material);
		points.frustumCulled = false;

		return points;
	}

	_meshMaterial(color, opacity = 1, additive = false) {
		const key = materialKey('mesh', color, opacity, additive);

		if (!MATERIAL_CACHE.has(key)) {
			MATERIAL_CACHE.set(key, new THREE.MeshBasicMaterial({
				color,
				transparent: opacity < 1,
				opacity,
				depthWrite: opacity >= 1,
				blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
			}));
		}

		return MATERIAL_CACHE.get(key);
	}

	_spriteMaterial(color, opacity) {
		return new THREE.SpriteMaterial({
			color,
			map: GLOW_TEXTURE,
			transparent: true,
			opacity,
			depthWrite: false,
			blending: THREE.AdditiveBlending
		});
	}

	_pointsMaterial(color, opacity, size) {
		return new THREE.PointsMaterial({
			color,
			map: PARTICLE_TEXTURE,
			transparent: true,
			opacity,
			size,
			sizeAttenuation: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending
		});
	}
}
