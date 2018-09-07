var socket = io();

class Tower {
  constructor(built, x, y, cost, size, color, range, attackTime, damage, projectile, target, owner) {
    this.built = built;
    this.x = x;
    this.y = y;
    this.cost = cost;
    this.size = size;
    this.color = color;
    this.range = range;
    this.attackTime = attackTime;
    this.damage = damage;
    this.projectile = projectile;
    this.target = target;
    this.owner = owner;
    this.lastAttackTime = 0;
  }

  tick() {
    if (!this.built) {
      if (mouseX && mouseY) {
        this.x = mouseX/screen.width;
        this.y = mouseY/screen.height;
      }
    } else {
      if (this.lastAttackTime == 0) {
        this.lastAttackTime = time;
      }

      if (time - this.lastAttackTime > this.attackTime) {
        for (var i in player.enemies) {
          var enemy = player.enemies[i];

          if (this.range >= Math.sqrt((enemy.x - this.x)*(enemy.x - this.x) + (enemy.y - this.y)*(enemy.y - this.y))) {
            socket.emit('attack', enemy, this.damage);
            this.lastAttackTime += this.attackTime;
          }
        }
      }
    }
  }

  canBuildHere() {
    if(this.x > 1) {
      return false;
    }

    var step = 0.1;
    var walker = {x: tracks[0].vertices[0].x*screen.width, y: tracks[0].vertices[0].y*screen.height};

    for (var i=1; i<tracks[0].vertices.length; i++) {
      var curr = {x: tracks[0].vertices[i].x*screen.width, y: tracks[0].vertices[i].y*screen.height};
      var prev = {x: tracks[0].vertices[i-1].x*screen.width, y: tracks[0].vertices[i-1].y*screen.height};

      for (var j=0; j<=1/step; j++) {
        if (this.size*((screen.width + screen.height) / 2) + trackWidth/2 > Math.sqrt((walker.x - this.x * screen.width)*(walker.x - this.x * screen.width) + (walker.y - this.y * screen.height)*(walker.y - this.y * screen.height))) {
          return false;
        }

        walker.x = prev.x + (curr.x - prev.x) * (j * step);
        walker.y = prev.y + (curr.y - prev.y) * (j * step);
      }
    }

    return true;
  }
}

class Projectile {
  constructor(x, y, type, range, speed, damage, impact, movement, owner) {
    this.x = x;
    this.y = y;
    this.type = type;
    this.range = range;
    this.speed = speed;
    this.damage = damage;
    this.impact = impact;
    this.movement = movement;
    this.owner = owner;
  }
}

class Archer extends Tower {
  constructor(x, y) {
    super(false, x, y, 100, 0.03, 'brown', 0.2, 1000, 1, 'dart', 'first', socket.id);
  }
}

socket.on('message', function(data) {
  console.log(data);
});

var canvas = document.getElementById('canvas');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
var context = canvas.getContext('2d');

context.fillStyle = 'black';
context.textAlign = 'center';
context.font = '32px Arial';
context.fillText('Finding Match', canvas.width/2, canvas.height/10);

var buttonSize;
var buttonIndent;
var buttonSpace;
var menuHeight;
var statsWidth;
var screen;
var player;
var opponent;
var holding;
var trackWidth;
var tracks = [];
var buttons = [];
var towers = [];
var time = 0;
var lastIncome = 0;
var mouseX = 0;
var mouseY = 0;

