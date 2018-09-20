var express = require('express');
var http = require('http');
var path = require('path');
var socketIO = require('socket.io');
var app = express();
var server = http.Server(app);
var io = socketIO(server);
var users = {};
var games = {};
var lobby = [];
var port = 5000;
var sellPercent = .7;
var maxQueue = 5;
var armorHalfReduction = 10;

app.set('port', port);
app.use('/static', express.static(__dirname + '/static'));

app.get('/', function(request, response) {
  response.sendFile(path.join(__dirname, 'index.html'));
});

server.listen(port, function() {
  console.log('Starting server on port ' + port);
});

class Path {
	constructor(vertices, next, prev) {
		this.vertices = vertices;
		this.lengths = [];
		this.distance = 0;
		this.next = next;
		this.prev = prev;
		this.send = 0;

		this.getDistanceAndLength();
	}

	getDistanceAndLength() {
		this.lengths = [];
		this.distance = 0;
		for (var i=1; i<this.vertices.length; i++) {
			var vertex = this.vertices[i];
			var prev = this.vertices[i-1];

			var dist = Math.sqrt((vertex.x - prev.x)*(vertex.x - prev.x) + (vertex.y - prev.y)*(vertex.y - prev.y));
			this.distance += (dist);
			this.lengths.push(dist);
		}
	}

	distanceToXY(dist) {
		var walker = 0;
		var start = 0;
		for (var i=0; i<this.lengths.length; i++) {
			start = walker;
			walker += this.lengths[i];
			if (dist < walker) {
				var vertex = this.vertices[i+1];
				var prev = this.vertices[i];

				return (new Point(prev.x + (vertex.x - prev.x) * ((dist - start) / (walker - start)), prev.y + (vertex.y - prev.y) * ((dist - start) / (walker - start))));
			}
		}

		return (new Point(this.vertices[this.vertices.length-1].x, this.vertices[this.vertices.length-1].y));
	}

	getNextPath(player) {
		if (this.next.length > 0) {
			this.send += 1;
			this.send = this.send % this.next.length;
			return this.next[this.send];
		} else {
			return null;
		}
	}
}

class Track {
	constructor(name, paths) {
		this.name = name;
		this.paths = paths;
	}
}

class Point {
	constructor(x, y) {
		this.x = x;
		this.y = y;
	}

	distanceTo(x, y) {
		return Math.sqrt((x - this.x)*(x - this.x) + (y - this.y)*(y - this.y));
	}
}

var tracks = "[\
	new Track(name='track0', paths=[\
		new Path(vertices=[new Point(0.5, -0.1), new Point(0.5, 0.2), new Point(0.2, 0.5), new Point(0.3, 0.6), new Point(0.7, 0.2), new Point(0.8, 0.3), new Point(0.5, 0.6), new Point(0.5, 1.1)], next=[], prev=[]),\
	]),\
	new Track(name='track1', paths=[\
		new Path(vertices=[new Point(0.5, -0.1), new Point(0.5, 0.2)], next=[1, 2], prev=[]),\
		new Path(vertices=[new Point(0.5, 0.2), new Point(0.75, 0.45), new Point(0.5, 0.7)], next=[3], prev=[0]),\
		new Path(vertices=[new Point(0.5, 0.2), new Point(0.25, 0.45), new Point(0.5, 0.7)], next=[3], prev=[0]),\
		new Path(vertices=[new Point(0.5, 0.7), new Point(0.5, 1.1)], next=[], prev=[1, 2])\
	]),\
	new Track(name='track2', paths=[\
		new Path(vertices=[new Point(-0.1, 0.8), new Point(0.1, 0.2), new Point(0.3, 0.8), new Point(0.5, 0.2), new Point(0.7, 0.8), new Point(0.9, 0.2), new Point(1.1, 0.8)], next=[], prev=[])\
	])\
]";

class Enemy {
	constructor(id, name, size, color, outline, speed, armor, maxhp, damage, owner, effect, gameID) {
		this.id = id;
		this.name = name;
		this.progress = 0;
		this.pathProgress = 0;
		this.gameID = gameID;
		this.owner = owner;
		this.path = 0;
		var location = games[this.gameID].players[this.owner].track.paths[0].distanceToXY(0);
		this.x = location.x;
		this.y = location.y;
		this.size = size;
		this.color = color;
		this.outline = outline;
		this.speed = speed;
		this.armor = armor;
		this.maxhp = maxhp;
		this.hp = this.maxhp;
		this.damage = damage;
		this.effect = effect;
		this.lastEffectTime = games[this.gameID].time;
		this.visible = true;
		games[this.gameID].enemyID += 1;
	}

