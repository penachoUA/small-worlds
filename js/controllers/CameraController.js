const DEFAULTS = {
	YAW: 0,
	PITCH: -0.6,
	SENSITIVITY: 0.002,
	MIN_PITCH: -1.5,
	MAX_PITCH: 0.3,
	CENTERING_SPEED: 0.03,
	CENTERING_THRESHOLD: 0.001,
};

function shortestAngleDelta(from, to) {
	return Math.atan2(
		Math.sin(to - from),
		Math.cos(to - from)
	);
}

function normalizeAngle(angle) {
	return Math.atan2(
		Math.sin(angle),
		Math.cos(angle)
	);
}

export default class CameraController {
	constructor({ cameraRig, input, config = {} }) {
		this.cameraRig = cameraRig;
		this.input = input;

		this.defaultYaw = config.yaw ?? DEFAULTS.YAW;
		this.defaultPitch = config.pitch ?? DEFAULTS.PITCH;
		this.sensitivity = config.sensitivity ?? DEFAULTS.SENSITIVITY;
		this.minPitch = config.minPitch ?? DEFAULTS.MIN_PITCH;
		this.maxPitch = config.maxPitch ?? DEFAULTS.MAX_PITCH;

		this.currentYaw = this.defaultYaw;
		this.currentPitch = this.defaultPitch;

		this.unconstrained = config.unconstrained ?? false;
		this.autoCenterEnabled = config.autoCenter ?? false;
		this.isCentering = false;
	}

	resetState() {
		this.currentYaw = this.defaultYaw;
		this.currentPitch = this.defaultPitch;
		this.isCentering = false;
	}

	reset() {
		this.resetState();
		this.cameraRig.snapRotation(this.currentYaw, this.currentPitch);
	}

	startAutoCenter() {
		if (!this.autoCenterEnabled) return;

		this._syncToRigShortestEquivalent();
		this.isCentering = true;
	}

	update(isTargetMoving = false) {
		const isDragging = this.input.mouse.isDown;

		if (isDragging) {
			this.isCentering = false;

			this.currentYaw -= this.input.mouse.moveX * this.sensitivity;
			this.currentPitch -= this.input.mouse.moveY * this.sensitivity;

			if (!this.unconstrained) {
				this.currentPitch = Math.max(
					this.minPitch,
					Math.min(this.maxPitch, this.currentPitch)
				);
			}
		}

		if (this.autoCenterEnabled) {
			if (!isDragging && isTargetMoving && !this.isCentering) {
				this.startAutoCenter();
			}

			if (this.isCentering) {
				this._autoCenter();
			}
		}

		this.cameraRig.setRotation(this.currentYaw, this.currentPitch);
	}

	_syncToRigShortestEquivalent() {
		this.currentYaw = normalizeAngle(this.cameraRig.yaw.rotation.y);
		this.currentPitch = normalizeAngle(this.cameraRig.pitch.rotation.x);

		this.cameraRig.snapRotation(this.currentYaw, this.currentPitch);
	}

	_autoCenter() {
		const yawDelta = shortestAngleDelta(
			this.currentYaw,
			this.defaultYaw
		);

		const pitchDelta = shortestAngleDelta(
			this.currentPitch,
			this.defaultPitch
		);

		this.currentYaw += yawDelta * DEFAULTS.CENTERING_SPEED;
		this.currentPitch += pitchDelta * DEFAULTS.CENTERING_SPEED;

		if (
			Math.abs(yawDelta) < DEFAULTS.CENTERING_THRESHOLD &&
			Math.abs(pitchDelta) < DEFAULTS.CENTERING_THRESHOLD
		) {
			this.currentYaw = normalizeAngle(this.defaultYaw);
			this.currentPitch = normalizeAngle(this.defaultPitch);
			this.isCentering = false;
		}
	}
}
