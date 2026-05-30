import * as THREE from 'three';
import gradientMap from '../shading.js';

const CONFIG = {
	FACETS: 6,
	DEFAULT_CRYSTAL_COUNT: 5,
	GLINT_COUNT: 3
};

const GEOMETRIES = {
	base: new THREE.CylinderGeometry(0.5, 0.62, 1, 8),
	chip: new THREE.DodecahedronGeometry(1, 0),
	glint: new THREE.OctahedronGeometry(1, 0),
};

const MATERIALS = new Map();

export default class IceCrystalCluster {
	constructor({
		height = 0.55,
		width = 0.34,

		iceColor = 0xa9f2ff,
		iceDarkColor = 0x8bdff3,
		iceLightColor = 0xe5fdff,
		baseColor = 0xc7edf5,
		glowColor = 0xf1feff,

		crystalCount = CONFIG.DEFAULT_CRYSTAL_COUNT,
		shimmerSpeed = 0.75,
		shimmerAmount = 0.018,
		phase = Math.random() * Math.PI * 2,
	} = {}) {
		this.root = new THREE.Object3D();

		this.height = height;
		this.width = width;
		this.crystalCount = crystalCount;
		this.shimmerSpeed = shimmerSpeed;
		this.shimmerAmount = shimmerAmount;
		this.phase = phase;

		this.materials = {
			ice: this._toon(iceColor, 0.10, true),
			iceShade: this._toon(iceDarkColor, 0.07, true),
			iceLight: this._toon(iceLightColor, 0.14, true),
			base: this._toon(baseColor, 0.04),
			glow: this._glowMaterial(glowColor),
			glint: this._glintMaterial(iceLightColor)
		};

		this.obstacle = {
			radius: width * 0.10,
			cameraRadius: width * 0.26,
			height
		};

		this.crystals = [];
		this.glows = [];
		this.glints = [];

		this._computeLayout();
		this._createModel();
	}

	addTo(parent) {
		parent.add(this.root);
		return this;
	}

	update(delta) {
		this.phase += delta * this.shimmerSpeed;

		this.crystals.forEach((crystal, index) => {
			const wave = Math.sin(this.phase + index * 0.75) * this.shimmerAmount;
			const base = crystal.userData.baseScale;

			crystal.scale.set(
				base.x * (1 + wave * 0.35),
				base.y * (1 + wave),
				base.z * (1 + wave * 0.35)
			);

			if (crystal.material?.emissive) {
				crystal.material.emissiveIntensity =
					crystal.userData.baseEmissive + wave * 0.75;
			}
		});

		this.glows.forEach((glow, index) => {
			const wave = Math.sin(this.phase + index * 0.6) * this.shimmerAmount;

			glow.material.opacity = 0.14 + wave * 1.2;
		});
	}

	_computeLayout() {
		const h = this.height;
		const w = this.width;

		this.layout = {
			base: {
				y: h * 0.025,
				height: h * 0.045,
				radius: w * 0.46
			},

			shards: this._createShardConfigs(h, w),

			chips: [
				{ angle: 0.4, distance: w * 0.42, size: w * 0.045 },
				{ angle: 2.2, distance: w * 0.32, size: w * 0.035 },
				{ angle: 3.8, distance: w * 0.44, size: w * 0.04 },
				{ angle: 5.1, distance: w * 0.28, size: w * 0.032 },
			],

			glints: [
				{ x: -w * 0.09, y: h * 0.72, z: w * 0.04, size: w * 0.032, rotation: 0.5 },
				{ x: w * 0.15, y: h * 0.52, z: -w * 0.06, size: w * 0.025, rotation: 1.1 },
				{ x: -w * 0.22, y: h * 0.33, z: w * 0.08, size: w * 0.02, rotation: -0.35 },
			]
		};
	}