	tick() {
		var game = games[this.gameID];
		var player = game.players[this.owner];
		var currPath = player.track.paths[this.path];
		if (this.effect != null && game.time - this.lastEffectTime > this.effect.cd) {
			this.effect.effect(this);
			this.lastEffectTime = game.time;
		}

		this.pathProgress += this.speed;
		this.progress += this.speed;

		if (this.pathProgress < currPath.distance) {
			var location = currPath.distanceToXY(this.pathProgress);
			this.x = location.x;
			this.y = location.y;
		} else {
			var nextPath = currPath.getNextPath(this.owner);
			if (nextPath != null) {
				this.path = nextPath;
				this.pathProgress -= currPath.distance;
				var location = player.track.paths[nextPath].distanceToXY(this.pathProgress);
				this.x = location.x;
				this.y = location.y;
			} else {
				for (var i=0; i<player.enemies.length; i++) {
					if (player.enemies[i] == this) {
						player.lives -= this.damage;
						player.enemies.splice(i, 1);
						break;
					}
				}
			}
		}
	}

	takeDamage(damage, pierce) {
		this.hp -= damage * (1-((1-pierce)*(this.armor/(this.armor + armorHalfReduction))));

		if (this.hp <= 0) {
			this.death();
			return;
		}
	}

	death() {
		for (var i=0; i<games[this.gameID].players[this.owner].enemies.length; i++) {
			if (games[this.gameID].players[this.owner].enemies[i] == this) {
				games[this.gameID].players[this.owner].enemies.splice(i, 1);
				break;
			}
		}
	}
}

class Satyr extends Enemy {
	constructor(id, owner, gameID) {
		super(id, 'Satyr', 0.01, 'red', 'red', 0.002, 0, 1, 1, owner, null, gameID);
	}
}

class Pan extends Enemy {
	constructor(id, owner, gameID) {
		super(id, 'Pan', 0.015, 'pink', 'red', 0.0045, 1, 2, 2, owner, {effect: function(me) {var tempEnemy = new Satyr(games[me.gameID].enemyID, me.owner, me.gameID); tempEnemy.path = me.path; tempEnemy.pathProgress = me.pathProgress; tempEnemy.progress = me.progress; games[me.gameID].players[me.owner].enemies.push(tempEnemy);}, cd: 2000}, gameID);
	}
}

class Centaur extends Enemy {
	constructor(id, owner, gameID) {
		super(id, 'Centaur', 0.017, 'blue', 'blue', 0.0035, 0, 2, 2, owner, null, gameID);
	}
}

class Chiron extends Enemy {
	constructor(id, owner, gameID) {
		super(id, 'Chiron', 0.025, 'purple', 'blue', 0.003, 5, 5, 5, owner, {effect: function(me) {me.hp = Math.min(me.hp + 0.2, me.maxhp);}, cd: 95}, gameID);
	}
}

class Harpy extends Enemy {
	constructor(id, owner, gameID) {
		super(id, 'Harpy', 0.013, 'black', 'black', 0.006, 1, 4, 10, owner, null, gameID);
	}
}

class Ocypete extends Enemy {
	constructor(id, owner, gameID) {
		super(id, 'Ocypete', 0.013, 'gray', 'black', 0.008, 1, 4, 12, owner, {effect: function(me) {me.speed = 0.006; me.color = 'gray';}, cd: 1000}, gameID);
		this['hit'] = false;
	}

	takeDamage(damage, pierce) {
		this.hp -= damage * (1-((1-pierce)*(this.armor/(this.armor + armorHalfReduction))));

		if (this.hp <= 0) {
			this.death();
			return;
		}

		if (this.hit == false) {
			this.hit = true;
			this.speed = 0.015;
			this.color = 'red';
			this.lastEffectTime = games[this.gameID].time;
		}
	}
}

class Pterippus extends Enemy {
	constructor(id, owner, gameID) {
		super(id, 'Pterippus', 0.011, 'white', 'black', 0.005, 0, 15, 7, owner, null, gameID);
	}
}

