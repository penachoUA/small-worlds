import * as THREE from 'three';
import gradientMap from '../shading.js';

const MATERIALS = new Map();

const GEOMETRIES = {
	flame: new THREE.ConeGeometry(1, 1, 7),
	ember: new THREE.SphereGeometry(1, 8, 6),
	glow: new THREE.SphereGeometry(1, 12, 8),
	log: new THREE.CylinderGeometry(1, 1, 1, 8),
	stone: new THREE.DodecahedronGeometry(1, 0)
};

export default class Igloo {
	constructor({
		gltf,

		size = 1.0,

		snowColor = 0xffffff,
		snowSoftColor = 0xf8fdff,
		snowShadowColor = 0xeefaff
	} = {}) {
		this.root = new THREE.Object3D();

		this.size = size;
		this.fireTime = Math.random() * 100;

		this.materials = {
			snow: this._toon(snowColor),
			snowSoft: this._toon(snowSoftColor),
			snowShadow: this._toon(snowShadowColor),

			fireRed: this._basic(0xff3b18),
			fireOrange: this._basic(0xff6a1f),
			fireDeepOrange: this._basic(0xff8a1f),
			fireGold: this._basic(0xffbd45),
			fireYellow: this._basic(0xffe38a),

			log: this._toon(0x3a1f14),
			stone: this._toon(0x343038)
		};

		this.fireColors = [
			new THREE.Color(0xff3b18),
			new THREE.Color(0xff5a1f),
			new THREE.Color(0xff7a1f),
			new THREE.Color(0xff9a24),
			new THREE.Color(0xffbd45),
			new THREE.Color(0xffe38a)
		];

		this.obstacle = {
			radius: size * 0.36,
			cameraRadius: size * 0.48,
			height: size * 0.5
		};

		this._setupModel(gltf);
	}

	addTo(parent) {
		parent.add(this.root);
		return this;
	}