	_createShardConfigs(h, w) {
		const allConfigs = [
			// Large central shard
			{
				x: 0,
				z: 0,
				height: h,
				radius: w * 0.22,
				rotationY: 0.25,
				tiltX: 0.04,
				tiltZ: -0.05,
				material: this.materials.iceLight,
				glow: true,
				seed: 1.1
			},

			// Tall rear/right shard
			{
				x: w * 0.18,
				z: -w * 0.08,
				height: h * 0.78,
				radius: w * 0.18,
				rotationY: 1.35,
				tiltX: 0.12,
				tiltZ: -0.18,
				material: this.materials.ice,
				glow: true,
				seed: 2.3
			},

			// Broad front shard
			{
				x: -w * 0.18,
				z: w * 0.08,
				height: h * 0.62,
				radius: w * 0.17,
				rotationY: 2.35,
				tiltX: -0.16,
				tiltZ: 0.12,
				material: this.materials.ice,
				glow: false,
				seed: 3.7
			},

			// Small side shard
			{
				x: w * 0.05,
				z: w * 0.24,
				height: h * 0.45,
				radius: w * 0.12,
				rotationY: -0.75,
				tiltX: -0.18,
				tiltZ: -0.2,
				material: this.materials.iceShade,
				glow: false,
				seed: 4.4
			},

			// Low front shard
			{
				x: -w * 0.28,
				z: -w * 0.08,
				height: h * 0.38,
				radius: w * 0.11,
				rotationY: 0.9,
				tiltX: 0.2,
				tiltZ: 0.18,
				material: this.materials.iceShade,
				glow: false,
				seed: 5.8
			},

			// Optional extra shard for larger clusters
			{
				x: w * 0.28,
				z: w * 0.14,
				height: h * 0.34,
				radius: w * 0.10,
				rotationY: 2.9,
				tiltX: -0.1,
				tiltZ: 0.22,
				material: this.materials.iceLight,
				glow: false,
				seed: 6.2
			}
		];

		return allConfigs.slice(0, this.crystalCount);
	}

	_createModel() {
		this._createBase();
		this._createCrystals();
		this._createIceChips();
		this._createGlints();
	}

	_toon(color, emissiveIntensity = 0, vertexColors = false) {
		const key = `${color}-${emissiveIntensity}-${vertexColors}`;

		if (!MATERIALS.has(key)) {
			MATERIALS.set(key, new THREE.MeshToonMaterial({
				color: vertexColors ? 0xffffff : color,
				emissive: new THREE.Color(color),
				emissiveIntensity,
				vertexColors,
				gradientMap
			}));
		}

		return MATERIALS.get(key);
	}

	_glowMaterial(color) {
		return new THREE.MeshBasicMaterial({
			color,
			transparent: true,
			opacity: 0.14,
			depthWrite: false,
			side: THREE.BackSide
		});
	}

	_glintMaterial(color) {
		const key = `glint-${color}`;

		if (!MATERIALS.has(key)) {
			MATERIALS.set(key, new THREE.MeshBasicMaterial({
				color,
				transparent: true,
				opacity: 0.72,
				depthWrite: false
			}));
		}

		return MATERIALS.get(key);
	}

	_mesh({
		geometry,
		material,
		position = [0, 0, 0],
		rotation = [0, 0, 0],
		scale = [1, 1, 1],
		parent = this.root,
		castShadow = true,
		receiveShadow = true
	}) {
		const mesh = new THREE.Mesh(geometry, material);

		mesh.position.set(...position);
		mesh.rotation.set(...rotation);
		mesh.scale.set(...scale);

		mesh.castShadow = castShadow;
		mesh.receiveShadow = receiveShadow;

		parent.add(mesh);
		return mesh;
	}

	_createBase() {
		const base = this.layout.base;

		this._mesh({
			geometry: GEOMETRIES.base,
			material: this.materials.base,
			position: [0, base.y, 0],
			scale: [base.radius, base.height, base.radius]
		});
	}

	_createCrystals() {
		this.layout.shards.forEach((config) => {
			const geometry = this._createCrystalGeometry({
				height: config.height,
				radius: config.radius,
				seed: config.seed
			});

			const crystal = this._mesh({
				geometry,
				material: config.material,
				position: [config.x, 0, config.z],
				rotation: [
					config.tiltX,
					config.rotationY,
					config.tiltZ
				]
			});

			crystal.userData.baseScale = crystal.scale.clone();
			crystal.userData.baseEmissive = crystal.material.emissiveIntensity ?? 0;

			this.crystals.push(crystal);

			if (config.glow) {
				this._createCrystalGlow(config);
			}
		});
	}

	_createCrystalGlow(config) {
		const geometry = this._createCrystalGeometry({
			height: config.height,
			radius: config.radius,
			seed: config.seed + 11.3,
			soften: true
		});

		const glow = this._mesh({
			geometry,
			material: this.materials.glow.clone(),
			position: [config.x, 0, config.z],
			rotation: [
				config.tiltX,
				config.rotationY,
				config.tiltZ
			],
			scale: [1.12, 1.04, 1.12],
			castShadow: false,
			receiveShadow: false
		});

		this.glows.push(glow);
	}

