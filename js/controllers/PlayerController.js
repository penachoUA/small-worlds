import { PLAYER_STATES } from "../entities/Player.js";

export default class PlayerController {
	constructor({ player, input }) {
		this.player = player;
		this.input = input;
	}

	update() {
		const isShift = this.input.isPressed('ShiftLeft') || this.input.isPressed('ShiftRight');
		const isForward = this.input.isPressed('KeyW') || this.input.isPressed('ArrowUp');
		const isBack = this.input.isPressed('KeyS') || this.input.isPressed('ArrowDown');

		if (isForward || isBack) {
			this.player.setState(isShift ? PLAYER_STATES.RUNNING : PLAYER_STATES.WALKING);
			this.player.move(isForward ? 1 : -1);
		}

		if (this.input.isPressed('KeyA') || this.input.isPressed('ArrowLeft')) this.player.turn(1);
		if (this.input.isPressed('KeyD') || this.input.isPressed('ArrowRight')) this.player.turn(-1);
	}
}

