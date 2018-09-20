var socket = io();

function getDistance(x1, y1, x2, y2) {
  return Math.sqrt((x1 - x2)*(x1 - x2) + (y1 - y2)*(y1 - y2));
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

class Projectile {
  constructor(id, x, y, color, range, speed, damage, pierce, penetration, impact, direction, movement, owner) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.start = {x: this.x, y: this.y};
    this.color = color;
    this.range = range;
    this.speed = speed;
    this.damage = damage;
    this.pierce = pierce;
    this.penetration = penetration;
    this.impact = impact;
    this.direction = direction;
    this.movement = movement;
    this.owner = owner;
    this.ownerID = this.owner.id;
    this.alreadyHit = [];
  }

  tick() {
    this.x += this.speed * this.direction.x;
    this.y += this.speed * this.direction.y;

    if (this.range < Math.sqrt((this.x - this.start.x)*(this.x - this.start.x)+(this.y - this.start.y)*(this.y - this.start.y))) {
      for (var i in projectiles) {
        if (projectiles[i] == this) {
          projectiles.splice(i, 1);
          break;
        }
      }
    } else {
      for (var i in player.enemies) {
        var enemy = player.enemies[i];
        var hit = false;

        for (var j in this.alreadyHit) {
          if (this.alreadyHit[j] == enemy.id) {
            hit = true;
          }
        }

        if (!hit && this.penetration > 0 && enemy.size*2 > getDistance(this.x, this.y, enemy.x, enemy.y)) {
          socket.emit('damage', i, this.damage, this.pierce, this);
          this.owner.damageDealt += Math.min(enemy.hp, this.damage * (1-((1-this.pierce)*(enemy.armor/(enemy.armor + armorHalfReduction)))));
          this.penetration -= 1;
          this.alreadyHit.push(enemy.id);

          if (this.penetration <= 0) {
            for (var j=0; j<projectiles.length; j++) {
              if (projectiles[j] == this) {
                projectiles.splice(j, 1);
                break;
              }
            }
          }
        }
      }
    }
  }
}

class BasicDart extends Projectile {
  constructor(id, x, y, direction, owner) {
    super(id, x, y, 'black', 0.5, 0.03, 1, 0, 1, null, direction, 'straight', owner)
  }
}

class SharperDart extends Projectile {
  constructor(id, x, y, direction, owner) {
    super(id, x, y, 'black', 0.5, 0.03, 1, 0, 2, null, direction, 'straight', owner)
  }
}

class PiercingSharperDart extends Projectile {
  constructor(id, x, y, direction, owner) {
    super(id, x, y, 'black', 0.5, 0.03, 1, 0.5, 2, null, direction, 'straight', owner)
  }
}

class PowerfulBasicDart extends Projectile {
  constructor(id, x, y, direction, owner) {
    super(id, x, y, 'black', 0.5, 0.03, 5, 0, 5, null, direction, 'straight', owner)
  }
}

class Tower {
  constructor(built, upgradeEffects, x, y, cost, size, color, range, attackTime, damage, pierce, projectile, target, canTarget, canHitInvisible, ability, owner) {
    this.id = towersBuilt;
    this.upgradeEffects = upgradeEffects;
    this.built = built;
    this.x = x;
    this.y = y;
    this.cost = cost;
    this.size = size;
    this.color = color;
    this.range = range;
    this.attackTime = attackTime;
    this.damage = damage;
    this.pierce = pierce;
    this.projectile = projectile;
    this.target = target;
    this.canTarget = canTarget;
    this.canHitInvisible = canHitInvisible;
    this.ability = ability;
    this.owner = owner;
    this.canHitDistances = [];
    this.lastAttackTime = 0;
    this.shotID = 0;
    this.leftUpgrades = 0;
    this.rightUpgrades = 0;
    this.damageDealt = 0;
  }

  sell() {
    socket.emit('sold', this);
    for (var i in towers) {
      var tower = towers[i];
      if (tower == this) {
        towers.splice(i, 1);
        break;
      }
    }

    if (selectedObject && selectedObject == this) {
      selected = null;
      selectedObject = null;
    }
  }

  placed() {
    
  }

  tick() {
    if (!this.built) {
      if (mouseX && mouseY) {
        this.x = mouseX/screen1.width;
        this.y = mouseY/screen1.height;
      }
    } else {
      if (time - this.lastAttackTime > this.attackTime) {
        this.attack();
      }
    }
  }

  attack() {
    var other;
    var distance;
    var distanceID;

    for (var i in player.enemies) {
      var enemy = player.enemies[i];

      if ((enemy.visible || (enemy.visible == false && this.canHitInvisible)) && this.range + 0.01 > getDistance(enemy.x, enemy.y, this.x, this.y)) {
        switch (this.canTarget[this.target]) {
          case 'first':
            if (!distance || enemy.progress > distance) {
              distance = enemy.progress;
              distanceID = i;
            }
            break;
          case 'last':
            if (!distance || enemy.progress < distance) {
              distance = enemy.progress;
              distanceID = i;
            }
            break;
          case 'close':
            if (!distance || Math.sqrt((enemy.x - this.x)*(enemy.x - this.x)+(enemy.y - this.y)*(enemy.y - this.y)) < distance) {
              distance = Math.sqrt((enemy.x - this.x)*(enemy.x - this.x)+(enemy.y - this.y)*(enemy.y - this.y));
              distanceID = i;
            }
            break;
          case 'strong':
            if ((!other || enemy.maxhp*(1+(enemy.armor/(enemy.armor + armorHalfReduction))) > other) || ((!other || enemy.maxhp*(1+(enemy.armor/(enemy.armor + armorHalfReduction))) == other) && (!distance || enemy.progress >= distance))) {
              other = enemy.maxhp*(1+(enemy.armor/(enemy.armor + armorHalfReduction)));
              distance = enemy.progress;
              distanceID = i;
            }
            break;
          case 'weak':
            if ((!other || enemy.maxhp*(1+(enemy.armor/(enemy.armor + armorHalfReduction)))) || ((!other || enemy.maxhp*(1+(enemy.armor/(enemy.armor + armorHalfReduction))) == other) && (!distance || enemy.progress >= distance))) {
              other = enemy.maxhp*(1+(enemy.armor/(enemy.armor + armorHalfReduction)));
              distance = enemy.progress;
              distanceID = i;
            }
            break;
          }
        }
      }

    if (distanceID) {
      if (this.projectile && this.projectile != null) {
        var tempX = player.enemies[distanceID].x - this.x;
        var tempY = player.enemies[distanceID].y - this.y;
        var newProjectile = new (eval(this.projectile))(this.shotID, this.x, this.y, {x: tempX / Math.sqrt(tempX*tempX + tempY*tempY), y: tempY / Math.sqrt(tempX*tempX + tempY*tempY)}, this);
        projectiles.push(newProjectile);
        socket.emit('attack', newProjectile);
      } else {
        socket.emit('damage', distanceID, this.damage, this.pierce, null);
        this.damageDealt += Math.min(enemy.hp, this.damage * (1-((1-this.pierce)*(enemy.armor/(enemy.armor + armorHalfReduction)))));
      }
      this.shotID += 1;
      this.lastAttackTime = time;
    }
  }

