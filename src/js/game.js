class StateManager {
	constructor(game) {
		this.game = game;
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
		this.states[id].onInit(this.game);
		this.stack.push(this.states[id]);
	}

	popState() {
		if (this.stack.length === 1) {
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

class EventBus {
	constructor() {
		this.handlers = {};
	}

	publish(eventType, event) {
		if (eventType in this.handlers) {
			this.handlers[eventType].forEach(handler => setTimeout(() => handler(event), 0));
		}
	}

	subscribe(eventType, handler) {
		if (this.handlers[eventType]) {
			this.handlers[eventType].push(handler);
		} else {
			this.handlers[eventType] = [handler];
		}

	}
}

class State {
	onInit(game) {
	}

	onDisable() {
	}

	onPause() {
	}

	onResume() {
	}

	update(dt) {
	}

	draw(ctx) {
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
		this.speedup = 1;
	}

	onInit(game) {
		this.game = game;
		this.popped = 0;
		this.balloons = [];
		this.spawnCountdown = 0;

		this.game.eventbus.subscribe('balloonpopped', balloon => {
			this.popped++;
			if (balloon.type === 'speedup') {
				this.speedup += 0.4;
				this.game.eventbus.publish('speedup', this.speedup);
				setTimeout(() => {
					this.speedup -= 0.4;
					this.game.eventbus.publish('speedup', this.speedup);
				}, 5000);
			} else if(balloon.type === 'bomb') {
				this.balloons.forEach(balloon2 => {
					if(balloon2 !== balloon && !balloon2.popping)
						balloon2.explode()
				});
				this.spawnCountdown += 2000;
			}
		})
	}

	update(dt) {
		this.spawnCountdown -= dt;
		if (this.spawnCountdown <= 0) {
			this.spawnCountdown = 1000 + (Math.random() * 500 - 250);

			const spawnProbability = Math.random();
			const color = this.colors[Math.floor(Math.random() * this.colors.length)];
			let balloon = null;

			if (spawnProbability < 0.95) {
				balloon = new Balloon(color, this.game);
			} else if (spawnProbability < 0.98) {
				balloon = new SpeedupBalloon(color, this.game);
			} else {
				balloon = new BombBalloon(color, this.game);
			}

			this.balloons.push(balloon);
		}
		this.balloons.forEach(balloon => balloon.update(dt));
		this.balloons = this.balloons.filter(balloon => !balloon.canRemove());
	}

	draw(ctx) {
		this.balloons.forEach(balloon => balloon.draw(ctx));
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
					const boundingRect = this.game.canvas.getBoundingClientRect();
					return {
						x: touch.pageX - boundingRect.left,
						y: touch.pageY - boundingRect.top
					};
				}).filter(touch => {
					return touch.x > 0 && touch.x < this.game.canvas.width && touch.y > 0 && touch.y < this.game.canvas.height;
				}).forEach(touch => {
					this.balloons.filter(balloon => balloon.checkHit(touch)).forEach(balloon => {
						balloon.explode();
					});
				});
				break;
			case 'click':
				this.balloons.filter(balloon => {
					const boundingRect = this.game.canvas.getBoundingClientRect();
					const point = {
						x: event.pageX - boundingRect.left,
						y: event.pageY - boundingRect.top
					};
					return balloon.checkHit(point);
				}).forEach(balloon => {
					balloon.explode();
				});
				break;
		}
	}
}

class Balloon {
	constructor(color, game) {
		this.type = 'normal';
		this.game = game;
		this.canvasSize = {
			x: game.canvas.width,
			y: game.canvas.height
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
			y: -65 + (Math.random() * 32 - 8)
		};

		//this.pos = {x:100,y:100}; this.vel={x:0,y:0};
		//console.log(this.vel);
		this.popping = false;
		this.poppingTimer = 0.07;
		this.poppingRate = {x: 100, y: 100};
		this.speedupfactor = 1;

		this.game.eventbus.subscribe('speedup', factor => this.speedupfactor = factor);
	}

	update(dt) {
		//console.log(this.pos.x, this.pos.y);
		//console.log(this.popping);
		if (this.pos.x + this.size.x > this.canvasSize.x || this.pos.x - this.size.x < 0) {
			this.vel.x = -this.vel.x;
		}

		//console.log('update balloon', this);
		this.pos.y += this.speedupfactor * this.vel.y * (dt / 1000);
		this.pos.x += this.speedupfactor * this.vel.x * (dt / 1000);

		if (this.popping && this.poppingTimer > 0) {
			this.poppingTimer -= dt / 1000;
			this.size.x += this.poppingRate.x * (dt / 1000);
			this.size.y += this.poppingRate.y * (dt / 1000);
			this.vel = {x: 0, y: 0};
		}

	}