class PegasusandBellerophon extends Enemy {
	constructor(id, owner, gameID) {
		super(id, 'Pegasus and Bellerophon', 0.017, 'white', 'black', 0.004, 0, 50, 30, owner, null, gameID);
	}

	death() {
		var tempEnemy = new Bellerophon(games[this.gameID].enemyID, this.owner, this.gameID);
		tempEnemy.path = this.path;
		tempEnemy.pathProgress = this.pathProgress;
		tempEnemy.progress = this.progress;
		games[this.gameID].players[this.owner].enemies.push(tempEnemy);
		for (var i=0; i<games[this.gameID].players[this.owner].enemies.length; i++) {
			if (games[this.gameID].players[this.owner].enemies[i] == this) {
				games[this.gameID].players[this.owner].enemies.splice(i, 1);
				return;
			}
		}
	}
}

class Bellerophon extends Enemy {
	constructor(id, owner, gameID) {
		super(id, 'Bellerophon', 0.015, 'rgba(205, 127, 50, 1)', 'black', 0.0025, 10, 50, 20, owner, null, gameID);
	}
}

class Argonaut extends Enemy {
	constructor(id, owner, gameID) {
		super(id, 'Argonaut', 0.013, 'yellow', 'black', 0.0025, 20, 80, 20, owner, null, gameID);
	}
}

class Perseus extends Enemy {
	constructor(id, owner, gameID) {
		super(id, 'Perseus', 0.016, 'rgba(0, 124, 64, 0.6)', 'rgba(0, 60, 30, 0.7)', 0.004, 7, 50, 15, owner, null, gameID);
		this.visible = false;
	}
}

class Cyclops extends Enemy {
	constructor(id, owner, gameID) {
		super(id, 'Cyclops', 0.023, 'rgba(0, 124, 64, 0.6)', 'rgba(0, 60, 30, 0.7)', 0.002, 5, 200, 25, owner, null, gameID);
	}
}

class Theseus extends Enemy {
	constructor(id, owner, gameID) {
		super(id, 'Theseus', 0.017, 'rgba(0, 124, 64, 0.6)', 'rgba(0, 60, 30, 0.7)', 0.002, 15, 500, 50, owner, null, gameID);
	}
}

class Wave {
	constructor(enemy, number, timeBetween, timeAfter) {
		this.enemy = enemy;
		this.quantity = quantity;
		this.timeBetween = timeBetween;
		this.timeAfter = timeAfter;
	}
}

var waves = [
	[
	new Wave(enemy='Satyr', quantity=10, timeBetween=500, timeAfter=15000)
	],
	[
	new Wave(enemy='Satyr', quantity=10, timeBetween=250, timeAfter=500),
	new Wave(enemy='Centaur', quantity=10, timeBetween=400, timeAfter=10000)
	],
	[
	new Wave(enemy='Satyr', quantity=10, timeBetween=500, timeAfter=1000),
	new Wave(enemy='Centaur', quantity=20, timeBetween=400, timeAfter=10000)
	],
	[
	new Wave(enemy='Centaur', quantity=30, timeBetween=300, timeAfter=10000)
	],
	[
	new Wave(enemy='Centaur', quantity=10, timeBetween=50, timeAfter=10000)
	],
	[
	new Wave(enemy='Centaur', quantity=10, timeBetween=50, timeAfter=10000)
	],
	[
	new Wave(enemy='Centaur', quantity=10, timeBetween=50, timeAfter=10000)
	],
	[
	new Wave(enemy='Centaur', quantity=10, timeBetween=50, timeAfter=10000)
	],
	[
	new Wave(enemy='Centaur', quantity=10, timeBetween=50, timeAfter=10000)
	],
	[
	new Wave(enemy='Centaur', quantity=10, timeBetween=50, timeAfter=10000)
	],
	[
	new Wave(enemy='Centaur', quantity=10, timeBetween=50, timeAfter=10000)
	],
	[
	new Wave(enemy='Centaur', quantity=10, timeBetween=50, timeAfter=10000)
	],
	[
	new Wave(enemy='Centaur', quantity=10, timeBetween=50, timeAfter=10000)
	],
	[
	new Wave(enemy='Centaur', quantity=10, timeBetween=50, timeAfter=10000)
	]
];

