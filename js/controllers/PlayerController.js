export default class PlayerController {
	constructor({ player, input }) {
		this.player = player;
		this.input = input;
		this.lastInput = null;
	}

	update(delta) {
		const input = {
			forward: this.input.isPressed('KeyW') || this.input.isPressed('ArrowUp'),
			backward: this.input.isPressed('KeyS') || this.input.isPressed('ArrowDown'),
			left: this.input.isPressed('KeyA') || this.input.isPressed('ArrowLeft'),
			right: this.input.isPressed('KeyD') || this.input.isPressed('ArrowRight'),
			shift: this.input.isPressed('ShiftLeft') || this.input.isPressed('ShiftRight'),
			jump: this.input.isTapped('Space'),
		};
		this.player.update(delta, input);
	}
}