	_createCrystalGeometry({
		height,
		radius,
		seed = 1,
		soften = false
	}) {
		const facets = CONFIG.FACETS;
		const vertices = [];
		const colors = [];
		const indices = [];

		const bottomY = 0;
		const midY = height * 0.58;
		const topY = height;

		const bottomRadius = radius * 0.78;
		const midRadius = radius * 1.08;

		const topOffsetX = Math.sin(seed * 2.1) * radius * 0.18;
		const topOffsetZ = Math.cos(seed * 1.7) * radius * 0.18;

		const bottomStart = 0;
		this._pushRing({
			vertices,
			colors,
			y: bottomY,
			radius: bottomRadius,
			facets,
			seed,
			colorA: this.materials.iceShade.emissive,
			colorB: this.materials.ice.emissive,
			colorMix: 0.45,
			soften
		});

		const midStart = vertices.length / 3;
		this._pushRing({
			vertices,
			colors,
			y: midY,
			radius: midRadius,
			facets,
			seed: seed + 2.4,
			colorA: this.materials.ice.emissive,
			colorB: this.materials.iceLight.emissive,
			colorMix: 0.55,
			soften
		});

		const topIndex = vertices.length / 3;
		vertices.push(topOffsetX, topY, topOffsetZ);
		colors.push(1, 1, 1);

		// Side faces between bottom and middle rings
		for (let i = 0; i < facets; i++) {
			const a = bottomStart + i;
			const b = bottomStart + ((i + 1) % facets);
			const c = midStart + i;
			const d = midStart + ((i + 1) % facets);

			indices.push(a, c, b);
			indices.push(b, c, d);
		}

		// Pointed top faces
		for (let i = 0; i < facets; i++) {
			const c = midStart + i;
			const d = midStart + ((i + 1) % facets);

			indices.push(c, topIndex, d);
		}

		// Bottom cap
		const bottomCenter = vertices.length / 3;
		vertices.push(0, bottomY, 0);
		colors.push(
			this.materials.iceShade.emissive.r,
			this.materials.iceShade.emissive.g,
			this.materials.iceShade.emissive.b
		);

		for (let i = 0; i < facets; i++) {
			const a = bottomStart + i;
			const b = bottomStart + ((i + 1) % facets);

			indices.push(bottomCenter, b, a);
		}

		const geometry = new THREE.BufferGeometry();

		geometry.setAttribute(
			'position',
			new THREE.Float32BufferAttribute(vertices, 3)
		);

		geometry.setAttribute(
			'color',
			new THREE.Float32BufferAttribute(colors, 3)
		);

		geometry.setIndex(indices);
		geometry.computeVertexNormals();

		return geometry;
	}

	_pushRing({
		vertices,
		colors,
		y,
		radius,
		facets,
		seed,
		colorA,
		colorB,
		colorMix,
		soften
	}) {
		for (let i = 0; i < facets; i++) {
			const angle = (i / facets) * Math.PI * 2;

			const jitter = soften
				? 1.0
				: 1 +
				Math.sin(angle * 3 + seed) * 0.08 +
				Math.cos(angle * 5 + seed * 1.3) * 0.05;

			const x = Math.cos(angle) * radius * jitter;
			const z = Math.sin(angle) * radius * jitter;

			vertices.push(x, y, z);

			const faceLight = Math.max(0, Math.cos(angle - seed * 0.4));
			const color = new THREE.Color()
				.copy(colorA)
				.lerp(colorB, colorMix + faceLight * 0.22);

			colors.push(color.r, color.g, color.b);
		}
	}

	_createIceChips() {
		this.layout.chips.forEach(({ angle, distance, size }, index) => {
			this._mesh({
				geometry: GEOMETRIES.chip,
				material: index % 2 === 0
					? this.materials.iceShade
					: this.materials.iceLight,
				position: [
					Math.cos(angle) * distance,
					this.height * 0.03,
					Math.sin(angle) * distance
				],
				rotation: [0.2, angle, -0.15],
				scale: [
					size,
					size * 0.65,
					size
				]
			});
		});
	}

	_createGlints() {
		this.layout.glints
			.slice(0, CONFIG.GLINT_COUNT)
			.forEach(({ x, y, z, size, rotation }, index) => {
				const glint = this._mesh({
					geometry: GEOMETRIES.glint,
					material: this.materials.glint,
					position: [x, y, z],
					rotation: [0.2, rotation, index * 0.35],
					scale: [size * 0.42, size, size * 0.42],
					castShadow: false,
					receiveShadow: false
				});

				this.glints.push(glint);
			});
	}
}