	update(delta) {
		if (!this.fireGroup) return;

		this.fireTime += delta;

		const flicker =
			0.35 +
			0.10 * Math.sin(this.fireTime * 2.6) +
			0.07 * Math.sin(this.fireTime * 4.1 + 1.6) +
			0.035 * Math.sin(this.fireTime * 6.3 + 2.2);

		const colorT = 0.5 + 0.5 * Math.sin(this.fireTime * 1.7);
		const warmColor = this.fireColors[1].clone().lerp(this.fireColors[4], colorT);
		const hotColor = this.fireColors[2].clone().lerp(this.fireColors[5], colorT);

		this.fireLight.color.copy(warmColor);
		this.fireLight.intensity = 0.16 + flicker * 0.18;
		this.fireLight.distance = this.size * (0.28 + flicker * 0.12);

		this.fireGlow.material.opacity = 0.055 + flicker * 0.045;
		this.fireGlow.material.color.copy(warmColor);

		this.outerFlame.material.color.copy(warmColor);
		this.middleFlame.material.color.copy(hotColor);
		this.innerFlame.material.color.copy(this.fireColors[5]);

		this.outerFlame.scale.set(
			this.size * 0.038 * (1 + flicker * 0.18),
			this.size * 0.095 * (1 + flicker * 0.28),
			this.size * 0.038 * (1 + flicker * 0.18)
		);

		this.middleFlame.scale.set(
			this.size * 0.028 * (1 + flicker * 0.15),
			this.size * 0.070 * (1 + flicker * 0.22),
			this.size * 0.028 * (1 + flicker * 0.15)
		);

		this.innerFlame.scale.set(
			this.size * 0.017 * (1 + flicker * 0.12),
			this.size * 0.050 * (1 + flicker * 0.18),
			this.size * 0.017 * (1 + flicker * 0.12)
		);

		this.ember.scale.setScalar(this.size * (0.030 + flicker * 0.008));
		this.fireGroup.position.y = this.fireBaseY + flicker * this.size * 0.004;
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

	_basic(color, options = {}) {
		const key = `basic-${color}-${options.transparent ?? false}-${options.opacity ?? 1}`;

		if (!MATERIALS.has(key)) {
			MATERIALS.set(key, new THREE.MeshBasicMaterial({
				color,
				transparent: options.transparent ?? false,
				opacity: options.opacity ?? 1,
				depthWrite: options.depthWrite ?? true
			}));
		}

		return MATERIALS.get(key);
	}

	_setupModel(gltf) {
		if (!gltf?.scene) {
			console.warn('Igloo expected a GLTF scene.');
			return;
		}

		this.model = gltf.scene.clone(true);
		this.root.add(this.model);

		this._paintModel();
		this._fitModelToSize();
		this._createInteriorFire();
		this._updateObstacleFromBounds();
	}

	_fitModelToSize() {
		this.model.position.set(0, 0, 0);
		this.model.scale.setScalar(1);
		this.model.updateWorldMatrix(true, true);

		const originalBox = new THREE.Box3().setFromObject(this.model);
		const originalSize = new THREE.Vector3();

		originalBox.getSize(originalSize);

		const footprint = Math.max(
			originalSize.x,
			originalSize.z
		) || 1;

		const scale = this.size / footprint;
		this.model.scale.setScalar(scale);

		this.model.updateWorldMatrix(true, true);

		const fittedBox = new THREE.Box3().setFromObject(this.model);
		const fittedCenter = new THREE.Vector3();

		fittedBox.getCenter(fittedCenter);

		this.model.position.x -= fittedCenter.x;
		this.model.position.z -= fittedCenter.z;
		this.model.position.y -= fittedBox.min.y;
	}

	_paintModel() {
		const palette = [
			this.materials.snow,
			this.materials.snow,
			this.materials.snow,
			this.materials.snowSoft,
			this.materials.snowShadow
		];

		let meshIndex = 0;

		this.model.traverse((child) => {
			if (!child.isMesh) return;

			child.castShadow = true;
			child.receiveShadow = true;

			child.material = palette[meshIndex % palette.length];

			meshIndex += 1;
		});
	}

	_createInteriorFire() {
		this.fireGroup = new THREE.Group();

		this.fireBaseY = this.size * 0.075;
		this.fireGroup.position.set(
			0,
			this.fireBaseY,
			this.size * 0.11
		);

		this._createLogs();
		this._createStones();

		this.outerFlame = this._createFlame({
			material: this.materials.fireOrange,
			position: [0, this.size * 0.045, 0],
			rotation: [0.08, 0.2, -0.08],
			scale: [
				this.size * 0.038,
				this.size * 0.095,
				this.size * 0.038
			]
		});

		this.middleFlame = this._createFlame({
			material: this.materials.fireGold,
			position: [this.size * 0.010, this.size * 0.055, this.size * 0.002],
			rotation: [-0.06, -0.4, 0.08],
			scale: [
				this.size * 0.028,
				this.size * 0.070,
				this.size * 0.028
			]
		});

		this.innerFlame = this._createFlame({
			material: this.materials.fireYellow,
			position: [-this.size * 0.006, this.size * 0.060, this.size * 0.004],
			rotation: [0.04, 0.6, -0.04],
			scale: [
				this.size * 0.017,
				this.size * 0.050,
				this.size * 0.017
			]
		});

		this.ember = new THREE.Mesh(
			GEOMETRIES.ember,
			this.materials.fireRed
		);
		this.ember.position.set(0, this.size * 0.022, 0);
		this.ember.scale.setScalar(this.size * 0.030);
		this.fireGroup.add(this.ember);

		this.fireGlow = new THREE.Mesh(
			GEOMETRIES.glow,
			this._basic(0xff6a1f, {
				transparent: true,
				opacity: 0.18,
				depthWrite: false
			})
		);
		this.fireGlow.position.set(0, this.size * 0.050, 0);
		this.fireGlow.scale.set(
			this.size * 0.085,
			this.size * 0.070,
			this.size * 0.085
		);
		this.fireGlow.castShadow = false;
		this.fireGlow.receiveShadow = false;
		this.fireGroup.add(this.fireGlow);

		this.fireLight = new THREE.PointLight(
			0xff7a1f,
			0.25,
			this.size * 0.38,
			2
		);
		this.fireLight.position.set(0, this.size * 0.070, 0);
		this.fireLight.castShadow = false;
		this.fireGroup.add(this.fireLight);

		this.root.add(this.fireGroup);
	}

	_createFlame({
		material,
		position,
		rotation,
		scale
	}) {
		const flame = new THREE.Mesh(GEOMETRIES.flame, material);

		flame.position.set(...position);
		flame.rotation.set(...rotation);
		flame.scale.set(...scale);
		flame.castShadow = false;
		flame.receiveShadow = false;

		this.fireGroup.add(flame);
		return flame;
	}

	_createLogs() {
		const logConfigs = [
			{
				position: [-this.size * 0.025, this.size * 0.014, 0],
				rotation: [0, 0, Math.PI / 2 + 0.45]
			},
			{
				position: [this.size * 0.025, this.size * 0.014, 0],
				rotation: [0, 0, Math.PI / 2 - 0.45]
			}
		];

		logConfigs.forEach((config) => {
			const log = new THREE.Mesh(
				GEOMETRIES.log,
				this.materials.log
			);

			log.position.set(...config.position);
			log.rotation.set(...config.rotation);
			log.scale.set(
				this.size * 0.012,
				this.size * 0.070,
				this.size * 0.012
			);

			log.castShadow = false;
			log.receiveShadow = true;

			this.fireGroup.add(log);
		});
	}

	_createStones() {
		const stoneAngles = [0.2, 2.0, 3.8, 5.2];

		stoneAngles.forEach((angle, index) => {
			const stone = new THREE.Mesh(
				GEOMETRIES.stone,
				this.materials.stone
			);

			stone.position.set(
				Math.cos(angle) * this.size * 0.055,
				this.size * 0.010,
				Math.sin(angle) * this.size * 0.042
			);

			stone.rotation.set(0.2, angle, -0.1);
			stone.scale.setScalar(this.size * (0.014 + index * 0.002));

			stone.castShadow = false;
			stone.receiveShadow = true;

			this.fireGroup.add(stone);
		});
	}

	_updateObstacleFromBounds() {
		this.root.updateWorldMatrix(true, true);

		const box = new THREE.Box3().setFromObject(this.root);
		const size = new THREE.Vector3();

		box.getSize(size);

		const footprintDiameter = Math.max(size.x, size.z);

		this.obstacle.radius = footprintDiameter * 0.46;
		this.obstacle.cameraRadius = footprintDiameter * 0.58;
		this.obstacle.height = size.y;
	}
}