  upgrade(side) {
    switch (side) {
      case 'left':
        if (this.upgradeEffects.left[this.leftUpgrades]) {
          this.upgradeEffects.left[this.leftUpgrades].effect(this);
          this.cost += this.upgradeEffects.left[this.leftUpgrades].cost;
          this.leftUpgrades += 1;
        }
        break;
      case 'right':
        if (this.upgradeEffects.right[this.rightUpgrades]) {
          this.upgradeEffects.right[this.rightUpgrades].effect(this);
          this.cost += this.upgradeEffects.right[this.rightUpgrades].cost;
          this.rightUpgrades += 1;
        }
        break;
    }
  }

  canBuildHere() {
    if (this.x > 1 || this.y > 1) {
      return false;
    }

    for (var i in player.towers) {
      var tower = player.towers[i];
      if (tower.size + this.size > getDistance(tower.x, tower.y, this.x, this.y)) {
        return false;
      }
    }

    var step = 0.1;

    for (var p in tracks[0].paths) {
      var path = tracks[0].paths[p];
      var walker = {x: path.vertices[0].x*screen1.width, y: path.vertices[0].y*screen1.height};

      for (var i=1; i<path.vertices.length; i++) {
        var curr = {x: path.vertices[i].x*screen1.width, y: path.vertices[i].y*screen1.height};
        var prev = {x: path.vertices[i-1].x*screen1.width, y: path.vertices[i-1].y*screen1.height};

        for (var j=0; j<=1/step; j++) {
          if (this.size*((screen1.width + screen1.height) / 2) + trackWidth/2 > Math.sqrt((walker.x - this.x * screen1.width)*(walker.x - this.x * screen1.width) + (walker.y - this.y * screen1.height)*(walker.y - this.y * screen1.height))) {
            return false;
          }

          walker.x = prev.x + (curr.x - prev.x) * (j * step);
          walker.y = prev.y + (curr.y - prev.y) * (j * step);
        }
      }
    }

    return true;
  }
}

//built, upgradeEffects, x, y, cost, size, color, range, attackTime, damage, projectile, target, canTarget, ability, owner
class Archer extends Tower {
  constructor(x, y) {
    super(false, {left: [{cost: 100, name: 'Keen Eyes', effect: function(tower) {tower.range = 0.4; tower.canHitInvisible = true;}}, {cost: 150, name: 'Sharper Shots', effect: function(tower) {tower.projectile = 'SharperDart';}}], right: [{cost: 100, name: 'Quick Draw', effect: function(tower) {tower.attackTime = 500;}}]}, x, y, 100, 0.03, 'brown', 0.2, 1000, 0, 0, 'BasicDart', defaultTarget, ['first', 'last', 'strong', 'weak', 'close'], false, {name: 'An Ability', cost: 0, effect: null}, socket.id);
  }
}

class Sniper extends Tower {
  constructor(x, y) {
    super(false, {left: [{cost: 100, name: '.30 Caliber', effect: function(tower) {tower.damage = 4;}}, {cost: 200, name: '.50 Caliber', effect: function(tower) {tower.damage = 5; tower.pierce = 0.3;}}], right: [{cost: 200, name: 'Rapid Reload', effect: function(tower) {tower.attackTime = 1500;}}]}, x, y, 150, 0.02, 'blue', 1, 2000, 2, 0, null, defaultTarget, ['first', 'last', 'strong', 'weak', 'close'], true, {name: 'An Ability', cost: 0, effect: null}, socket.id);
  }
}

class Chaingunner extends Tower {
  constructor(x, y) {
    super(false, {left: [{cost:500, name: 'Load Faster', effect: function(tower) {tower.attackTime = 300;}}, {cost: 1200, name: 'LOAD EVEN FASTER', effect: function(tower) {tower.attackTime = 150;}}], right: [{cost: 66666, name: '10 cm bullets', effect: function(tower) {tower.projectile = 'PowerfulBasicDart';}}]}, x, y, 1000, 0.02, 'gray', .15, 500, 0, 0, 'BasicDart', defaultTarget, ['first', 'last', 'strong', 'weak', 'close'], false, {name: 'An Ability', cost: 0, effect: null}, socket.id);
  }
}

