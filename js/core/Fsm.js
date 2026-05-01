export class StateMachine {
	constructor(owner) {
		this.owner = owner;
		this.current = null;
		this.states = {};
	}

	add(name, type) {
		this.states[name] = type;
	}

	set(name) {
		const prev = this.current;

		if (prev) {
			if (prev.name === name) return;
			prev.exit();
		}

		const state = new this.states[name](this);

		this.current = state;
		state.enter(prev);
	}

	update(delta, input) {
		if (this.current) this.current.update(delta, input);
	}
}

export class State {
	constructor(parent) {
		this.parent = parent;
	}

	enter() { };
	exit() { };
	update() { };
}