io.on('connection', function(socket) {
	socket.on('new player', function() {
    	users[socket.id] = {
    		id: socket.id,
    		name: 'player',
    		wins: 0,
    		losses: 0,
    		inGame: null
    	}

    	findMatch(socket);
	});
	socket.on('income', function(amount) {
	    var player = games[users[socket.id].inGame].players[socket.id];
	    player.gold += amount;
	});
	socket.on('built', function(tower) {
		try {
	    	var player = games[users[socket.id].inGame].players[socket.id];
	    	player.gold -= tower.cost;
	    	player.towers.push(tower);
	    } catch (e) {
	    	console.log(e);
	    }
	});
	socket.on('sold', function(tower) {
		try {
	    	var player = games[users[socket.id].inGame].players[socket.id];
	    	player.gold += tower.cost * sellPercent;
	    	for (var i in player.towers) {
	    		if (player.towers[i].id == tower.id) {
	    			player.towers.splice(i, 1);
	    			break;
	    		}
	    	}
	    } catch (e) {
	    	console.log(e);
	    }
	});
	socket.on('expense', function(cost) {
		var player = games[users[socket.id].inGame].players[socket.id];
		player.gold -= cost;
	});
	socket.on('removeEnemies', function(enemies, playerID) {
		var player = games[users[socket.id].inGame].players[playerID];
		for (var e in enemies) {
			for (var i=0; i<player.enemies.length; i++) {
				var enemy = player.enemies[i];
				if (enemy.id == enemies[e].id) {
					player.enemies.splice(i, 1);
					break;
				}
			}
		}
	});
	socket.on('addEnemies', function(enemies, playerID) {
		var player = games[users[socket.id].inGame].players[playerID];
		for (var e in enemies) {
			var enemy = enemies[e];
			var newEnemy = new (eval(enemy.name))(id=enemy.id, owner=player.id, gameID=users[socket.id].inGame);
			newEnemy.progress = enemy.progress;
			newEnemy.hp = enemy.hp;
			newEnemy.pathProgress = enemy.pathProgress;
			newEnemy.path = enemy.path;
			newEnemy.x = enemy.x;
			newEnemy.y = enemy.y;
			newEnemy.lastEffectTime = games[users[socket.id].inGame].time;
			newEnemy.visible = enemy.visible;
			newEnemy.maxhp = enemy.maxhp;
			newEnemy.armor = enemy.armor;
			newEnemy.speed = enemy.speed;
			newEnemy.damage = enemy.damage;
			newEnemy.effect = enemy.effect;
			newEnemy.outline = enemy.outline;
			newEnemy.color = enemy.color;
			newEnemy.size = enemy.size;
			player.enemies.push(newEnemy);
		}
	});
	socket.on('oppTrack', function(changes) {
		var game = games[users[socket.id].inGame]
		var player = game.players[socket.id];
		var opponent = game.players[player.opponent];
		var track = opponent.track;
		var newPath;
		var marker = false;

		if (findShortestDistance(track, track.paths[changes[0].path], changes[0].progress) > findShortestDistance(track, track.paths[changes[changes.length-1].path], changes[changes.length-1].progress)) {
			var first = changes[0];
			var last = changes[changes.length-1];
		} else {
			var first = changes[changes.length-1];
			var last = changes[0];
		}

		var firstPathIndex = first.path;
		var lastPathIndex = last.path;
		var firstPath = track.paths[firstPathIndex];
		var lastPath = track.paths[lastPathIndex];

		if (first.vertex.x == firstPath.vertices[firstPath.vertices.length-1].x && first.vertex.y == firstPath.vertices[firstPath.vertices.length-1].y) {
			newPath = new Path(vertices=[new Point(first.vertex.x, first.vertex.y)], next=[], prev=[firstPathIndex]);
		} else {
			var vertexHolder1 = firstPath.vertices.splice(first.next, firstPath.vertices.length - first.next);
			vertexHolder1.unshift(new Point(first.vertex.x, first.vertex.y));
			track.paths.push(new Path(vertices=vertexHolder1, next=firstPath.next.slice(0), prev=[firstPathIndex]));

			if (lastPathIndex == firstPathIndex) {
				lastPathIndex = track.paths.length - 1;
				lastPath = track.paths[lastPathIndex];
				last.next -= (firstPath.vertices.length - 1);
				last.prev -= (firstPath.vertices.length - 1);
			}

			for (var i in firstPath.vertices) {
				var v = firstPath.vertices[i];
				if (first.vertex.x == v.x && first.vertex.y == v.y) {
					marker = true;
				}
			}

			if (!marker) {
				firstPath.vertices.push(new Point(first.vertex.x, first.vertex.y));
				marker = false;
			}

			marker = false;

			for (var i=firstPath.next.length-1; i>=0; i--) {
				if (track.paths[firstPath.next[i]].vertices[0].x == vertexHolder1[vertexHolder1.length-1].x && track.paths[firstPath.next[i]].vertices[0].y == vertexHolder1[vertexHolder1.length-1].y) {
					firstPath.next.splice(i, 1);
				}
			}

			firstPath.getDistanceAndLength();
			firstPath.next.push(track.paths.length - 1);
			newPath = new Path(vertices=[new Point(first.vertex.x, first.vertex.y)], next=[], prev=[firstPathIndex]);

			for (var i in opponent.enemies) {
				var enemy = opponent.enemies[i];
				if (enemy.path == firstPathIndex && enemy.pathProgress > firstPath.distance) {
					enemy.pathProgress -= firstPath.distance;
					enemy.path = track.paths.length - 1;
				}
			}
		}

		if (last.vertex.x == lastPath.vertices[lastPath.vertices.length-1].x && last.vertex.y == lastPath.vertices[lastPath.vertices.length-1].y) {
			newPath.vertices.push(new Point(last.vertex.x, last.vertex.y));
			newPath.next = track.paths[lastPathIndex].next.slice(0);
		} else {
			var vertexHolder2 = lastPath.vertices.splice(last.next, lastPath.vertices.length - last.next);
			vertexHolder2.unshift(new Point(last.vertex.x, last.vertex.y));

			for (var i in lastPath.vertices) {
				var v = lastPath.vertices[i];
				if (last.vertex.x == v.x && last.vertex.y == v.y) {
					marker = true;
				}
			}

			if (!marker) {
				lastPath.vertices.push(new Point(last.vertex.x, last.vertex.y));
				marker = false;
			}

			track.paths.push(new Path(vertices=vertexHolder2, next=lastPath.next.slice(0), prev=[lastPathIndex, track.paths.length]));

			for (var i=lastPath.next.length-1; i>=0; i--) {
				if (track.paths[lastPath.next[i]].vertices[0].x == vertexHolder2[vertexHolder2.length-1].x && track.paths[lastPath.next[i]].vertices[0].y == vertexHolder2[vertexHolder2.length-1].y) {
					lastPath.next.splice(i, 1);
				}
			}

			lastPath.getDistanceAndLength();
			lastPath.next.push(track.paths.length - 1);
			newPath.vertices.push(new Point(last.vertex.x, last.vertex.y));
			newPath.next.push(track.paths.length - 1);

			for (var i in opponent.enemies) {
				var enemy = opponent.enemies[i];
				if (enemy.path == lastPathIndex && enemy.pathProgress > lastPath.distance) {
					enemy.pathProgress -= lastPath.distance;
					enemy.path = track.paths.length - 1;
				}
			}
		}

		newPath.getDistanceAndLength();
		track.paths.push(newPath);
		firstPath.next.push(track.paths.length - 1);
	});
	socket.on('spawn', function(enemyNumber) {
		try {
			var game = games[users[socket.id].inGame];
			var player = game.players[socket.id];
			var opponent = game.players[player.opponent];
			if (player.queue.length <= maxQueue && player.gold >= game.spawnable[enemyNumber].cost) {
				if (player.queue.length == 0) {
					player.queueTime = game.time;
					player.queueLeft = game.spawnable[enemyNumber].quantity;
				}
				player.queue.push(enemyNumber);
				player.gold -= game.spawnable[enemyNumber].cost;
				player.honor += game.spawnable[enemyNumber].honor;
			}
		} catch (e) {
			console.log(e);
		}
	});
	socket.on('attack', function(projectile) {
		try {
	    	var player = games[users[socket.id].inGame].players[socket.id];
	    	player.projectiles.push(projectile);
	    } catch (e) {
	    	console.log(e);
	    }
	});
	socket.on('damage', function(enemyID, damage, pierce, projectile) {
		try {
	    	var player = games[users[socket.id].inGame].players[socket.id];

	    	if (projectile && projectile != null) {
		    	for (var i in player.projectiles) {
		    		if (player.projectiles[i].ownerID == projectile.ownerID && player.projectiles[i].id == projectile.id) {
		    			player.projectiles[i].penetration -= 1;

		    			if (player.projectiles[i].penetration <= 0) {
		    				player.projectiles.splice(i, 1);
		    				break;
		    			}
		    		}
		    	}
		    }

	    	player.enemies[enemyID].takeDamage(damage, pierce);
	    } catch (e) {
	    	//console.log(e);
	    }
	});
	socket.on('disconnect', function() {
		if (users[socket.id]) {
			if (users[socket.id].inGame == null) {
				for (var i=0; i<lobby.length; i++) {
					if (lobby[i] == users[socket.id]) {
						lobby.splice(i, 1);
					}
				}
			} else {
				var game = games[users[socket.id].inGame];
				users[game.players[socket.id].opponent].inGame = null;
				findMatch(users[game.players[socket.id].opponent]);

				delete games[users[socket.id].inGame];
			}

			delete users[socket.id];
		}
   	});
});

