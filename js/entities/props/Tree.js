import * as THREE from 'three';
import gradientMap from '../shading.js';

const GEOMETRIES = {
	trunk: new THREE.CylinderGeometry(0.32, 0.5, 1, 6),
	cone: new THREE.ConeGeometry(0.5, 1, 7),
	leafBlob: new THREE.DodecahedronGeometry(1, 0),
};

const MATERIALS = new Map();

export default class Tree {
	constructor({
		height = 0.55,
		width = 0.35,

		trunkColor = 0x7a4a24,
		leafColor = 0x3fa34d,
		leafDarkColor = 0x267a3a,
		leafLightColor = 0x7acb5a,

		swaySpeed = 1.2,
		swayAmount = 0.025,
		phase = Math.random() * Math.PI * 2,
		variant = 'round'
	} = {}) {
		this.root = new THREE.Object3D();

		this.height = height;
		this.width = width;
		this.variant = variant;
		this.swaySpeed = swaySpeed;
		this.swayAmount = swayAmount;
		this.phase = phase;

		this.materials = this._createMaterials({
			trunkColor,
			leafColor,
			leafDarkColor,
			leafLightColor
		});

		this.obstacle = {
			radius: 0.00001,
			cameraRadius: 0.55,
			height
		};

		this._computeLayout();
		this._createModel();
	}

	addTo(parent) {
		parent.add(this.root);
		return this;
	}

	update(delta) {
		if (!this.canopyGroup) return;

		this.phase += delta * this.swaySpeed;

		const sway = Math.sin(this.phase) * this.swayAmount;
		this.canopyGroup.rotation.z = sway;
		this.canopyGroup.rotation.x = sway * 0.35;
	}

	_createMaterials({
		trunkColor,
		leafColor,
		leafDarkColor,
		leafLightColor
	}) {
		return {
			trunk: this._toon(trunkColor),
			leaf: this._toon(leafColor),
			leafDark: this._toon(leafDarkColor),
			leafLight: this._toon(leafLightColor)
		};
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

	_computeLayout() {
		const h = this.height;
		const w = this.width;

		this.layout = {
			trunk: {
				height: h * 0.58,
				width: w * 0.28,
				centerY: h * 0.29
			},
			canopy: {
				baseY: h * 0.58,
				roundCenterY: h * 0.71,
				pineCenterY: h * 0.68
			}
		};
	}

	_createModel() {
		this._createTrunk();
		this._createCanopy();
	}

	_mesh({
		geometry,
		material,
		position = [0, 0, 0],
		rotation = [0, 0, 0],
		scale = [1, 1, 1],
		parent = this.root
	}) {
		const mesh = new THREE.Mesh(geometry, material);

		mesh.position.set(...position);
		mesh.rotation.set(...rotation);
		mesh.scale.set(...scale);

		mesh.castShadow = true;
		mesh.receiveShadow = true;

		parent.add(mesh);
		return mesh;
	}

	_box({ size, material, position, rotation, parent }) {
		return this._mesh({
			geometry: GEOMETRIES.root,
			material,
			position,
			rotation,
			scale: size,
			parent
		});
	}

	_cylinder({ width, height, material, position, rotation, parent }) {
		return this._mesh({
			geometry: GEOMETRIES.trunk,
			material,
			position,
			rotation,
			scale: [width, height, width],
			parent
		});
	}

	_cone({ radius, height, material, position, rotation, parent }) {
		return this._mesh({
			geometry: GEOMETRIES.cone,
			material,
			position,
			rotation,
			scale: [radius * 2, height, radius * 2],
			parent
		});
	}

	_leafBlob({ radius, material, position, rotation, scale = [1, 1, 1] }) {
		return this._mesh({
			geometry: GEOMETRIES.leafBlob,
			material,
			position,
			rotation,
			scale: [
				radius * scale[0],
				radius * scale[1],
				radius * scale[2]
			],
			parent: this.canopyGroup
		});
	}

	_createTrunk() {
		const trunk = this.layout.trunk;

		this._cylinder({
			width: trunk.width,
			height: trunk.height,
			material: this.materials.trunk,
			position: [0, trunk.centerY, 0],
			rotation: [0, Math.PI / 6, 0]
		});
	}

	_createCanopy() {
		this.canopyGroup = new THREE.Object3D();

		if (this.variant === 'pine') {
			this.canopyGroup.position.y = this.layout.canopy.pineCenterY;
			this._createPineCanopy();
		} else {
			this.canopyGroup.position.y = this.layout.canopy.roundCenterY;
			this._createRoundCanopy();
		}

		this.root.add(this.canopyGroup);
	}

	_createRoundCanopy() {
		const w = this.width;
		const h = this.height;

		const clumps = [
			{
				radius: w * 0.38,
				material: this.materials.leaf,
				position: [0, 0, 0],
				scale: [1.15, 0.88, 1.05],
				rotation: [0.12, 0.4, -0.1]
			},
			{
				radius: w * 0.28,
				material: this.materials.leafDark,
				position: [-w * 0.22, -h * 0.04, w * 0.04],
				scale: [1.0, 0.84, 0.95],
				rotation: [-0.18, 1.1, 0.08]
			},
			{
				radius: w * 0.29,
				material: this.materials.leaf,
				position: [w * 0.21, -h * 0.025, -w * 0.04],
				scale: [0.92, 0.8, 1.08],
				rotation: [0.2, 2.4, 0.12]
			},
			{
				radius: w * 0.25,
				material: this.materials.leafLight,
				position: [-w * 0.02, h * 0.16, 0],
				scale: [0.88, 0.78, 0.9],
				rotation: [-0.1, 0.9, -0.16]
			},
			{
				radius: w * 0.20,
				material: this.materials.leafDark,
				position: [w * 0.05, h * 0.05, w * 0.18],
				scale: [0.85, 0.7, 0.82],
				rotation: [0.18, 1.7, 0.2]
			}
		];

		clumps.forEach((clump) => this._leafBlob(clump));
	}

	_createPineCanopy() {
		const w = this.width;
		const h = this.height;

		const layers = [
			{
				radius: w * 0.42,
				height: h * 0.36,
				y: -h * 0.06,
				material: this.materials.leafDark
			},
			{
				radius: w * 0.34,
				height: h * 0.32,
				y: h * 0.12,
				material: this.materials.leaf
			},
			{
				radius: w * 0.25,
				height: h * 0.28,
				y: h * 0.28,
				material: this.materials.leafLight
			}
		];

		layers.forEach((layer, index) => {
			this._cone({
				radius: layer.radius,
				height: layer.height,
				material: layer.material,
				position: [0, layer.y, 0],
				rotation: [0, index * 0.42, 0],
				parent: this.canopyGroup
			});
		});
	}
}