class Deceiver extends Tower {
  constructor(x, y) {
    super(false, {left: [], right: [{cost: 100, name: 'Trick the Track', effect: function(tower) {maxSize = 0.4; vertexPlaced = 0; vertexAvailable = 2; selected = 'oppTrack'; selectedObject = []; tower.trackPiece = selectedObject;}}]}, x, y, 150, 0.02, 'white', 0, 0, 0, 0, null, null, [], true, {name: 'An Ability', cost: 0, effect: null}, socket.id);
    this.trackPiece;
  }
}
//built, upgradeEffects, x, y, cost, size, color, range, attackTime, damage, pierce, projectile, target, canTarget, canHitInvisible, ability, owner
class Tartarus extends Tower {
  constructor(x, y) {
    super(false, {left: [{cost: 50, name: 'Deeper', effect: function(tower) {tower.depth += 20;}}, {cost: 50, name: 'Deeper', effect: function(tower) {tower.depth += 20;}}, {cost: 50, name: 'Deeper', effect: function(tower) {tower.depth += 20;}}], right: [{cost: 50, name: 'Deeper', effect: function(tower) {tower.depth += 20;}}, {cost: 50, name: 'Deeper', effect: function(tower) {tower.depth += 20;}}, {cost: 50, name: 'Deeper', effect: function(tower) {tower.depth += 20;}}, {cost: 4500, name: 'Hungry Hydra', effect: function(tower) {tower.attackTime += 500;}}]}, x, y, 150, 0.04, 'black', 0, 0, 5, 1, null, null, [], true, {name: 'An Ability', cost: 0, effect: null}, socket.id);
    this.depth = 20;
    this.filled = 0;
    this.contents = [];
  }

  sell() {
    socket.emit('sold', this);
    for (var i in towers) {
      var tower = towers[i];
      if (tower == this) {
        towers.splice(i, 1);
        break;
      }
    }

    if (selectedObject && selectedObject == this) {
      selected = null;
      selectedObject = null;
    }

    socket.emit('addEnemies', this.contents, player.id);
  }

  tick() {
    if (!this.built) {
      if (mouseX && mouseY) {
        this.x = mouseX/screen1.width;
        this.y = mouseY/screen1.height;
      }
    } else if (this.filled < this.depth) {
      for (var i=player.enemies.length-1; i>=0; i--) {
        var enemy = player.enemies[i];
        var alreadyContains = false;

        if (this.size >= getDistance(enemy.x, enemy.y, this.x, this.y) && this.filled + enemy.maxhp <= this.depth) {
          for (var j in this.contents) {
            if (this.contents[j].id == enemy.id) {
              alreadyContains = true;
              break;
            }
          }

          if (!alreadyContains) {
            this.filled += enemy.maxhp;
            this.contents.push(enemy);
            socket.emit('removeEnemies', [enemy], player.id);
          }
        }
      }
    }

    if (this.attackTime != 0 && time - this.lastAttackTime > this.attackTime && this.contents.length > 0) {
      this.attack();
    }
  }

  attack() {
    this.damageDealt += Math.min(this.contents[0].hp, this.damage * (1-((1-this.pierce)*(this.contents[0].armor/(this.contents[0].armor + armorHalfReduction)))));
    this.contents[0].hp -= this.damage * (1-((1-this.pierce)*(this.contents[0].armor/(this.contents[0].armor + armorHalfReduction))));
    this.shotID += 1;
    this.lastAttackTime = time;

    if (this.contents[0].hp <= 0) {
      this.filled -= this.contents[0].maxhp;
      this.contents.splice(0, 1);
    }
  }

  canBuildHere() {
    if (this.x > 1 || this.y > 1) {
      return false;
    }

    for (var i in player.towers) {
      var tower = player.towers[i];
      if (tower.size + this.size > getDistance(tower.x, tower.y, this.x, this.y)) {
        return false;
      }
    }

    var step = 0.1;

    for (var p in tracks[0].paths) {
      var path = tracks[0].paths[p];
      var walker = {x: path.vertices[0].x*screen1.width, y: path.vertices[0].y*screen1.height};

      for (var i=1; i<path.vertices.length; i++) {
        var curr = {x: path.vertices[i].x*screen1.width, y: path.vertices[i].y*screen1.height};
        var prev = {x: path.vertices[i-1].x*screen1.width, y: path.vertices[i-1].y*screen1.height};

        for (var j=0; j<=1/step; j++) {
          if (this.size*((screen1.width + screen1.height) / 3) > Math.sqrt((walker.x - this.x * screen1.width)*(walker.x - this.x * screen1.width) + (walker.y - this.y * screen1.height)*(walker.y - this.y * screen1.height))) {
            return true;
          }

          walker.x = prev.x + (curr.x - prev.x) * (j * step);
          walker.y = prev.y + (curr.y - prev.y) * (j * step);
        }
      }
    }

    return false;
  }
}

class Button {
  constructor(side, x, y, name, cost, width, height, visible, onClick) {
    this.side = side;
    this.x = x;
    this.y = y;
    this.name = name;
    this.cost = cost;
    this.width = width;
    this.height = height;
    this.visible = visible;
    this.onClick = onClick;
  }
}

socket.on('message', function(data) {
  console.log(data);
});

var back = document.getElementById('back');
back.width = window.innerWidth;
back.height = window.innerHeight;
back.style.position = 'absolute';
back.style.top = 0;
back.style.left = 0;
var backContext = back.getContext('2d');

backContext.fillStyle = 'black';
backContext.textAlign = 'center';
backContext.font = '32px Arial';
backContext.fillText('Finding Match', back.width/2, back.height/10);

var screen1 = document.getElementById('meScreen');
screen1.style.position = 'absolute';
screen1.style.top = 0;
screen1.style.left = 0;
var screen1draw = screen1.getContext('2d');

var screen2 = document.getElementById('oppScreen');
screen2.style.position = 'absolute';
screen2.style.top = 0;
screen2.style.left = back.width/2;
var screen2draw = screen2.getContext('2d');

