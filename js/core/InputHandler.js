class InputHandler {
	constructor() {
		this.keys = {};
		this.previousKeys = {};
		this.mouse = {
			isDown: false,
			x: 0,
			y: 0,
			moveX: 0,
			moveY: 0,
			wasClicked: false,
			downX: 0,
			downY: 0,
			dragDistance: 0
		};

		this._initKeyboardInput();
		this._initMouseInput();
	}

	afterUpdate() {
		this.previousKeys = { ...this.keys };

		this.mouse.moveX = 0;
		this.mouse.moveY = 0;
		this.mouse.wasClicked = false;
	}

	isPressed(code) {
		return !!this.keys[code];
	}

	isTapped(code) {
		return !!this.keys[code] && !this.previousKeys[code];
	}

	_initKeyboardInput() {
		window.addEventListener('keydown', (event) => {
			this.keys[event.code] = true;
		});

		window.addEventListener('keyup', (event) => {
			this.keys[event.code] = false;
		});
	}

	_initMouseInput() {
		const clickDragThreshold = 6;

		window.addEventListener('pointerdown', (event) => {
			if (event.button !== 0) return;

			this.mouse.isDown = true;
			this.mouse.x = event.clientX;
			this.mouse.y = event.clientY;
			this.mouse.downX = event.clientX;
			this.mouse.downY = event.clientY;
			this.mouse.dragDistance = 0;
		});

		window.addEventListener('pointerup', (event) => {
			if (event.button !== 0) return;

			this.mouse.x = event.clientX;
			this.mouse.y = event.clientY;

			if (this.mouse.dragDistance < clickDragThreshold) {
				this.mouse.wasClicked = true;
			}

			this.mouse.isDown = false;
		});

		window.addEventListener('pointermove', (event) => {
			this.mouse.x = event.clientX;
			this.mouse.y = event.clientY;

			this.mouse.moveX = event.movementX;
			this.mouse.moveY = event.movementY;

			if (this.mouse.isDown) {
				this.mouse.dragDistance += Math.hypot(
					event.movementX,
					event.movementY
				);
			}
		});

		window.addEventListener('mouseleave', () => {
			this.mouse.isDown = false;
		});
	}
}

export default InputHandler;
