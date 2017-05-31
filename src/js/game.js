class StateManager {
	constructor(canvas) {
		this.canvas = canvas;
		this.states = {};
		this.stack = [];
	}

	registerState(id, state) {
		if (id in this.states) {
			throw new Error(`State ${id} already registererd`);
		}
		this.states[id] = state;
	}

	pushState(id) {
		if (this.stack.length !== 0) {
			this.stack[this.stack.length - 1].onPause();

		}
		this.states[id].onInit(this.canvas);
		this.stack.push(this.states[id]);
	}

	popState() {
		if(this.stack.length === 1) {
			throw new Error('No state below this');
		}
		this.stack[this.stack.length - 1].onDisable();
		this.stack.pop();
		this.stack[this.stack.length - 1].onResume();
	}

	update(dt) {
		this.stack.forEach(state => state.update(dt));
	}

	draw(ctx, canvas) {
		this.stack.forEach(state => state.draw(ctx, canvas));
	}

	notifyTop(eventType, event) {
		this.stack[this.stack.length - 1].handleEvent(eventType, event);
	}
}

class State {
	onInit(canvas) {
	}

	onDisable() {
	}

	onPause() {
	}

	onResume() {
	}

	update(dt) {
	}

	draw(ctx, canvas) {
	}

	handleEvent(eventType, event) {
	}
}

class BalloonState extends State {
	constructor() {
		super();
		this.spawnCountdown = 0;
		this.colors = [
			'#36F',
			'#F63',
			'#6F3',
			'#F60',
			'#F30',
			'#F66',
			'#9F0'
		];
		this.balloons = [];
		this.popped = 0;
	}

	onInit(canvas) {
		this.canvas = canvas;
		this.popped = 0;
		this.balloons = [];
		this.spawnCountdown = 0;
	}

	update(dt) {
		this.spawnCountdown -= dt;
		if (this.spawnCountdown <= 0) {
			this.spawnCountdown = 1000 + (Math.random() * 500 - 250);
			this.balloons.push(new Balloon(this.colors[Math.floor(Math.random() * this.colors.length)], this.canvas));
		}
		this.balloons.forEach(balloon => balloon.update(dt));
	}

	draw(ctx, canvas) {
		this.balloons.forEach(balloon => balloon.draw(ctx, canvas));
		ctx.font = '25px Arial';
		ctx.fillStyle = '#000';
		ctx.fillText('' + this.popped, 10, 35);
		//console.log('draw');
	}

	handleEvent(eventType, event) {
		let lenghtBefore = this.balloons.length;
		switch (eventType) {
			case 'touchstart':
				const points = Array.from(event.touches);
				points.map(touch => {
					const boundingRect = this.canvas.getBoundingClientRect();
					return {
						x: touch.pageX - boundingRect.left,
						y: touch.pageY - boundingRect.top
					};
				}).filter(touch => {
					return touch.x > 0 && touch.x < this.canvas.width && touch.y > 0 && touch.y < this.canvas.height;
				}).forEach(touch => {
					this.balloons = this.balloons.filter(balloon => !balloon.checkHit(touch));
				});
				break;
			case 'click':
				this.balloons = this.balloons.filter(balloon => {
					const boundingRect = this.canvas.getBoundingClientRect();
					const point = {
						x: event.pageX - boundingRect.left,
						y: event.pageY - boundingRect.top
					};
					return !balloon.checkHit(point);
				});
				break;
		}
		this.popped += lenghtBefore - this.balloons.length;
	}
}

class Balloon {
	constructor(color, canvas) {
		this.canvasSize = {
			x: canvas.width,
			y: canvas.height
		};
		this.size = {
			x: 35,
			y: 40
		};
		this.color = color;
		this.pos = {
			x: Math.random() * (this.canvasSize.x - 2 * this.size.x) + this.size.x,
			y: this.canvasSize.y + this.size.y
		};
		this.vel = {
			x: Math.random() * 16 - 8,
			y: -75 + (Math.random() * 16 - 8)
		};
	}

	update(dt) {
		//console.log(this.pos.x, this.pos.y);
		if (this.pos.x + this.size.x > this.canvasSize.x || this.pos.x - this.size.x < 0) {
			this.vel.x = -this.vel.x;
		}

		//console.log('update balloon', this);
		this.pos.y += this.vel.y * (dt / 1000);
		this.pos.x += this.vel.x * (dt / 1000);
	}

	draw(ctx, canvas) {
		//console.log('draw balloon', this);
		ctx.beginPath();
		ctx.fillStyle = this.color;
		ctx.strokeStyle = '#FFF';
		ctx.lineWidth = 3;
		ctx.ellipse(this.pos.x, this.pos.y, this.size.x, this.size.y, 0, 0, 2 * Math.PI);
		ctx.stroke();
		ctx.moveTo(this.pos.x, this.pos.y + this.size.y - 3);
		ctx.lineTo(this.pos.x - 7, this.pos.y + this.size.y + 7);
		ctx.lineTo(this.pos.x + 7, this.pos.y + this.size.y + 7);
		ctx.lineWidth = 1;
		ctx.stroke();
		ctx.fill();

		ctx.closePath();
		//ctx.fillRect(this.pos.x, this.pos.y, 100, 100);
	}

	checkHit(point) {
		return ((point.x - this.pos.x) * (point.x - this.pos.x)) /
						(this.size.x * this.size.x + 4) +
			((point.y - this.pos.y) * (point.y - this.pos.y)) /
						(this.size.y * this.size.y + 4) <= 1;
	}
}

class Game {
	constructor(canvas, stateManager) {
		this.lastTimestamp = null;
		this.stateManager = stateManager;
		this.canvas = canvas;

		this.canvas.addEventListener('touchstart', (touchevent) => {
			touchevent.preventDefault();
			this.stateManager.notifyTop('touchstart', touchevent);
		});
		this.canvas.addEventListener('click', mouseevent => {
			mouseevent.preventDefault();
			this.stateManager.notifyTop('click', mouseevent);
		});
	}

	update(timestamp) {
		if (!this.lastTimestamp) this.lastTimestamp = timestamp;
		const dt = timestamp - this.lastTimestamp;
		this.lastTimestamp = timestamp;
		//console.log('update', dt);
		this.stateManager.update(dt);
	}

	draw() {
		let context = this.canvas.getContext('2d');
		context.clearRect(0, 0, this.canvas.width, this.canvas.height);
		this.stateManager.draw(context, this.canvas);
	}
}

(function () {
	let canvas = document.createElement('canvas');
	canvas.height = window.innerHeight;
	canvas.width = 500;
	canvas.id = 'canvas';
	document.getElementsByClassName('canvas-wrapper')[0].appendChild(canvas);
	document.getElementsByClassName('canvas-wrapper')[0].style.height = window.innerHeight;


	let stateManager = new StateManager(canvas);
	stateManager.registerState('balloon', new BalloonState());
	stateManager.pushState('balloon');
	let game = new Game(canvas, stateManager);
	let faketime = 0;
	const draw = (timestamp) => {
		//console.log(timestamp);
		game.update(timestamp);
		game.draw();
		requestAnimationFrame(draw);
		//setTimeout(() => draw(faketime += 1./25), 1./25);
	};
	//setTimeout(() => draw(faketime += 1./25), 1./25);
	requestAnimationFrame(draw);
})();