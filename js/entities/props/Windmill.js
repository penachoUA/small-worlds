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

		this.materials = {
			body: new THREE.MeshToonMaterial({ color: bodyColor, gradientMap }),
			roof: new THREE.MeshToonMaterial({ color: roofColor, gradientMap }),
			blade: new THREE.MeshToonMaterial({ color: bladeColor, gradientMap }),
			wood: new THREE.MeshToonMaterial({ color: woodColor, gradientMap }),
			stone: new THREE.MeshToonMaterial({ color: stoneColor, gradientMap }),
			window: new THREE.MeshToonMaterial({ color: windowColor, gradientMap }),
			darkWindow: new THREE.MeshToonMaterial({ color: 0x24506b, gradientMap }),
			doorInset: new THREE.MeshToonMaterial({ color: 0x5a351b, gradientMap }),
		};

		this._createModel();
	}

	addTo(parent) {
		parent.add(this.root);
		return this;
	}

	update(delta) {
		if (this.blades) {
			this.blades.rotation.z += delta * this.spinSpeed;
		}
	}

	_createModel() {
		this._computeLayout();

		this._createBase();
		this._createBody();
		this._createRoof();
		this._createDoor();
		this._createWindows();
		this._createBeams();
		this._createBladeAssembly();
	}

	_computeLayout() {
		const h = this.height;
		const w = this.width;

		this.layout = {
			baseLowerHeight: h * 0.13,
			baseMiddleHeight: h * 0.075,
			baseUpperHeight: h * 0.05,

			baseLowerRadiusBottom: w * 0.52,
			baseLowerRadiusTop: w * 0.45,
			baseMiddleRadiusBottom: w * 0.46,
			baseMiddleRadiusTop: w * 0.40,
			baseUpperRadiusBottom: w * 0.39,
			baseUpperRadiusTop: w * 0.34,

			bodyBottomY: h * 0.20,
			bodyHeight: h * 0.54,
			bodyBottomRadius: w * 0.38,
			bodyTopRadius: w * 0.27,

			roofHeight: h * 0.22,
			roofRadius: w * 0.45,

			bladeRadius: w * 0.52,
			bladeHubRadius: w * 0.06,
			mountLength: w * 0.14,
		};

		this.layout.bodyCenterY =
			this.layout.bodyBottomY + this.layout.bodyHeight / 2;

		this.layout.bodyTopY =
			this.layout.bodyBottomY + this.layout.bodyHeight;

		this.layout.roofRimY =
			this.layout.bodyTopY + h * 0.025;

		this.layout.roofCenterY =
			this.layout.roofRimY + this.layout.roofHeight * 0.52;

		this.layout.roofCapY =
			this.layout.roofRimY + this.layout.roofHeight;

		this.layout.hubY =
			this.layout.bodyBottomY + this.layout.bodyHeight * 0.78;
	}

	_bodyRadiusAt(y) {
		const l = this.layout;

		const t = THREE.MathUtils.clamp(
			(y - l.bodyBottomY) / l.bodyHeight,
			0,
			1
		);

		return THREE.MathUtils.lerp(
			l.bodyBottomRadius,
			l.bodyTopRadius,
			t
		);
	}

	_createMesh(geometry, material, position = new THREE.Vector3()) {
		const mesh = new THREE.Mesh(geometry, material);
		mesh.position.copy(position);
		mesh.castShadow = true;
		mesh.receiveShadow = true;
		return mesh;
	}

	_createBase() {
		const l = this.layout;

		/*
			The lower base extends a little below y = 0.
			This gives Planet.addToSurface(..., sinkFactor) something safe to bury.
		*/
		const lowerBase = this._createMesh(
			new THREE.CylinderGeometry(
				l.baseLowerRadiusTop,
				l.baseLowerRadiusBottom,
				l.baseLowerHeight,
				8
			),
			this.materials.stone,
			new THREE.Vector3(0, l.baseLowerHeight * 0.15, 0)
		);

		this.root.add(lowerBase);

		const middleBase = this._createMesh(
			new THREE.CylinderGeometry(
				l.baseMiddleRadiusTop,
				l.baseMiddleRadiusBottom,
				l.baseMiddleHeight,
				8
			),
			this.materials.stone,
			new THREE.Vector3(0, this.height * 0.13, 0)
		);

		this.root.add(middleBase);

		const upperBase = this._createMesh(
			new THREE.CylinderGeometry(
				l.baseUpperRadiusTop,
				l.baseUpperRadiusBottom,
				l.baseUpperHeight,
				8
			),
			this.materials.stone,
			new THREE.Vector3(0, this.height * 0.19, 0)
		);

		this.root.add(upperBase);
	}

	_createBody() {
		const l = this.layout;

		const body = this._createMesh(
			new THREE.CylinderGeometry(
				l.bodyTopRadius,
				l.bodyBottomRadius,
				l.bodyHeight,
				6
			),
			this.materials.body,
			new THREE.Vector3(0, l.bodyCenterY, 0)
		);

		body.rotation.y = Math.PI / 6;
		this.root.add(body);

		const bottomTrim = this._createMesh(
			new THREE.CylinderGeometry(
				l.bodyBottomRadius * 1.08,
				l.bodyBottomRadius * 1.12,
				this.height * 0.03,
				6
			),
			this.materials.wood,
			new THREE.Vector3(0, l.bodyBottomY + this.height * 0.02, 0)
		);

		bottomTrim.rotation.y = Math.PI / 6;
		this.root.add(bottomTrim);

		const topTrim = this._createMesh(
			new THREE.CylinderGeometry(
				l.bodyTopRadius * 1.12,
				l.bodyTopRadius * 1.16,
				this.height * 0.035,
				6
			),
			this.materials.wood,
			new THREE.Vector3(0, l.bodyTopY, 0)
		);

		topTrim.rotation.y = Math.PI / 6;
		this.root.add(topTrim);
	}

	_createRoof() {
		const l = this.layout;

		const roofRim = this._createMesh(
			new THREE.CylinderGeometry(
				l.roofRadius * 0.98,
				l.roofRadius,
				this.height * 0.035,
				6
			),
			this.materials.wood,
			new THREE.Vector3(0, l.roofRimY, 0)
		);

		roofRim.rotation.y = Math.PI / 6;
		this.root.add(roofRim);

		const roof = this._createMesh(
			new THREE.ConeGeometry(
				l.roofRadius,
				l.roofHeight,
				6
			),
			this.materials.roof,
			new THREE.Vector3(0, l.roofCenterY, 0)
		);

		roof.rotation.y = Math.PI / 6;
		this.root.add(roof);

		const roofCap = this._createMesh(
			new THREE.SphereGeometry(this.width * 0.055, 8, 8),
			this.materials.roof,
			new THREE.Vector3(0, l.roofCapY + this.height * 0.015, 0)
		);

		this.root.add(roofCap);
	}

	_createDoor() {
		const l = this.layout;

		const doorWidth = this.width * 0.18;
		const doorRectHeight = this.height * 0.15;
		const doorRadius = doorWidth / 2;

		const doorY = l.bodyBottomY + this.height * 0.035;
		const doorCenterY = doorY;
		const frontZ = this._bodyRadiusAt(l.bodyBottomY + this.height * 0.12);

		const doorShape = this._createArchedShape(
			doorWidth,
			doorRectHeight,
			doorRadius
		);

		const door = this._createMesh(
			new THREE.ShapeGeometry(doorShape),
			this.materials.wood,
			new THREE.Vector3(0, doorCenterY, frontZ + 0.012)
		);

		this.root.add(door);

		const insetWidth = doorWidth * 0.66;
		const insetRectHeight = doorRectHeight * 0.72;
		const insetRadius = insetWidth / 2;

		const insetShape = this._createArchedShape(
			insetWidth,
			insetRectHeight,
			insetRadius
		);

		const inset = this._createMesh(
			new THREE.ShapeGeometry(insetShape),
			this.materials.doorInset,
			new THREE.Vector3(0, doorCenterY + this.height * 0.025, frontZ + 0.019)
		);

		this.root.add(inset);

		const knob = this._createMesh(
			new THREE.SphereGeometry(this.width * 0.012, 8, 8),
			this.materials.roof,
			new THREE.Vector3(
				doorWidth * 0.28,
				doorCenterY + doorRectHeight * 0.42,
				frontZ + 0.03
			)
		);

		this.root.add(knob);
	}

	_createArchedShape(width, rectHeight, radius) {
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

		return shape;
	}

	_createWindows() {
		const l = this.layout;

		const frontWindowY = l.bodyBottomY + l.bodyHeight * 0.58;
		const frontWindowZ = this._bodyRadiusAt(frontWindowY);

		const frameRadius = this.width * 0.085;
		const glassRadius = this.width * 0.058;

		const frontWindowFrame = this._createMesh(
			new THREE.CylinderGeometry(frameRadius, frameRadius, this.width * 0.012, 16),
			this.materials.wood,
			new THREE.Vector3(0, frontWindowY, frontWindowZ + 0.012)
		);

		frontWindowFrame.rotation.x = Math.PI / 2;
		this.root.add(frontWindowFrame);

		const frontWindowGlass = this._createMesh(
			new THREE.CylinderGeometry(glassRadius, glassRadius, this.width * 0.014, 16),
			this.materials.window,
			new THREE.Vector3(0, frontWindowY, frontWindowZ + 0.021)
		);

		frontWindowGlass.rotation.x = Math.PI / 2;
		this.root.add(frontWindowGlass);

		const verticalBar = this._createMesh(
			new THREE.BoxGeometry(this.width * 0.012, this.height * 0.065, this.width * 0.006),
			this.materials.wood,
			new THREE.Vector3(0, frontWindowY, frontWindowZ + 0.031)
		);

		this.root.add(verticalBar);

		const horizontalBar = this._createMesh(
			new THREE.BoxGeometry(this.width * 0.11, this.height * 0.008, this.width * 0.006),
			this.materials.wood,
			new THREE.Vector3(0, frontWindowY, frontWindowZ + 0.032)
		);

		this.root.add(horizontalBar);

		const sideWindowY = l.bodyBottomY + l.bodyHeight * 0.45;

		const leftWindow = this._createMesh(
			new THREE.BoxGeometry(this.width * 0.095, this.height * 0.065, this.width * 0.01),
			this.materials.darkWindow,
			new THREE.Vector3(-this.width * 0.245, sideWindowY, this.width * 0.105)
		);

		leftWindow.rotation.y = -Math.PI / 3;
		this.root.add(leftWindow);

		const rightWindow = this._createMesh(
			new THREE.BoxGeometry(this.width * 0.095, this.height * 0.065, this.width * 0.01),
			this.materials.darkWindow,
			new THREE.Vector3(this.width * 0.245, sideWindowY, this.width * 0.105)
		);

		rightWindow.rotation.y = Math.PI / 3;
		this.root.add(rightWindow);
	}

	_createBeams() {
		const beamY = this.layout.bodyBottomY + this.layout.bodyHeight * 0.47;

		const beamConfigs = [
			{ x: -this.width * 0.18, z: this.width * 0.31, rotZ: 0.18 },
			{ x: this.width * 0.18, z: this.width * 0.31, rotZ: -0.18 },
		];

		beamConfigs.forEach((config) => {
			const beam = this._createMesh(
				new THREE.BoxGeometry(
					this.width * 0.045,
					this.height * 0.50,
					this.width * 0.045
				),
				this.materials.wood,
				new THREE.Vector3(config.x, beamY, config.z)
			);

			beam.rotation.z = config.rotZ;
			this.root.add(beam);
		});
	}

	_createBladeAssembly() {
		const l = this.layout;

		const hubY = l.hubY;
		const wallZ = this._bodyRadiusAt(hubY);

		const hubGroup = new THREE.Object3D();

		/*
			Critical fix:
			The rear mount is centered so that its back end touches the wall.
			This prevents the blade mast from floating in front of the windmill.
		*/
		hubGroup.position.set(
			0,
			hubY,
			wallZ + l.mountLength / 2
		);

		const rearMount = this._createMesh(
			new THREE.CylinderGeometry(
				this.width * 0.075,
				this.width * 0.075,
				l.mountLength,
				12
			),
			this.materials.wood
		);

		rearMount.rotation.x = Math.PI / 2;
		hubGroup.add(rearMount);

		this.blades = new THREE.Object3D();
		this.blades.position.set(0, 0, l.mountLength / 2 + this.width * 0.02);

		for (let i = 0; i < 4; i++) {
			const blade = this._createBlade();
			blade.rotation.z = i * Math.PI / 2;
			this.blades.add(blade);
		}

		const hub = this._createMesh(
			new THREE.CylinderGeometry(
				l.bladeHubRadius,
				l.bladeHubRadius,
				this.width * 0.07,
				12
			),
			this.materials.wood,
			new THREE.Vector3(0, 0, this.width * 0.035)
		);

		hub.rotation.x = Math.PI / 2;
		this.blades.add(hub);

		const nose = this._createMesh(
			new THREE.SphereGeometry(this.width * 0.055, 10, 10),
			this.materials.roof,
			new THREE.Vector3(0, 0, this.width * 0.085)
		);

		this.blades.add(nose);

		hubGroup.add(this.blades);
		this.root.add(hubGroup);
	}

	_createBlade() {
		const bladeGroup = new THREE.Object3D();

		const armLength = this.layout.bladeRadius;
		const armWidth = this.width * 0.035;

		const arm = this._createMesh(
			new THREE.BoxGeometry(
				armWidth,
				armLength,
				this.width * 0.025
			),
			this.materials.wood,
			new THREE.Vector3(0, armLength * 0.5, 0)
		);

		bladeGroup.add(arm);

		const sail = this._createMesh(
			new THREE.BoxGeometry(
				this.width * 0.13,
				this.height * 0.15,
				this.width * 0.018
			),
			this.materials.blade,
			new THREE.Vector3(
				this.width * 0.045,
				armLength * 0.86,
				this.width * 0.004
			)
		);

		sail.rotation.z = -0.12;
		bladeGroup.add(sail);

		const crossBar = this._createMesh(
			new THREE.BoxGeometry(
				this.width * 0.16,
				this.width * 0.025,
				this.width * 0.022
			),
			this.materials.wood,
			new THREE.Vector3(
				this.width * 0.04,
				armLength * 0.70,
				this.width * 0.012
			)
		);

		bladeGroup.add(crossBar);

		return bladeGroup;
	}
}