function findShortestDistance(track, path, currDist) {
	var minDist;
	var tempDist;
	if (path.next.length > 0) {
		for (var i in path.next) {
			tempDist = findShortestDistance(track, track.paths[path.next[i]], 0);
			if (!minDist || tempDist < minDist) {
				minDist = tempDist;
			}
		}

		return (minDist + (path.distance - currDist));
	} else {
		return (path.distance - currDist);
	}
}

function findMatch(socket) {
	if (lobby.length > 0) {
    	var firstInLine = lobby.splice(0, 1)[0].id;
    	var gameid = String(firstInLine) + String(socket.id);

    	games[gameid] = {
    		id: gameid,
    		startTime: new Date(),
    		startTrack: Math.floor(Math.random()*(eval(tracks)).length),
    		lastSpawnTime: 0,
    		waitTime: 0,
    		time: 0,
    		wave: 0,
    		nextWave: 0,
    		subwave: 0,
    		spawnNumber: 0,
    		enemyID: 0,
    		spawnable: [
				{enemy: 'Satyr', cost: 10, honor: 0.01, quantity: 8, timeBetween: 250, wave: 1},
				{enemy: 'Pan', cost: 40, honor: 0.01, quantity: 1, timeBetween: 1000, wave: 2},
				{enemy: 'Centaur', cost: 40, honor: 0.04, quantity: 6, timeBetween: 300, wave: 3},
				{enemy: 'Chiron', cost: 80, honor: 0.04, quantity: 1, timeBetween: 1500, wave: 4},
				{enemy: 'Harpy', cost: 100, honor: 0.1, quantity: 6, timeBetween: 250, wave: 5},
				{enemy: 'Ocypete', cost: 140, honor: 0.1, quantity: 1, timeBetween: 700, wave: 6},
				{enemy: 'Pterippus', cost: 150, honor: 0.15, quantity: 5, timeBetween: 250, wave: 7},
				{enemy: 'Pegasus and Bellerophon', cost: 300, honor: 0.15, quantity: 1, timeBetween: 3000, wave: 8},
				{enemy: 'Argonaut', cost: 250, honor: 0.25, quantity: 6, timeBetween: 200, wave: 9},
				{enemy: 'Perseus', cost: 500, honor: 0.25, quantity: 1, timeBetween: 2000, wave: 10},
				{enemy: 'Cyclops', cost: 500, honor: 0.5, quantity: 5, timeBetween: 500, wave: 11},
				{enemy: 'Theseus', cost: 1000, honor: 0.5, quantity: 1, timeBetween: 4000, wave: 12}
			],
    		players: {}
    	};

    	games[gameid].players[firstInLine] = {
		    id: firstInLine,
		    opponent: socket.id,
		    track: eval(tracks)[games[gameid].startTrack],
		    lives: 100,
		    gold: 300,
		    income: 100,
		    honor: 1,
		    incomeTime: 6000,
		    queueTime: 0,
		    queueLeft: 0,
		    canBuild: ['Archer', 'Tartarus', 'Deceiver'],
		    towers: [],
		    projectiles: [],
		    enemies: [],
		    queue: []
		};

		games[gameid].players[socket.id] = {
		    id: socket.id,
		    opponent: firstInLine,
		    track: eval(tracks)[games[gameid].startTrack],
		    lives: 100,
		    gold: 300,
		    income: 100,
		    honor: 1,
		    incomeTime: 6000,
		    queueTime: 0,
		    queueLeft: 0,
		    canBuild: ['Archer', 'Tartarus', 'Deceiver'],
		    towers: [],
		    projectiles: [],
		    enemies: [],
		    queue: []
		}

    	users[socket.id].inGame = gameid;
    	users[firstInLine].inGame = gameid;
    } else {
    	lobby.push(users[socket.id]);
    }
}

