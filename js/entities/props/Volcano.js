import * as THREE from 'three';
import gradientMap from '../shading.js';

const CONFIG = {
	SEGMENTS: 18,
	SMOKE_PUFF_COUNT: 3
};

const GEOMETRIES = {
	lava: new THREE.CircleGeometry(1, 20),
	innerBowl: new THREE.CylinderGeometry(1, 1, 1, 20),
	rock: new THREE.DodecahedronGeometry(1, 0),
	smoke: new THREE.SphereGeometry(1, 8, 8),
};

const MATERIALS = new Map();

export default class Volcano {
	constructor({
		height = 0.18,
		width = 0.16,

		rockColor = 0x2a1712,
		rockDarkColor = 0x120807,
		rockLightColor = 0x4a2418,
		lavaColor = 0xffc21c,
		lavaLightColor = 0xffff66,
		smokeColor = 0xb8b0aa,

		smokeSpeed = 0.9,
		pulseSpeed = 1.4,
		phase = Math.random() * Math.PI * 2
	} = {}) {
		this.root = new THREE.Object3D();

		this.height = height;
		this.width = width;
		this.smokeSpeed = smokeSpeed;
		this.pulseSpeed = pulseSpeed;
		this.phase = phase;
		this.elapsed = 0;

		this.materials = {
			rock: this._terrainMaterial(rockColor, rockDarkColor, rockLightColor),
			rockDark: this._toon(rockDarkColor),
			lava: new THREE.MeshToonMaterial({
				color: lavaColor,
				emissive: new THREE.Color(lavaColor),
				emissiveIntensity: 0.35,
				gradientMap
			}),
			lavaLight: this._toon(lavaLightColor),
			smoke: this._smokeMaterial(smokeColor)
		};

		this.obstacle = {
			radius: width * 0.08,
			cameraRadius: width * 0.22,
			height
		};

		this.smokePuffs = [];

		this._computeLayout();
		this._createModel();
	}

	addTo(parent) {
		parent.add(this.root);
		return this;
	}

	update(delta) {
		this.elapsed += delta;

		this._updateLava();
		this._updateSmoke();
	}

	_computeLayout() {
		const h = this.height;
		const w = this.width;

		this.layout = {
			crater: {
				innerRadius: w * 0.30,
				outerRadius: w * 0.78,

				rings: [
					// Lower skirt
					{
						radiusScale: 0.75,
						y: h * 0.00,
						noise: 0.14,
						colorMix: 0.28
					},

					// Main volcanic mound
					{
						radiusScale: 0.58,
						y: h * 0.45,
						noise: 0.16,
						colorMix: 0.58
					},

					// Raised crater rim
					{
						useInnerRadius: true,
						radiusScale: 1.18,
						y: h * 0.72,
						noise: 0.10,
						colorMix: 0.82
					},

					// Inner dark lip
					{
						useInnerRadius: true,
						radiusScale: 1.02,
						y: h * 0.60,
						noise: 0.05,
						colorMix: 0.95
					}
				]
			},

			lava: {
				y: h * 0.61,
				radius: w * 0.285,
				highlightRadiusX: w * 0.075,
				highlightRadiusY: w * 0.045,
				highlightOffset: [w * 0.045, h * 0.006, w * 0.02],
				bowlRadiusX: w * 0.35,
				bowlRadiusZ: w * 0.31,
				bowlHeight: h * 0.025,
				bowlY: h * 0.61 - h * 0.022
			},

			rocks: [
				{ angle: 0.3, radius: 0.78, size: 0.12 },
				{ angle: 1.7, radius: 0.90, size: 0.08 },
				{ angle: 3.2, radius: 0.68, size: 0.10 },
				{ angle: 4.8, radius: 0.82, size: 0.09 }
			],

			smoke: {
				baseY: h * 0.61 + h * 0.045,
				rise: h * 1.25,
				drift: w * 0.055,
				minScale: w * 0.08,
				maxScale: w * 0.26
			}
		};
	}

	_createModel() {
		this._createCraterTerrain();
		this._createLavaPool();
		this._createLooseRocks();
		this._createSmoke();
	}

	_updateLava() {
		if (!this.lava) return;

		const wave = Math.sin(this.elapsed * this.pulseSpeed + this.phase);
		const pulse = 1 + wave * 0.035;

		this.lava.scale.x = this.lavaBaseScale.x * pulse;
		this.lava.scale.y = this.lavaBaseScale.y * pulse;

		this.materials.lava.emissiveIntensity = 0.35 + wave * 0.08;
	}

	_updateSmoke() {
		const smoke = this.layout.smoke;

		this.smokePuffs.forEach((puff, index) => {
			const t = (
				this.elapsed * this.smokeSpeed +
				index * 0.48 +
				this.phase
			) % 1.9;

			const normalized = t / 1.9;

			puff.position.y = smoke.baseY + normalized * smoke.rise;
			puff.position.x = Math.sin(this.elapsed * 1.2 + index * 1.9) * smoke.drift;
			puff.position.z = Math.cos(this.elapsed * 1.1 + index * 1.4) * smoke.drift;

			const puffScale = THREE.MathUtils.lerp(
				smoke.minScale,
				smoke.maxScale,
				normalized
			);

			puff.scale.setScalar(puffScale);
			puff.material.opacity = Math.max(0, 0.42 - normalized * 0.34);
		});
	}