	draw(ctx, canvas) {
		if (this.canRemove()) { // don't draw if we should be gone already
			return;
		}

		const x = this.pos.x;
		const y = Math.floor(this.pos.y);
		const sx = this.size.x;
		const sy = Math.floor(this.size.y);

		ctx.beginPath();
		ctx.fillStyle = this.color;
		ctx.strokeStyle = '#FFF';
		ctx.lineWidth = 3;
		ctx.ellipse(x, y, sx, sy, 0, 0, 2 * Math.PI);
		ctx.stroke();
		ctx.moveTo(x, y + sy - 3);
		ctx.lineTo(x - 7, y + sy + 7);
		ctx.lineTo(x + 7, y + sy + 7);
		ctx.lineWidth = 1;
		ctx.stroke();
		ctx.fill();
		ctx.closePath();
	}

	checkHit(point) {
		return ((point.x - this.pos.x) * (point.x - this.pos.x)) /
			((this.size.x + 5) * (this.size.x + 5)) +
			((point.y - this.pos.y) * (point.y - this.pos.y)) /
			((this.size.y + 5) * (this.size.y + 5)) <= 1;
	}

	explode() {
		this.popping = true;
		this.game.eventbus.publish('balloonpopped', this);
	}

	canRemove() {
		return this.popping && this.poppingTimer < 0 || this.pos.y + this.size.y + 7 < 0;
	}
}

class SpeedupBalloon extends Balloon {
	constructor() {
		super(...arguments);
		this.type = 'speedup';
		this.vel.y -= 30;
	}

	draw(ctx, game) {
		super.draw(ctx, game);
		ctx.beginPath();
		ctx.moveTo(this.pos.x - 10, this.pos.y - 10);
		ctx.lineTo(this.pos.x, this.pos.y);
		ctx.lineTo(this.pos.x - 10, this.pos.y + 10);

		ctx.moveTo(this.pos.x, this.pos.y - 10);
		ctx.lineTo(this.pos.x + 10, this.pos.y);
		ctx.lineTo(this.pos.x, this.pos.y + 10);
		ctx.strokeStyle = 'white';
		ctx.lineWidth = 5;
		ctx.stroke();
		ctx.closePath();
	}

}

class BombBalloon extends Balloon {
	constructor(color, game) {
		super(color, game);
		this.type = 'bomb';
		this.poppingRate = {x: 2000, y: 2500};
		this.poppingTimer = 0.45;
	}

	draw(ctx) {
		super.draw(ctx);

		const bombRadius = this.size.x - 20;
		const fuseEnd = {x: this.pos.x + this.size.x - 20, y: this.pos.y - this.size.y + 15};

		ctx.beginPath();
		ctx.arc(this.pos.x, this.pos.y, bombRadius, 0, 2 * Math.PI);
		ctx.fillStyle = 'white';
		ctx.moveTo(this.pos.x, this.pos.y - bombRadius);
		ctx.lineTo(fuseEnd.x, fuseEnd.y);
		ctx.lineWidth = 5;
		ctx.fill();
		ctx.stroke();
		ctx.closePath();
	}
}

class Game {
	constructor(canvas) {
		this.lastTimestamp = null;
		this.canvas = canvas;

		this.canvas.addEventListener('touchstart', (touchevent) => {
			touchevent.preventDefault();
			this.stateManager.notifyTop('touchstart', touchevent);
		});
		this.canvas.addEventListener('click', mouseevent => {
			mouseevent.preventDefault();
			this.stateManager.notifyTop('click', mouseevent);
		});

		this.eventbus = new EventBus();

		this.stateManager = new StateManager(this);
		this.stateManager.registerState('balloon', new BalloonState());
		this.stateManager.pushState('balloon');
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
	canvas.width = Math.min(window.innerWidth, 500);
	canvas.style.width = Math.min(window.innerWidth, 500) + 'px';
	canvas.id = 'canvas';
	document.getElementsByClassName('canvas-wrapper')[0].appendChild(canvas);
	document.getElementsByClassName('canvas-wrapper')[0].style.height = window.innerHeight;

	let game = new Game(canvas);

	const draw = (timestamp) => {
		game.update(timestamp);
		game.draw();
		requestAnimationFrame(draw);
	};
	setTimeout(() => requestAnimationFrame(draw), 1500);
})();