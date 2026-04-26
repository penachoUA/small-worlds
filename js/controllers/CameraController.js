const DEFAULTS = {
	YAW: 0,
	PITCH: -0.6,
	SENSITIVITY: 0.002,
	MIN_PITCH: -1.5,
	MAX_PITCH: 0.3,
	CENTERING_SPEED: 0.03,
	CENTERING_THRESHOLD: 0.001,
};

export default class CameraController {
	constructor({ cameraRig, input, config = {} }) {
		this.cameraRig = cameraRig;
		this.input = input;

		this.defaultPitch = config.pitch ?? DEFAULTS.PITCH;
		this.defaultYaw = config.yaw ?? DEFAULTS.YAW;
		this.sensitivity = config.sensitivity ?? DEFAULTS.SENSITIVITY;
		this.minPitch = config.minPitch ?? DEFAULTS.MIN_PITCH;
		this.maxPitch = config.maxPitch ?? DEFAULTS.MAX_PITCH;

		this.currentPitch = this.defaultPitch;
		this.currentYaw = this.defaultYaw;

		this.unconstrained = config.unconstrained ?? false;
		this.autoCenterEnabled = config.autoCenter ?? false;
		this.isCentering = false;
	}

	reset() {
		this.currentYaw = this.defaultYaw;
		this.currentPitch = this.defaultPitch;
		this.isCentering = false;
		this.cameraRig.snapRotation(this.currentYaw, this.currentPitch);
	}

	update(isTargetMoving = false) {
		const isDragging = this.input.mouse.isDown;

		if (isDragging) {
			this.isCentering = false;
			this.currentYaw -= this.input.mouse.moveX * this.sensitivity;
			this.currentPitch -= this.input.mouse.moveY * this.sensitivity;

			if (!this.unconstrained) {
				this.currentPitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.currentPitch));
			}
		}

		if (this.autoCenterEnabled) {
			if (!isDragging && isTargetMoving) {
				this.isCentering = true;
			}
			if (this.isCentering) this._autoCenter();
		}

		this.cameraRig.setRotation(this.currentYaw, this.currentPitch);
	}

	_autoCenter() {
		this.currentYaw += (this.defaultYaw - this.currentYaw) * DEFAULTS.CENTERING_SPEED;
		this.currentPitch += (this.defaultPitch - this.currentPitch) * DEFAULTS.CENTERING_SPEED;

		if (Math.abs(this.currentYaw - this.defaultYaw) < DEFAULTS.CENTERING_THRESHOLD &&
			Math.abs(this.currentPitch - this.defaultPitch) < DEFAULTS.CENTERING_THRESHOLD) {
			this.currentYaw = this.defaultYaw;
			this.currentPitch = this.defaultPitch;
			this.isCentering = false;
		}
	}
}