var buttonWidth;
var buttonHeight;
var buttonIndentX;
var buttonIndentY;
var buttonSpaceX;
var buttonSpaceY;
var menuHeight;
var statsWidth;
var player;
var opponent;
var holding;
var trackWidth;
var gameObject;
var min = {x: null, y: null, distance: null, path: null, prev: null, next: null, progress: null};
var vertexPlaced = 0;
var vertexAvailable = 0;
var maxSize = 0;
var selected = null;
var selectedObject = null;
var placeMultiple = false;
var tracks = [];
var buttons = [];
var towers = [];
var projectiles = [];
var time = 0;
var lastIncome = 0;
var mouseX = 0;
var mouseY = 0;
var towersBuilt = 0;
var defaultTarget = 0;
var armorHalfReduction = 10;
var firstTime = true;
var buttons = [
  new Button(side=0, x=3, y=0, name=function () {return (selectedObject.upgradeEffects.left[selectedObject.leftUpgrades] ? selectedObject.upgradeEffects.left[selectedObject.leftUpgrades].name : 'No More Upgrades');}, cost=function () {return (selectedObject.upgradeEffects.left[selectedObject.leftUpgrades] ? selectedObject.upgradeEffects.left[selectedObject.leftUpgrades].cost : 0);}, width=2, height=2, visible=function() {return 'tower'}, onClick=function() {if (selectedObject.upgradeEffects.left[selectedObject.leftUpgrades]) {if (player.gold >= selectedObject.upgradeEffects.left[selectedObject.leftUpgrades].cost) {socket.emit('expense', selectedObject.upgradeEffects.left[selectedObject.leftUpgrades].cost); selectedObject.upgrade('left');}}}),
  new Button(side=0, x=5, y=0, name=function () {return (selectedObject.upgradeEffects.right[selectedObject.rightUpgrades] ? selectedObject.upgradeEffects.right[selectedObject.rightUpgrades].name : 'No More Upgrades');}, cost=function () {return (selectedObject.upgradeEffects.right[selectedObject.rightUpgrades] ? selectedObject.upgradeEffects.right[selectedObject.rightUpgrades].cost : 0);}, width=2, height=2, visible=function() {return 'tower'}, onClick=function() {if (selectedObject.upgradeEffects.right[selectedObject.rightUpgrades]) {if (player.gold >= selectedObject.upgradeEffects.right[selectedObject.rightUpgrades].cost) {socket.emit('expense', selectedObject.upgradeEffects.right[selectedObject.rightUpgrades].cost); selectedObject.upgrade('right');}}}),
  new Button(side=1, x=0, y=1.5, name=function () {return 'Previous Target'}, cost=function () {return 0;}, width=0.5, height=0.5, visible=function() {if (selected == 'tower' && selectedObject != null && selectedObject.canTarget.length > 1) {return 'tower'} else {return ''};}, onClick=function() {selectedObject.target = ((selectedObject.target - 1) + selectedObject.canTarget.length) % selectedObject.canTarget.length;}),
  new Button(side=1, x=2, y=1.5, name=function () {return 'Next Target'}, cost=function () {return 0;}, width=0.5, height=0.5, visible=function() {if (selected == 'tower' && selectedObject != null && selectedObject.canTarget.length > 1) {return 'tower'} else {return ''};}, onClick=function() {selectedObject.target = (selectedObject.target + 1) % selectedObject.canTarget.length;})
];