setInterval(function() {
	try {	
		for (var i in games) {
			var game = games[i];

			game.time = new Date() - game.startTime;

			if (waves[game.nextWave]) {
				var currWave = waves[game.nextWave][game.subwave];

				if (game.waitTime != 0) {
					if (game.time - game.lastSpawnTime > game.waitTime) {
						for (var j in game.players) {
							var player = game.players[j];
							player.enemies.push(new (eval(currWave.enemy))(id=game.enemyID, owner=player.id, gameID=game.id));
						}

						if (game.spawnNumber == 0 && game.wave < game.nextWave) {
							game.wave = game.nextWave;
						}
						game.spawnNumber += 1;

						if (game.spawnNumber >= currWave.quantity) {
							if (waves[game.nextWave][game.subwave + 1]) {
								game.subwave += 1;
								game.spawnNumber = 0;
								game.waitTime = currWave.timeAfter;
							} else {
								game.nextWave += 1;
								game.subwave = 0;
								game.spawnNumber = 0;
								game.waitTime = currWave.timeAfter;
							}
						}

						game.lastSpawnTime += game.waitTime;
						game.waitTime = 0;
					}
				} else if (game.spawnNumber < currWave.quantity) {
					if (game.time - game.lastSpawnTime > currWave.timeBetween) {
						for (var j in game.players) {
							var player = game.players[j];
							player.enemies.push(new (eval(currWave.enemy))(id=game.enemyID, owner=player.id, gameID=game.id));
						}

						game.spawnNumber += 1;

						if (game.spawnNumber >= currWave.quantity) {
							if (waves[game.nextWave][game.subwave + 1]) {
								game.subwave += 1;
								game.spawnNumber = 0;
								game.waitTime = currWave.timeAfter;
							} else {
								game.nextWave += 1;
								game.subwave = 0;
								game.spawnNumber = 0;
								game.waitTime = currWave.timeAfter;
							}
						}

						game.lastSpawnTime += currWave.timeBetween;
					}
				}
			}

			for (var j in game.players) {
				var player = game.players[j];

				for (var k=player.projectiles.length-1; k>=0; k--) {
					var projectile = player.projectiles[k];

					projectile.x += projectile.speed * projectile.direction.x;
					projectile.y += projectile.speed * projectile.direction.y;

					if (projectile.range < Math.sqrt((projectile.x - projectile.start.x)*(projectile.x - projectile.start.x)+(projectile.y - projectile.start.y)*(projectile.y - projectile.start.y))) {
				    	player.projectiles.splice(k, 1);
					}
				}

				for (var k in player.enemies) {
					game.players[j].enemies[k].tick();
				}

				if (player.queue.length > 0) {
					if (player.queueLeft > 0) {
						if (game.time - player.queueTime > game.spawnable[player.queue[0]].timeBetween) {
							game.players[player.opponent].enemies.push(new (eval(game.spawnable[player.queue[0]].enemy.replace(/\s/g, '')))(id=game.enemyID, owner=player.opponent, gameID=game.id));
							player.queueTime += game.spawnable[player.queue[0]].timeBetween;
							player.queueLeft -= 1;
						}
					} else {
						player.queueTime += game.spawnable[player.queue[0]].timeBetween;
						player.queue.splice(0, 1);

						if (player.queue.length > 0) {
							player.queueLeft = game.spawnable[player.queue[0]].quantity;
						}
					}
				} 

				io.to(player.id).emit('state', game);
			}

			//io.sockets.emit('state', players, buttons, currentTrack);
		}
	} catch (e) {
		console.log(e);
	}

}, 1000 / 60);