	_toon(color) {
		if (!MATERIALS.has(color)) {
			MATERIALS.set(color, new THREE.MeshToonMaterial({
				color,
				gradientMap
			}));
		}

		return MATERIALS.get(color);
	}

	_smokeMaterial(color) {
		return new THREE.MeshToonMaterial({
			color,
			gradientMap,
			transparent: true,
			opacity: 0.35
		});
	}

	_terrainMaterial(baseColor, darkColor, lightColor) {
		const key = `terrain-${baseColor}-${darkColor}-${lightColor}`;

		if (!MATERIALS.has(key)) {
			MATERIALS.set(key, new THREE.MeshToonMaterial({
				vertexColors: true,
				gradientMap
			}));
		}

		this.terrainColors = {
			base: new THREE.Color(baseColor),
			dark: new THREE.Color(darkColor),
			light: new THREE.Color(lightColor)
		};

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

	_createCraterTerrain() {
		const geometry = this._createCraterGeometry();

		this._mesh({
			geometry,
			material: this.materials.rock,
			rotation: [0, this.phase * 0.2, 0]
		});
	}

	_createCraterGeometry() {
		const vertices = [];
		const colors = [];
		const indices = [];

		const crater = this.layout.crater;
		const rings = crater.rings;

		rings.forEach((ring, ringIndex) => {
			const baseRadius = ring.useInnerRadius
				? crater.innerRadius
				: crater.outerRadius;

			for (let i = 0; i < CONFIG.SEGMENTS; i++) {
				const angle = (i / CONFIG.SEGMENTS) * Math.PI * 2;

				const jitter =
					1 +
					Math.sin(angle * 3.0 + this.phase + ringIndex) * ring.noise +
					Math.sin(angle * 7.0 + this.phase * 0.7) * ring.noise * 0.45;

				const radius = baseRadius * ring.radiusScale * jitter;

				vertices.push(
					Math.cos(angle) * radius,
					ring.y,
					Math.sin(angle) * radius
				);

				const color = this._getTerrainColor(angle, ringIndex, ring.colorMix);
				colors.push(color.r, color.g, color.b);
			}
		});

		for (let ring = 0; ring < rings.length - 1; ring++) {
			const current = ring * CONFIG.SEGMENTS;
			const next = (ring + 1) * CONFIG.SEGMENTS;

			for (let i = 0; i < CONFIG.SEGMENTS; i++) {
				const a = current + i;
				const b = current + ((i + 1) % CONFIG.SEGMENTS);
				const c = next + i;
				const d = next + ((i + 1) % CONFIG.SEGMENTS);

				indices.push(a, c, b);
				indices.push(b, c, d);
			}
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

	_getTerrainColor(angle, ringIndex, colorMix) {
		const color = new THREE.Color();

		if (ringIndex >= 2) {
			return color.copy(this.terrainColors.dark);
		}

		return color
			.copy(this.terrainColors.dark)
			.lerp(this.terrainColors.base, colorMix)
			.lerp(
				this.terrainColors.light,
				Math.max(0, Math.sin(angle * 2 + this.phase)) * 0.18
			);
	}

	_createLavaPool() {
		const lava = this.layout.lava;

		this._mesh({
			geometry: GEOMETRIES.innerBowl,
			material: this.materials.rockDark,
			position: [0, lava.bowlY, 0],
			scale: [
				lava.bowlRadiusX,
				lava.bowlHeight,
				lava.bowlRadiusZ
			]
		});

		this.lava = this._mesh({
			geometry: GEOMETRIES.lava,
			material: this.materials.lava,
			position: [0, lava.y, 0],
			rotation: [-Math.PI / 2, 0, 0],
			scale: [
				lava.radius,
				lava.radius,
				1
			]
		});

		this.lavaBaseScale = this.lava.scale.clone();

		this._mesh({
			geometry: GEOMETRIES.lava,
			material: this.materials.lavaLight,
			position: [
				lava.highlightOffset[0],
				lava.y + lava.highlightOffset[1],
				lava.highlightOffset[2]
			],
			rotation: [-Math.PI / 2, 0, 0],
			scale: [
				lava.highlightRadiusX,
				lava.highlightRadiusY,
				1
			]
		});
	}

	_createLooseRocks() {
		this.layout.rocks.forEach(({ angle, radius, size }, index) => {
			this._mesh({
				geometry: GEOMETRIES.rock,
				material: index % 2 === 0
					? this.materials.rockDark
					: this.materials.rock,
				position: [
					Math.cos(angle) * this.width * radius,
					this.height * 0.04,
					Math.sin(angle) * this.width * radius
				],
				rotation: [0.15, angle, -0.12],
				scale: [
					this.width * size,
					this.width * size * 0.7,
					this.width * size
				]
			});
		});
	}

	_createSmoke() {
		for (let i = 0; i < CONFIG.SMOKE_PUFF_COUNT; i++) {
			const puff = this._mesh({
				geometry: GEOMETRIES.smoke,
				material: this.materials.smoke.clone(),
				position: [0, this.layout.smoke.baseY, 0],
				scale: [0.01, 0.01, 0.01],
				castShadow: false,
				receiveShadow: false
			});

			this.smokePuffs.push(puff);
		}
	}
}