socket.on('state', function(game, buttonList) {
  time = game.time;

  canvas = document.getElementById('canvas');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  context = canvas.getContext('2d');

  buttonSize = 0.03 * canvas.width;
  buttonIndent = 0.01 * canvas.width;
  buttonSpace = 0.01 * canvas.width;
  menuHeight = 0.2 * canvas.height
  statsWidth = 0.1 * canvas.width;

  player = game.players[socket.id];
  opponent = game.players[player.opponent];
  tracks = [player.track, opponent.track];
  buttons = buttonList;
  screen = {width: canvas.width/2, height: canvas.height - menuHeight};
  trackWidth = 0.05 * ((screen.width + screen.height) / 2);

  context.clearRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = 'green';
  context.fillRect(0, 0, canvas.width, canvas.height);

  if (tracks.length > 0) {
    context.beginPath();
    context.lineWidth = trackWidth;
    context.strokeStyle = 'white';
    for (var i in tracks[0].vertices) {
      var vertex = tracks[0].vertices[i];
      context.lineTo(vertex.x * screen.width, vertex.y * screen.height);
      context.stroke();
    }
    context.closePath();

    context.beginPath();
    context.lineWidth = trackWidth;
    context.strokeStyle = 'white';
    for (var i in tracks[1].vertices) {
      var vertex = tracks[1].vertices[i];
      context.lineTo(screen.width + vertex.x * screen.width, vertex.y * screen.height);
      context.stroke();
    }
    context.closePath();
  }

  context.fillStyle = 'brown';
  context.fillRect(0, canvas.height - menuHeight, canvas.width, menuHeight);

  context.lineWidth = 5;
  context.strokeStyle = 'black';
  context.beginPath();
  context.moveTo(canvas.width/2, 0);
  context.lineTo(canvas.width/2, canvas.height);
  context.stroke();
  context.closePath();

  for (var i in buttons) {
    var button = buttons[i];
    context.beginPath();
    context.rect(buttonIndent + button.x * (buttonSize + buttonSpace) + button.side * (canvas.width/2 + statsWidth/2), canvas.height - menuHeight + buttonIndent + button.y * (buttonSize + buttonSpace), button.width * buttonSize, button.height * buttonSize);
    context.stroke();
    context.closePath();
  }

  context.fillStyle = 'black';
  context.fillRect(canvas.width/2 - statsWidth/2, canvas.height - menuHeight, statsWidth, menuHeight);

  context.fillStyle = 'white';
  context.textAlign = 'center';
  context.font = '20px Arial';
  context.fillText(Math.floor(time/1000), canvas.width/2, canvas.height - menuHeight + 32);

  if (player) {
    context.fillStyle = 'red';
    context.fillText(player.lives, canvas.width/2, canvas.height - menuHeight + 80);

    context.fillStyle = 'yellow';
    context.fillText(player.gold, canvas.width/2, canvas.height - menuHeight + 128);

    context.textAlign = 'right';
    context.fillStyle = 'green';
    context.fillText(player.income, canvas.width/2 - 16, canvas.height - menuHeight + 160);

    context.textAlign = 'center';
    context.fillStyle = 'white';
    context.fillText('x', canvas.width/2, canvas.height - menuHeight + 160);

    context.textAlign = 'left';
    context.fillStyle = 'gray';
    context.fillText(player.honor.toFixed(2), canvas.width/2 + 16, canvas.height - menuHeight + 160);

    if (time - lastIncome >= player.incomeTime) {
      lastIncome += player.incomeTime;
      socket.emit('income');
      console.log('income');
    }

    if (holding && holding) {
      holding.tick();
      context.moveTo(holding.x * screen.width, holding.y * screen.height);
      context.fillStyle = holding.color;
      context.beginPath();
      context.arc(holding.x * screen.width, holding.y * screen.height, holding.size * ((screen.width + screen.height) / 2), 0, 2*Math.PI, false);
      context.fill();
      context.closePath();
      if (holding.canBuildHere()) {
        context.fillStyle = 'rgba(50, 50, 50, 0.5)';
      } else {
        context.fillStyle = 'rgba(255, 0, 0, 0.5)';
      }
      context.beginPath();
      context.arc(holding.x * screen.width, holding.y * screen.height, holding.range * ((screen.width + screen.height) / 2), 0, 2*Math.PI, false);
      context.fill();
      context.closePath();
    }

    for (var i in towers) {
      towers[i].tick();
    }

    for (var i in player.towers) {
      var tower = player.towers[i];
      
      context.moveTo(tower.x * screen.width, tower.y * screen.height);
      context.fillStyle = tower.color;
      context.beginPath();
      context.arc(tower.x * screen.width, tower.y * screen.height, tower.size * ((screen.width + screen.height) / 2), 0, 2*Math.PI, false);
      context.fill();
      context.closePath();
    }

    for (var i in opponent.towers) {
      var tower = opponent.towers[i];
      
      context.moveTo(screen.width + tower.x * screen.width, tower.y * screen.height);
      context.fillStyle = tower.color;
      context.beginPath();
      context.arc(screen.width + tower.x * screen.width, tower.y * screen.height, tower.size * ((screen.width + screen.height) / 2), 0, 2*Math.PI, false);
      context.fill();
      context.closePath();
    }

    for (var i in player.enemies) {
      var enemy = player.enemies[i];

      context.fillStyle = enemy.color;
      context.beginPath();
      context.arc(enemy.x * screen.width, enemy.y * screen.height, enemy.size * ((screen.width + screen.height) / 2), 0, 2*Math.PI, false);
      context.fill();
      context.closePath();
    }

    for (var i in opponent.enemies) {
      var enemy = opponent.enemies[i];

      context.fillStyle = enemy.color;
      context.beginPath();
      context.arc(screen.width + enemy.x * screen.width, enemy.y * screen.height, enemy.size * ((screen.width + screen.height) / 2), 0, 2*Math.PI, false);
      context.fill();
      context.closePath();
    }
  }
});

document.addEventListener('click', function(event) {
  if (holding) {
    if (holding.canBuildHere()) {
      holding.built = true;
      socket.emit('built', holding);
      towers.push(holding);
      holding = null;
    }
  } else {
    for (var i=0; i<buttons.length; i++) {
      var button = buttons[i];
      if (event.clientX > buttonIndent + button.x * (buttonSize + buttonSpace) + button.side * (canvas.width/2 + statsWidth/2) && event.clientX < buttonIndent + button.x * (buttonSize + buttonSpace) + button.side * (canvas.width/2 + statsWidth/2) + button.width * buttonSize && event.clientY > canvas.height - menuHeight + buttonIndent + button.y * (buttonSize + buttonSpace) && event.clientY < canvas.height - menuHeight + buttonIndent + button.y * (buttonSize + buttonSpace) + button.height * buttonSize) {
        eval(button.onClick);
      }
    }
  }
});

document.onmousemove = function(event) {
  event = event || window.event;

  if (mouseY < canvas.height - menuHeight && event.clientY > canvas.height - menuHeight) {
    holding = null;
  }

  mouseX = event.clientX;
  mouseY = event.clientY;
};

document.addEventListener('keydown', function(event) {
  /*switch (event.keyCode) {
    case 65: // A
      movement.left = true;
      break;
    case 87: // W
      movement.up = true;
      break;
    case 68: // D
      movement.right = true;
      break;
    case 83: // S
      movement.down = true;
      break;
  }*/
});

document.addEventListener('keyup', function(event) {
  /*switch (event.keyCode) {
    case 65: // A
      movement.left = false;
      break;
    case 87: // W
      movement.up = false;
      break;
    case 68: // D
      movement.right = false;
      break;
    case 83: // S
      movement.down = false;
      break;
  }*/
});

function purchaseTower(n) {
  if (player) {
    var tower = new (eval(player.canBuild[n]))(mouseX, mouseY);

    if (player.gold >= tower.cost) {
      holding = tower;
    }
  }
}

socket.emit('new player');