socket.on('state', function(game) {
  gameObject = game;
  time = game.time;

  player = game.players[socket.id];
  opponent = game.players[player.opponent];
  tracks = [player.track, opponent.track];

  if (firstTime) {
    for (let i=0; i<player.canBuild.length; i++) {
      buttons.push(new Button(side=0, x=i, y=0, name=function () {return player.canBuild[i];}, cost=function () {var tower = new (eval(player.canBuild[i]))(0, 0); return tower.cost;}, width=1, height=1, visible=function() {return null}, onClick=function() {var tower = new (eval(player.canBuild[i]))(mouseX, mouseY); if (player.gold >= tower.cost) {holding = tower;}}));
      buttons.push(new Button(side=0, x=i+0.09, y=1, name=function () {return (new (eval(player.canBuild[i]))(0, 0).ability.name);}, cost=function () {var tower = new (eval(player.canBuild[i]))(0, 0); return tower.ability.cost;}, width=0.75, height=0.75, visible=function() {return null}, onClick=function() {var tower = new (eval(player.canBuild[i]))(0, 0); if (player.gold >= tower.ability.cost) {tower.ability.effect();}}));
    }

    for (let i=0; i<gameObject.spawnable.length; i++) {
      buttons.push(new Button(side=1, x=Math.floor(i/2), y=i%2, name=function() {return gameObject.spawnable[i].enemy;}, cost=function() {return gameObject.spawnable[i].cost;}, width=1, height=1, visible=function() {if (gameObject.spawnable[i].wave <= gameObject.wave) {return null} else {return ''};}, onClick=function() {socket.emit('spawn', i);}));
    }

    firstTime = false;
  }

  back.width = window.innerWidth;
  back.height = window.innerHeight;
  backContext = back.getContext('2d');

  screen1.width = back.width/2;
  screen1.height = back.height - menuHeight;
  screen1draw = screen1.getContext('2d');

  screen2.width = back.width/2;
  screen2.height = back.height - menuHeight;
  screen2.style.left = back.width/2;
  screen2draw = screen2.getContext('2d');

  menuHeight = 0.2 * back.height;
  statsWidth = 0.1 * back.width;
  trackWidth = 0.05 * ((screen1.width + screen1.height) / 2);

  buttonIndentX = 0.01 * back.width;
  buttonIndentY = 0.02 * back.height;
  buttonSpaceX = 0.01 * back.width;
  buttonSpaceY = 0.02 * back.height;
  buttonWidth = (screen1.width - (2 * buttonIndentX + 9 * buttonSpaceY))/10;
  buttonHeight = (menuHeight - (2 * buttonIndentY + buttonSpaceY))/2;

  backContext.clearRect(0, 0, back.width, back.height);
  screen1draw.clearRect(0, 0, screen1.width, screen1.height);
  screen2draw.clearRect(0, 0, screen2.width, screen2.height);

  screen1draw.fillStyle = 'green';
  screen2draw.fillStyle = 'green';
  screen1draw.fillRect(0, 0, screen1.width, screen1.height);
  screen2draw.fillRect(0, 0, screen2.width, screen2.height);

  if (tracks.length > 0) {
    screen1draw.lineWidth = trackWidth;
    screen1draw.strokeStyle = 'white';
    for (var i in tracks[0].paths) {
      screen1draw.beginPath();
      for (var j in tracks[0].paths[i].vertices) {
        var vertex = tracks[0].paths[i].vertices[j];
        screen1draw.lineTo(vertex.x * screen1.width, vertex.y * screen1.height);
        screen1draw.stroke();
      }
      screen1draw.closePath();
    }

    screen2draw.lineWidth = trackWidth;
    screen2draw.strokeStyle = 'white';
    for (var i in tracks[1].paths) {
      screen2draw.beginPath();
      for (var j in tracks[1].paths[i].vertices) {
        var vertex = tracks[1].paths[i].vertices[j];
        screen2draw.lineTo(vertex.x * screen1.width, vertex.y * screen2.height);
        screen2draw.stroke();
      }
      screen2draw.closePath();
    }
  }

  if (player) {
    if (time - lastIncome >= player.incomeTime) {
      lastIncome += player.incomeTime;
      socket.emit('income', player.income * player.honor);
    }

    if ((holding && holding != null) || (selected == 'tower' && selectedObject != null)) {
      var rangeDraw;
      (holding && holding != null) ? rangeDraw = holding : rangeDraw = selectedObject;

      rangeDraw.tick();
      screen1draw.beginPath();
      screen1draw.fillStyle = rangeDraw.color;
      screen1draw.arc(rangeDraw.x * screen1.width, rangeDraw.y * screen1.height, rangeDraw.size * ((screen1.width + screen1.height) / 2), 0, 2*Math.PI, false);
      screen1draw.fill();
      if (holding && holding != null) {
        if (holding.canBuildHere()) {
          screen1draw.fillStyle = 'rgba(50, 50, 50, 0.5)';
        } else {
          screen1draw.fillStyle = 'rgba(255, 0, 0, 0.5)';
        }
      } else {
        screen1draw.fillStyle = 'rgba(50, 50, 50, 0.5)';
      }
      screen1draw.arc(rangeDraw.x * screen1.width, rangeDraw.y * screen1.height, rangeDraw.range * ((screen1.width + screen1.height) / 2), 0, 2*Math.PI, false);
      screen1draw.fill();
      screen1draw.closePath();
    }

    for (var i in towers) {
      towers[i].tick();
    }

    for (var i=projectiles.length-1; i>=0; i--) {
      projectiles[i].tick();
    }

    for (var i in player.towers) {
      var tower = player.towers[i];
      
      screen1draw.moveTo(tower.x * screen1.width, tower.y * screen1.height);
      screen1draw.fillStyle = tower.color;
      screen1draw.beginPath();
      screen1draw.arc(tower.x * screen1.width, tower.y * screen1.height, tower.size * ((screen1.width + screen1.height) / 2), 0, 2*Math.PI, false);
      screen1draw.fill();
      screen1draw.closePath();
    }

    for (var i in opponent.towers) {
      var tower = opponent.towers[i];
      
      screen2draw.moveTo(tower.x * screen1.width, tower.y * screen1.height);
      screen2draw.fillStyle = tower.color;
      screen2draw.beginPath();
      screen2draw.arc(tower.x * screen1.width, tower.y * screen1.height, tower.size * ((screen1.width + screen1.height) / 2), 0, 2*Math.PI, false);
      screen2draw.fill();
      screen2draw.closePath();
    }

    for (var i in player.enemies) {
      var enemy = player.enemies[i];

      screen1draw.lineWidth = 0.0025 * (back.width + back.height)/2;
      screen1draw.strokeStyle = enemy.outline;
      screen1draw.fillStyle = enemy.color;
      screen1draw.beginPath();
      screen1draw.arc(enemy.x * screen1.width, enemy.y * screen1.height, enemy.size * ((screen1.width + screen1.height) / 2), 0, 2*Math.PI, false);
      screen1draw.stroke();
      screen1draw.fill();
      screen1draw.closePath();
    }

    for (var i in opponent.enemies) {
      var enemy = opponent.enemies[i];

      screen2draw.lineWidth = 0.003 * (back.width + back.height)/2;
      screen2draw.strokeStyle = enemy.outline;
      screen2draw.fillStyle = enemy.color;
      screen2draw.beginPath();
      screen2draw.arc(enemy.x * screen1.width, enemy.y * screen1.height, enemy.size * ((screen1.width + screen1.height) / 2), 0, 2*Math.PI, false);
      screen2draw.stroke();
      screen2draw.fill();
      screen2draw.closePath();
    }

    for (var i in player.projectiles) {
      var projectile = player.projectiles[i];
      
      screen1draw.lineWidth = 0.003 * (back.width + back.height)/2;
      screen1draw.strokeStyle = projectile.color;
      screen1draw.beginPath();
      screen1draw.moveTo(projectile.x*screen1.width, projectile.y*screen1.height);
      screen1draw.lineTo(projectile.x*screen1.width - 32*projectile.direction.x, projectile.y*screen1.height - 32*projectile.direction.y);
      screen1draw.stroke();
      screen1draw.closePath();
    }

    for (var i in opponent.projectiles) {
      var projectile = opponent.projectiles[i];
      
      screen2draw.lineWidth = 0.0025 * (back.width + back.height)/2;
      screen2draw.strokeStyle = projectile.color;
      screen2draw.beginPath();
      screen2draw.moveTo(projectile.x*screen1.width, projectile.y*screen1.height);
      screen2draw.lineTo(projectile.x*screen1.width - 32*projectile.direction.x, projectile.y*screen1.height - 32*projectile.direction.y);
      screen2draw.stroke();
      screen2draw.closePath();
    }
  }

  backContext.fillStyle = 'brown';
  backContext.fillRect(0, back.height - menuHeight, back.width, menuHeight);

  backContext.lineWidth = 0.002 * back.width;
  backContext.strokeStyle = 'black';
  backContext.beginPath();
  backContext.moveTo(back.width/2, 0);
  backContext.lineTo(back.width/2, back.height);
  backContext.stroke();
  backContext.closePath();

  for (var i in buttons) {
    var button = buttons[i];
    if (button.visible() == selected) {
      backContext.beginPath();
      backContext.rect(buttonIndentX + button.x * (buttonWidth + buttonSpaceX) + button.side * (back.width/2 + statsWidth/2), back.height - menuHeight + buttonIndentY + button.y * (buttonHeight + buttonSpaceY), button.width * buttonWidth, button.height * buttonHeight);
      backContext.stroke();
      backContext.closePath();

      var cost = button.cost();

      if (cost != 0) {
        backContext.fillStyle = 'white';
        backContext.textAlign = 'center';
        backContext.font = String(0.03*back.height) + 'px Arial';
        backContext.beginPath();
        backContext.strokeText(cost, buttonIndentX + button.x * (buttonWidth + buttonSpaceX) + button.side * (back.width/2 + statsWidth/2) + (button.width * buttonWidth)/2, back.height - menuHeight + buttonIndentY + button.y * (buttonHeight + buttonSpaceY) + button.height * buttonHeight + 0.008 * screen1.height);
        backContext.fillText(cost, buttonIndentX + button.x * (buttonWidth + buttonSpaceX) + button.side * (back.width/2 + statsWidth/2) + (button.width * buttonWidth)/2, back.height - menuHeight + buttonIndentY + button.y * (buttonHeight + buttonSpaceY) + button.height * buttonHeight + 0.008 * screen1.height);
        backContext.closePath();
      }

      var name = button.name();

      if (name != null) {
        backContext.fillStyle = 'white';
        backContext.textAlign = 'center';
        backContext.font = String(0.01*back.height) + 'px Arial';
        backContext.beginPath();
        backContext.strokeText(name, buttonIndentX + button.x * (buttonWidth + buttonSpaceX) + button.side * (back.width/2 + statsWidth/2) + (button.width * buttonWidth)/2, back.height - menuHeight + buttonIndentY + button.y * (buttonHeight + buttonSpaceY) + 0.008 * screen1.height);
        backContext.fillText(name, buttonIndentX + button.x * (buttonWidth + buttonSpaceX) + button.side * (back.width/2 + statsWidth/2) + (button.width * buttonWidth)/2, back.height - menuHeight + buttonIndentY + button.y * (buttonHeight + buttonSpaceY) + 0.008 * screen1.height);
        backContext.closePath();
      }
    }
  }

  if (selected == 'tower') {
    if (selectedObject.canTarget.length > 0) {
      backContext.fillStyle = 'white';
      backContext.textAlign = 'center';
      backContext.font = String(0.02*back.height) + 'px Arial';
      backContext.beginPath();
      backContext.strokeText(selectedObject.canTarget[selectedObject.target], buttonIndentX + 0.41 * (buttonWidth + buttonSpaceX) + back.width/2 + statsWidth/2 + buttonWidth, back.height - menuHeight + buttonIndentY + 1.675 * (buttonHeight + buttonSpaceY) + 0.008 * screen1.height);
      backContext.fillText(selectedObject.canTarget[selectedObject.target], buttonIndentX + 0.41 * (buttonWidth + buttonSpaceX) + back.width/2 + statsWidth/2 + buttonWidth, back.height - menuHeight + buttonIndentY + 1.675 * (buttonHeight + buttonSpaceY) + 0.008 * screen1.height);
      backContext.closePath();
    }

    if (typeof selectedObject.filled !== 'undefined') {
      backContext.fillStyle = 'white';
      backContext.textAlign = 'center';
      backContext.font = String(0.02*back.height) + 'px Arial';
      backContext.beginPath();
      backContext.strokeText('Filled: ' + selectedObject.filled + '/' + selectedObject.depth, buttonIndentX + 0.41 * (buttonWidth + buttonSpaceX) + back.width/2 + statsWidth/2 + buttonWidth, back.height - menuHeight + buttonIndentY + 0.35 * (buttonHeight + buttonSpaceY) + 0.008 * screen1.height);
      backContext.fillText('Filled: ' + selectedObject.filled + '/' + selectedObject.depth, buttonIndentX + 0.41 * (buttonWidth + buttonSpaceX) + back.width/2 + statsWidth/2 + buttonWidth, back.height - menuHeight + buttonIndentY + 0.35 * (buttonHeight + buttonSpaceY) + 0.008 * screen1.height);
      backContext.closePath();
    }

    backContext.fillStyle = 'white';
    backContext.textAlign = 'center';
    backContext.font = String(0.02*back.height) + 'px Arial';
    backContext.beginPath();
    backContext.strokeText('Damage Dealt: ' + Math.round(selectedObject.damageDealt), buttonIndentX + 0.41 * (buttonWidth + buttonSpaceX) + back.width/2 + statsWidth/2 + buttonWidth, back.height - menuHeight + buttonIndentY + 0.75 * (buttonHeight + buttonSpaceY) + 0.008 * screen1.height);
    backContext.fillText('Damage Dealt: ' + Math.round(selectedObject.damageDealt), buttonIndentX + 0.41 * (buttonWidth + buttonSpaceX) + back.width/2 + statsWidth/2 + buttonWidth, back.height - menuHeight + buttonIndentY + 0.75 * (buttonHeight + buttonSpaceY) + 0.008 * screen1.height);
    backContext.closePath();

    backContext.beginPath();
    backContext.strokeRect(buttonIndentX, back.height - menuHeight + buttonIndentY, 2*buttonWidth, 2*buttonHeight + buttonIndentY);
    backContext.closePath();
  } else if (selected == 'enemy' && selectedObject != null) {
    var found = false;
    for (var i in player.enemies) {
      if (player.enemies[i].id == selectedObject.id) {
        selectedObject = player.enemies[i];
        found = true;
        break;
      }
    }

    if (!found) {
      for (var i in opponent.enemies) {
        if (opponent.enemies[i].id == selectedObject.id) {
          selectedObject = opponent.enemies[i];
          found = true;
          break;
        }
      }

      if (!found) {
        selectedObject.hp = 0;
      }
    }

    backContext.beginPath();
    backContext.strokeRect(buttonIndentX, back.height - menuHeight + buttonIndentY, 2*buttonWidth, 2*buttonHeight + buttonIndentY);
    backContext.closePath();

    backContext.lineWidth = 0.002 * back.width;
    backContext.beginPath();
    backContext.strokeRect(buttonIndentX + 2*buttonWidth + 2*buttonSpaceX, back.height - menuHeight + buttonIndentY + buttonHeight/2, 4*buttonWidth, buttonHeight/3);
    backContext.closePath();

    backContext.fillStyle = 'red';
    backContext.beginPath();
    backContext.fillRect(buttonIndentX + 2*buttonWidth + 2*buttonSpaceX, back.height - menuHeight + buttonIndentY + buttonHeight/2, 4*buttonWidth, buttonHeight/3);
    backContext.closePath();

    backContext.fillStyle = 'green';
    backContext.beginPath();
    backContext.fillRect(buttonIndentX + 2*buttonWidth + 2*buttonSpaceX, back.height - menuHeight + buttonIndentY + buttonHeight/2, (selectedObject.hp/selectedObject.maxhp) * (4*buttonWidth), buttonHeight/3);
    backContext.closePath();

    backContext.fillStyle = 'white';
    backContext.textAlign = 'center';
    backContext.beginPath();
    backContext.font = String(0.02*back.height) + 'px Arial';
    backContext.strokeText(selectedObject.name, buttonIndentX + 2*buttonWidth + 2*buttonSpaceX + 2*buttonWidth, back.height - menuHeight + buttonIndentY + buttonHeight/4);
    backContext.fillText(selectedObject.name, buttonIndentX + 2*buttonWidth + 2*buttonSpaceX + 2*buttonWidth, back.height - menuHeight + buttonIndentY + buttonHeight/4);
    backContext.font = String(0.015*back.height) + 'px Arial';
    backContext.strokeText(Math.ceil(selectedObject.hp) + '/' + selectedObject.maxhp, buttonIndentX + 2*buttonWidth + 2*buttonSpaceX + 2*buttonWidth, back.height - menuHeight + buttonIndentY + buttonHeight/2 + buttonHeight/4.5);
    backContext.fillText(Math.ceil(selectedObject.hp) + '/' + selectedObject.maxhp, buttonIndentX + 2*buttonWidth + 2*buttonSpaceX + 2*buttonWidth, back.height - menuHeight + buttonIndentY + buttonHeight/2 + buttonHeight/4.5);
    backContext.closePath();

    backContext.textAlign = 'left';
    backContext.beginPath();
    backContext.strokeText('Damage: ' + selectedObject.damage, buttonIndentX + 2*buttonWidth + 2*buttonSpaceX, back.height - menuHeight + buttonIndentY + 1.1*buttonHeight);
    backContext.fillText('Damage: ' + selectedObject.damage, buttonIndentX + 2*buttonWidth + 2*buttonSpaceX, back.height - menuHeight + buttonIndentY + 1.1*buttonHeight);
    backContext.closePath();

    backContext.textAlign = 'right';
    backContext.beginPath();
    backContext.strokeText('Armor: ' + selectedObject.armor, buttonIndentX + 2*buttonWidth + 2*buttonSpaceX + 4*buttonWidth, back.height - menuHeight + buttonIndentY + 1.1*buttonHeight);
    backContext.fillText('Armor: ' + selectedObject.armor, buttonIndentX + 2*buttonWidth + 2*buttonSpaceX + 4*buttonWidth, back.height - menuHeight + buttonIndentY + 1.1*buttonHeight);
    backContext.closePath();
  } else if (selected == 'oppTrack') {
    if (mouseX >= screen1.width && mouseY <= back.height - menuHeight) {
      min.distance = null;
      min.x = null;
      min.y = null;
      min.path = null;
      min.prev = null;
      min.next = null;
      min.progress = null;

      var step = 0.1;
      var dist = 0;
      var size = 0;
      var path;
      var walker;
      var curr;
      var prev;

      for (var p in tracks[1].paths) {
        path = tracks[1].paths[p];
        walker = {x: path.vertices[0].x, y: path.vertices[0].y};
        for (var i=1; i<path.vertices.length; i++) {
          curr = {x: path.vertices[i].x, y: path.vertices[i].y};
          prev = {x: path.vertices[i-1].x, y: path.vertices[i-1].y};

          for (var j=1; j<=1/step; j++) {
            dist = getDistance(walker.x*screen1.width + screen1.width, walker.y*screen1.height, mouseX, mouseY);

            if (vertexPlaced > 0) {
              size = getDistance(walker.x, walker.y, selectedObject[vertexPlaced-1].vertex.x, selectedObject[vertexPlaced-1].vertex.y);
            }

            if ((min.distance == null || min.distance > dist) && maxSize >= size) {
              min.distance = dist;
              min.x = walker.x;
              min.y = walker.y;
              min.path = parseInt(p);
              min.prev = i-1;
              min.next = i;
              min.progress = 0;
              for (var k=0; k<i-1; k++) {
                min.progress += path.lengths[k];
              }
              min.progress += path.lengths[i-1] * (j * step);
            }

            walker.x = prev.x + (curr.x - prev.x) * (j * step);
            walker.y = prev.y + (curr.y - prev.y) * (j * step);
          }
        }
      }

      if (min != null && min.x != null  && min.y != null ) {
        screen2draw.fillStyle = 'red';
        screen2draw.beginPath();
        screen2draw.arc(min.x*screen1.width, min.y*screen1.height, 0.05 * ((screen1.width + screen1.height) / 2), 0, 2*Math.PI, false);
        screen2draw.fill();
        screen2draw.closePath();
      }

      for (var i in selectedObject) {
        screen2draw.fillStyle = 'red';
        screen2draw.beginPath();
        screen2draw.arc(selectedObject[i].vertex.x*screen1.width, selectedObject[i].vertex.y*screen1.height, 0.05 * ((screen1.width + screen1.height) / 2), 0, 2*Math.PI, false);
        screen2draw.fill();
        screen2draw.closePath();
      }
    }
  }

  backContext.fillStyle = 'black';
  backContext.fillRect(back.width/2 - statsWidth/2, back.height - menuHeight, statsWidth, menuHeight);

  backContext.fillStyle = 'white';
  backContext.textAlign = 'center';
  backContext.font = String(0.02*back.height) + 'px Arial';
  backContext.fillText(Math.floor(time/1000), back.width/2, back.height - menuHeight + 0.03*back.height);

  if (player) {
    backContext.fillStyle = 'red';
    backContext.fillText(player.lives.toFixed(0), back.width/2, back.height - menuHeight + 0.07*back.height);

    backContext.fillStyle = 'yellow';
    backContext.fillText(player.gold.toFixed(0), back.width/2, back.height - menuHeight + 0.11*back.height);

    backContext.textAlign = 'right';
    backContext.fillStyle = 'green';
    backContext.fillText(player.income.toFixed(0), back.width/2 - 0.008*back.width, back.height - menuHeight + 0.15*back.height);

    backContext.textAlign = 'center';
    backContext.fillStyle = 'white';
    backContext.fillText('x', back.width/2, back.height - menuHeight + 0.15*back.height);

    backContext.textAlign = 'left';
    backContext.fillStyle = 'gray';
    backContext.fillText(player.honor.toFixed(2), back.width/2 + 0.008*back.width, back.height - menuHeight + 0.15*back.height);
  }
});

