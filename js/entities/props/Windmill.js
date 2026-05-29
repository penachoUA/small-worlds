import * as THREE from 'three';
import gradientMap from '../shading.js';

export default class Windmill {
	constructor({
		height = 1.7,
		width = 1.0,

		bodyColor = 0xd8c7a3,
		roofColor = 0xb33a3a,
		bladeColor = 0xf2e8c9,
		woodColor = 0x7a4a24,
		stoneColor = 0x9e8e7a,
		windowColor = 0x88ccee,

		spinSpeed = 3
	} = {}) {
		this.root = new THREE.Object3D();

		this.height = height;
		this.width = width;
		this.spinSpeed = spinSpeed;

		this.materials = this._createMaterials({
			bodyColor,
			roofColor,
			bladeColor,
			woodColor,
			stoneColor,
			windowColor
		});

		// Obstacle properties
		this.obstacle = {
			radius: width * 0.15,
			cameraRadius: width * 0.7,
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
		this.blades.rotation.z += delta * this.spinSpeed;
	}

	_createMaterials({
		bodyColor,
		roofColor,
		bladeColor,
		woodColor,
		stoneColor,
		windowColor
	}) {
		return {
			body: this._toon(bodyColor),
			roof: this._toon(roofColor),
			blade: this._toon(bladeColor),
			wood: this._toon(woodColor),
			stone: this._toon(stoneColor),
			window: this._toon(windowColor),
			darkWindow: this._toon(0x24506b),
			doorInset: this._toon(0x5a351b),
		};
	}

	_toon(color) {
		return new THREE.MeshToonMaterial({
			color,
			gradientMap
		});
	}

	_computeLayout() {
		const h = this.height;
		const w = this.width;

		const baseLowerHeight = h * 0.13;
		const baseMiddleHeight = h * 0.075;
		const baseUpperHeight = h * 0.05;

		const bodyBottomY = h * 0.20;
		const bodyHeight = h * 0.54;
		const bodyTopY = bodyBottomY + bodyHeight;

		const roofHeight = h * 0.22;
		const roofRimY = bodyTopY + h * 0.025;

		this.layout = {
			base: {
				lowerHeight: baseLowerHeight,
				middleHeight: baseMiddleHeight,
				upperHeight: baseUpperHeight,

				lowerY: baseLowerHeight * 0.15,
				middleY: h * 0.13,
				upperY: h * 0.19,

				lowerTopRadius: w * 0.45,
				lowerBottomRadius: w * 0.52,
				middleTopRadius: w * 0.40,
				middleBottomRadius: w * 0.46,
				upperTopRadius: w * 0.34,
				upperBottomRadius: w * 0.39,
			},

			body: {
				bottomY: bodyBottomY,
				centerY: bodyBottomY + bodyHeight / 2,
				topY: bodyTopY,
				height: bodyHeight,
				bottomRadius: w * 0.38,
				topRadius: w * 0.27,
			},

			roof: {
				rimY: roofRimY,
				centerY: roofRimY + roofHeight * 0.52,
				capY: roofRimY + roofHeight + h * 0.015,
				height: roofHeight,
				radius: w * 0.45,
			},

			blades: {
				hubY: bodyBottomY + bodyHeight * 0.78,
				radius: w * 0.52,
				hubRadius: w * 0.06,
				mountLength: w * 0.14,
			}
		};
	}

	_bodyRadiusAt(y) {
		const body = this.layout.body;

		const t = THREE.MathUtils.clamp(
			(y - body.bottomY) / body.height,
			0,
			1
		);

		return THREE.MathUtils.lerp(
			body.bottomRadius,
			body.topRadius,
			t
		);
	}

	_createModel() {
		this._createBase();
		this._createBody();
		this._createRoof();
		this._createDoor();
		this._createWindows();
		this._createBeams();
		this._createBladeAssembly();
	}

	_mesh(geometry, material, position = [0, 0, 0], rotation = [0, 0, 0]) {
		const mesh = new THREE.Mesh(geometry, material);

		mesh.position.set(...position);
		mesh.rotation.set(...rotation);

		mesh.castShadow = true;
		mesh.receiveShadow = true;

		return mesh;
	}

	_box(size, material, position, rotation) {
		return this._mesh(
			new THREE.BoxGeometry(...size),
			material,
			position,
			rotation
		);
	}

	_cylinder({
		radiusTop,
		radiusBottom = radiusTop,
		height,
		segments = 12,
		material,
		position = [0, 0, 0],
		rotation = [0, 0, 0]
	}) {
		return this._mesh(
			new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
			material,
			position,
			rotation
		);
	}

	_cone({
		radius,
		height,
		segments = 8,
		material,
		position = [0, 0, 0],
		rotation = [0, 0, 0]
	}) {
		return this._mesh(
			new THREE.ConeGeometry(radius, height, segments),
			material,
			position,
			rotation
		);
	}

	_sphere({
		radius,
		widthSegments = 8,
		heightSegments = 8,
		material,
		position = [0, 0, 0]
	}) {
		return this._mesh(
			new THREE.SphereGeometry(radius, widthSegments, heightSegments),
			material,
			position
		);
	}

	_add(mesh) {
		this.root.add(mesh);
		return mesh;
	}

	_createBase() {
		const base = this.layout.base;

		this._add(this._cylinder({
			radiusTop: base.lowerTopRadius,
			radiusBottom: base.lowerBottomRadius,
			height: base.lowerHeight,
			segments: 8,
			material: this.materials.stone,
			position: [0, base.lowerY, 0]
		}));

		this._add(this._cylinder({
			radiusTop: base.middleTopRadius,
			radiusBottom: base.middleBottomRadius,
			height: base.middleHeight,
			segments: 8,
			material: this.materials.stone,
			position: [0, base.middleY, 0]
		}));

		this._add(this._cylinder({
			radiusTop: base.upperTopRadius,
			radiusBottom: base.upperBottomRadius,
			height: base.upperHeight,
			segments: 8,
			material: this.materials.stone,
			position: [0, base.upperY, 0]
		}));
	}

	_createBody() {
		const body = this.layout.body;
		const h = this.height;

		this._add(this._cylinder({
			radiusTop: body.topRadius,
			radiusBottom: body.bottomRadius,
			height: body.height,
			segments: 6,
			material: this.materials.body,
			position: [0, body.centerY, 0],
			rotation: [0, Math.PI / 6, 0]
		}));

		this._add(this._cylinder({
			radiusTop: body.bottomRadius * 1.08,
			radiusBottom: body.bottomRadius * 1.12,
			height: h * 0.03,
			segments: 6,
			material: this.materials.wood,
			position: [0, body.bottomY + h * 0.02, 0],
			rotation: [0, Math.PI / 6, 0]
		}));

		this._add(this._cylinder({
			radiusTop: body.topRadius * 1.12,
			radiusBottom: body.topRadius * 1.16,
			height: h * 0.035,
			segments: 6,
			material: this.materials.wood,
			position: [0, body.topY, 0],
			rotation: [0, Math.PI / 6, 0]
		}));
	}

	_createRoof() {
		const roof = this.layout.roof;
		const h = this.height;

		this._add(this._cylinder({
			radiusTop: roof.radius * 0.98,
			radiusBottom: roof.radius,
			height: h * 0.035,
			segments: 6,
			material: this.materials.wood,
			position: [0, roof.rimY, 0],
			rotation: [0, Math.PI / 6, 0]
		}));

		this._add(this._cone({
			radius: roof.radius,
			height: roof.height,
			segments: 6,
			material: this.materials.roof,
			position: [0, roof.centerY, 0],
			rotation: [0, Math.PI / 6, 0]
		}));

		this._add(this._sphere({
			radius: this.width * 0.055,
			material: this.materials.roof,
			position: [0, roof.capY, 0]
		}));
	}

	_createDoor() {
		const body = this.layout.body;
		const h = this.height;
		const w = this.width;

		const doorWidth = w * 0.18;
		const doorRectHeight = h * 0.15;
		const doorY = body.bottomY + h * 0.035;
		const frontZ = this._bodyRadiusAt(body.bottomY + h * 0.12);

		this._add(this._archedPanel({
			width: doorWidth,
			rectHeight: doorRectHeight,
			material: this.materials.wood,
			position: [0, doorY, frontZ + 0.012]
		}));

		this._add(this._archedPanel({
			width: doorWidth * 0.66,
			rectHeight: doorRectHeight * 0.72,
			material: this.materials.doorInset,
			position: [0, doorY + h * 0.025, frontZ + 0.019]
		}));

		this._add(this._sphere({
			radius: w * 0.012,
			material: this.materials.roof,
			position: [
				doorWidth * 0.28,
				doorY + doorRectHeight * 0.42,
				frontZ + 0.03
			]
		}));
	}

	_archedPanel({ width, rectHeight, material, position }) {
		const radius = width / 2;
		const shape = new THREE.Shape();

		shape.moveTo(-width / 2, 0);
		shape.lineTo(width / 2, 0);
		shape.lineTo(width / 2, rectHeight);

		shape.absarc(
			0,
			rectHeight,
			radius,
			0,
			Math.PI,
			false
		);

		shape.lineTo(-width / 2, 0);

		return this._mesh(
			new THREE.ShapeGeometry(shape),
			material,
			position
		);
	}

	_createWindows() {
		const body = this.layout.body;
		const h = this.height;
		const w = this.width;

		const frontWindowY = body.bottomY + body.height * 0.58;
		const frontWindowZ = this._bodyRadiusAt(frontWindowY);

		this._add(this._cylinder({
			radiusTop: w * 0.085,
			height: w * 0.012,
			segments: 16,
			material: this.materials.wood,
			position: [0, frontWindowY, frontWindowZ + 0.012],
			rotation: [Math.PI / 2, 0, 0]
		}));

		this._add(this._cylinder({
			radiusTop: w * 0.058,
			height: w * 0.014,
			segments: 16,
			material: this.materials.window,
			position: [0, frontWindowY, frontWindowZ + 0.021],
			rotation: [Math.PI / 2, 0, 0]
		}));

		this._add(this._box(
			[w * 0.012, h * 0.065, w * 0.006],
			this.materials.wood,
			[0, frontWindowY, frontWindowZ + 0.031]
		));

		this._add(this._box(
			[w * 0.11, h * 0.008, w * 0.006],
			this.materials.wood,
			[0, frontWindowY, frontWindowZ + 0.032]
		));

		const sideWindowY = body.bottomY + body.height * 0.45;

		this._add(this._box(
			[w * 0.095, h * 0.065, w * 0.01],
			this.materials.darkWindow,
			[-w * 0.245, sideWindowY, w * 0.105],
			[0, -Math.PI / 3, 0]
		));

		this._add(this._box(
			[w * 0.095, h * 0.065, w * 0.01],
			this.materials.darkWindow,
			[w * 0.245, sideWindowY, w * 0.105],
			[0, Math.PI / 3, 0]
		));
	}

	_createBeams() {
		const h = this.height;
		const w = this.width;
		const y = this.layout.body.bottomY + this.layout.body.height * 0.47;

		const beams = [
			{ x: -w * 0.18, z: w * 0.31, rotZ: 0.18 },
			{ x: w * 0.18, z: w * 0.31, rotZ: -0.18 },
		];

		beams.forEach(({ x, z, rotZ }) => {
			this._add(this._box(
				[w * 0.045, h * 0.50, w * 0.045],
				this.materials.wood,
				[x, y, z],
				[0, 0, rotZ]
			));
		});
	}

	_createBladeAssembly() {
		const blade = this.layout.blades;
		const hubY = blade.hubY;
		const wallZ = this._bodyRadiusAt(hubY);

		const hubGroup = new THREE.Object3D();

		hubGroup.position.set(
			0,
			hubY,
			wallZ + blade.mountLength / 2
		);

		const rearMount = this._cylinder({
			radiusTop: this.width * 0.075,
			height: blade.mountLength,
			segments: 12,
			material: this.materials.wood,
			rotation: [Math.PI / 2, 0, 0]
		});

		hubGroup.add(rearMount);

		this.blades = new THREE.Object3D();
		this.blades.position.set(
			0,
			0,
			blade.mountLength / 2 + this.width * 0.02
		);

		for (let i = 0; i < 4; i++) {
			const bladePart = this._createBlade();
			bladePart.rotation.z = i * Math.PI / 2;
			this.blades.add(bladePart);
		}

		const hub = this._cylinder({
			radiusTop: blade.hubRadius,
			height: this.width * 0.07,
			segments: 12,
			material: this.materials.wood,
			position: [0, 0, this.width * 0.035],
			rotation: [Math.PI / 2, 0, 0]
		});

		const nose = this._sphere({
			radius: this.width * 0.055,
			widthSegments: 10,
			heightSegments: 10,
			material: this.materials.roof,
			position: [0, 0, this.width * 0.085]
		});

		this.blades.add(hub);
		this.blades.add(nose);

		hubGroup.add(this.blades);
		this.root.add(hubGroup);
	}

	_createBlade() {
		const h = this.height;
		const w = this.width;
		const bladeRadius = this.layout.blades.radius;

		const bladeGroup = new THREE.Object3D();

		bladeGroup.add(this._box(
			[w * 0.035, bladeRadius, w * 0.025],
			this.materials.wood,
			[0, bladeRadius * 0.5, 0]
		));

		const sail = this._box(
			[w * 0.13, h * 0.15, w * 0.018],
			this.materials.blade,
			[w * 0.045, bladeRadius * 0.86, w * 0.004],
			[0, 0, -0.12]
		);

		bladeGroup.add(sail);

		bladeGroup.add(this._box(
			[w * 0.16, w * 0.025, w * 0.022],
			this.materials.wood,
			[w * 0.04, bladeRadius * 0.70, w * 0.012]
		));

		return bladeGroup;
	}
}