document.addEventListener('click', function(event) {
  if (holding) {
    if (holding.canBuildHere()) {
      holding.built = true;
      socket.emit('built', holding);
      towers.push(holding);
      holding.placed();
      towersBuilt += 1;
      if (placeMultiple) {
        var tower = new (eval(holding.constructor.name))(0, 0);
        if (player.gold >= tower.cost) {
          holding = tower;
        } else {
          selected = 'tower';
          selectedObject = holding;
          holding = null;
        }
      } else {
        selected = 'tower';
        selectedObject = holding;
        holding = null;
      }
    }
  } else if ((selected == 'oppTrack' || selected == 'ownTrack') && (event.clientX >= screen1.width && event.clientY <= screen1.height)) {
    if (min != null && min.x != null  && min.y != null && vertexPlaced < vertexAvailable) {
      vertexPlaced += 1;
      selectedObject.push({vertex: new Point(min.x, min.y), path: min.path, prev: min.prev, next: min.next, progress: min.progress});

      if (vertexPlaced == vertexAvailable) {
        socket.emit(selected, selectedObject);
        vertexAvailable = 0;
        vertexPlaced = 0;
        maxSize = 0;
        selected = null;
        selectedObject = null;
      }
    }
  } else {

    for (var i=0; i<buttons.length; i++) {
      var button = buttons[i];
      if (button.visible() == selected && event.clientX > buttonIndentX + button.x * (buttonWidth + buttonSpaceX) + button.side * (back.width/2 + statsWidth/2) && event.clientX < buttonIndentX + button.x * (buttonWidth + buttonSpaceX) + button.side * (back.width/2 + statsWidth/2) + button.width * buttonWidth && event.clientY > back.height - menuHeight + buttonIndentY + button.y * (buttonHeight + buttonSpaceY) && event.clientY < back.height - menuHeight + buttonIndentY + button.y * (buttonHeight + buttonSpaceY) + button.height * buttonHeight) {
        button.onClick();
      }
    }

    for (var i in towers) {
      var tower = towers[i];
      if (tower.size*((screen1.width+screen1.height)/2) > getDistance(tower.x*screen1.width, tower.y*screen1.height, event.clientX, event.clientY)) {
        selected = 'tower';
        selectedObject = tower;
        return;
      }
    }

    for (var i in player.enemies) {
      var enemy = player.enemies[i];
      if (enemy.size*((screen1.width+screen1.height)/2) > getDistance(enemy.x*screen1.width, enemy.y*screen1.height, event.clientX, event.clientY)) {
        selected = 'enemy';
        selectedObject = enemy;
        return;
      }
    }

    for (var i in opponent.enemies) {
      var enemy = opponent.enemies[i];
      if (enemy.size*((screen1.width+screen1.height)/2) > getDistance(enemy.x*screen1.width, enemy.y*screen1.height, event.clientX - screen1.width, event.clientY)) {
        selected = 'enemy';
        selectedObject = enemy;
        return;
      }
    }

    if (event.clientY < back.height - menuHeight) {
      selected = null;
      selectedObject = null;
    }
  }
});

document.onmousemove = function(event) {
  event = event || window.event;

  if (mouseY < back.height - menuHeight && event.clientY > back.height - menuHeight) {
    holding = null;
  }

  mouseX = event.clientX;
  mouseY = event.clientY;
};

document.addEventListener('keydown', function(event) {
  console.log(event.keyCode);
  switch (event.keyCode) {
    case 8: // Backspace
      selectedObject.sell();
      break;
    case 16: // Shift
      placeMultiple = true;
      break;
    case 27: // ESC
      break;
    case 81: // Q
      if (selected == 'tower' && selectedObject.canTarget.length > 1) {
        selectedObject.target = (selectedObject.target - 1 + selectedObject.canTarget.length) % selectedObject.canTarget.length;
      }
      break;
    case 87: // W
      if (selected == 'tower' && selectedObject.canTarget.length > 1) {
        selectedObject.target = (selectedObject.target + 1) % selectedObject.canTarget.length;
      }
      break;
  }
});

document.addEventListener('keyup', function(event) {
  switch (event.keyCode) {
    case 16: // Shift
      placeMultiple = false;
      break;
  }
});

socket.emit('new player');