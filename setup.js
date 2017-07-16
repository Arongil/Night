var scene, camera, renderer, GC;

var pi = Math.PI;

var InputFlags = {
  // 37 is the left arrow. 38 is the up arrow. 39 is the right arrow. 40 is the down arrow. 16 is the shift key. 32 is the spacebar. 65 is the a key. 68 is the d key. 83 is the s key. 87 is the w key.
  "37": false,
  "38": false,
  "39": false,
  "40": false,
  "16": false,
  "32": false,
  "65": false,
  "68": false,
  "83": false,
  "87": false,
  "click": false,
  "mousepos": {
    "x": 0,
    "y": 0,
    "dx": 0,
    "dy": 0
  }
};

class Block {
  
  constructor(x, y, z, size, type) {
    this.pos = new THREE.Vector3(x, y, z);
    this.size = size;
    
    this.type = type;
  }
  
  clone() {
    return new Block(this.pos.x, this.pos.y, this.pos.z, this.size, this.type);
  }
}

class World {
  
  constructor(size, height) {
    // this.world is a 3 dimensional array. The first layer is x, then z, then y.
    this.world = [];
    this.worldSize = size;
    this.worldHeight = height;
  }
  
  getBlock(x, y, z) {
    return this.world[x][z][y].clone();
  }
  setBlock(x, y, z, block) {
    this.world[x][z][y] = block;
  }
  
  getBlocks() {
    var blocks = [];
    for (var i = 0; i < this.world.length; i++) {
      // x
      for (var j = 0; j < this.world[i].length; j++) {
        // z
        for (var k = 0; k < this.world[i][j].length; k++) {
          // y
          blocks.push(this.getBlock(i, k, j));
        }
      }
    }
    
    return blocks;
  }
  
  init(blockSize, noiseStretch) {
    var height, block, type;
    noise.seed(Math.random());
    for (var i = 0; i < this.worldSize; i++) {
      // x
      this.world.push([]);
      for (var j = 0; j < this.worldSize; j++) {
        // z
        this.world[i].push([]);
        height = this.worldHeight/2 * (noise.simplex2(i / noiseStretch, j / noiseStretch) + 0.4 * noise.simplex2(i / noiseStretch * 4, j / noiseStretch * 4) + 1.5);
        for (var k = this.worldHeight - 1; k >= 0; k--) {
          // y
          // k goes from the maximum height to 0, adding blocks once below the noisemap value for noise2D(i / C, j / C).
          if (k > height) {
            type = "air";
          }
          else {
            type = "stone";
          }
          
          block = new Block(i, k, j, blockSize, type);
          this.world[i][j].push(block);
        }
      }
    }
  }
}

class Player {
  
  constructor(x, y, z) {
    this.pos = new THREE.Vector3(x, y, z);
    this.vel = new THREE.Vector3(0, 0, 0);
    
    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(16, 50, 16);
    this.camera.rotation.x = pi/2;
    this.camera.rotation.y = pi/2;
    
    this.onGround = false;
    
    this.speed = 1;
    this.turnSpeed = 0.02;
  }
  
  move() {
    var x = this.speed * Math.cos(this.camera.rotation.x);
    var y = this.speed * Math.sin(this.camera.rotation.x);
    
    if (InputFlags["87"]) {
      this.vel.x += y;
      this.vel.z -= x;
    }
    if (InputFlags["83"]) {
      this.vel.x -= y;
      this.vel.z += x;
    }
    if (InputFlags["65"]) {
      this.vel.x -= x;
      this.vel.z -= y;
    }
    if (InputFlags["68"]) {
      this.vel.x += x;
      this.vel.z += y;
    }
    if (InputFlags["16"]) {
      this.vel.y -= this.speed;
    }
    if (InputFlags["32"]) {
      this.vel.y += this.speed;
    }
    
    this.camera.rotation.y -= this.turnSpeed * InputFlags["mousepos"]["dx"];
    this.camera.rotation.x += this.turnSpeed * InputFlags["mousepos"]["dy"];
    InputFlags["mousepos"]["dx"] = 0;
    InputFlags["mousepos"]["dy"] = 0;
    
    this.camera.rotation.y %= 2*pi;
    if (this.camera.rotation.x > 1/2 * pi) {
      this.camera.rotation.x = 1/2 * pi;
    }
    if (this.camera.rotation.x < -pi/2) {
      this.camera.rotation.x = -pi/2;
    }
    this.camera.rotation.z %= 2*pi;
  }
  
  updatePhysics() {
    this.move();
    
    this.vel.multiplyScalar(this.onGround ? GC.GROUNDFRICTION : GC.AIRFRICTION);
    this.pos.add(this.vel);
    this.camera.position = this.pos.clone();
  }
}

class GameController {
  
  constructor() {
    this.world = new World(64, 16);
    this.blockSize = 1;
    // world.init takes two parameters: blockSize and noiseStretch, a value which controls the "abruptness" of change in the noise.
    this.world.init(1, 100);
    this.updateScene();
    
    this.player = new Player();
    
    this.AIRFRICTION = 0.98;
  }
  
  getCamera() {
    return this.player.camera;
  }
  
  update() {
    this.player.updatePhysics();
    
    renderer.render(scene, GC.getCamera());
  }
  
  updateScene() {
    scene = new THREE.Scene();
    
    var ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    var pointLight = new THREE.PointLight(0xffffff, 1, 500, 2);
    pointLight.position.set(5, 50, 5);
    scene.add(pointLight);
    
    var totalGeometry, block, blocks, possiblyVisible, geometry, cubeMesh;
    totalGeometry = new THREE.Geometry();
    blocks = this.world.getBlocks();
    
    ////
    var start = Date.now();
    ////
    
    for (var i = 0; i < blocks.length; i++) {
      if (i % Math.floor(blocks.length/100) == 0) {
        console.log(Math.floor(i / blocks.length * 100) + "% LOADED");
      }
      
      block = blocks[i];
      if (block.type != "air") {
        // Perform a basic check to determine whether the block is possibly visible: is it surrounded bu nom-air blocks? If the block is on the edge, it's automatically visible.

        if (block.pos.x != 0 && block.pos.x != this.world.world.length - 1 && block.pos.z != 0 && block.pos.z != this.world.world[0].length - 1 && block.pos.y != 0 && block.pos.y != this.world.world[0][0].length - 1) {
          // Not on the edge.
          if (this.world.getBlock(block.pos.x + 1, block.pos.y, block.pos.z).type != "air" &&
              this.world.getBlock(block.pos.x - 1, block.pos.y, block.pos.z).type != "air" &&
              this.world.getBlock(block.pos.x, block.pos.y + 1, block.pos.z).type != "air" &&
              this.world.getBlock(block.pos.x, block.pos.y - 1, block.pos.z).type != "air" &&
              this.world.getBlock(block.pos.x, block.pos.y, block.pos.z + 1).type != "air" &&
              this.world.getBlock(block.pos.x, block.pos.y, block.pos.z - 1).type != "air") {
            // The block is not on the edge and all of the surrounding blocks are solid, rendering it unseeable.
            continue;
          }
        }
        
        geometry = new THREE.BoxGeometry(this.blockSize, this.blockSize, this.blockSize);
        cubeMesh = new THREE.Mesh(geometry);

        cubeMesh.position.set(block.pos.x, block.pos.y, block.pos.z);
        
        totalGeometry.mergeMesh(cubeMesh);
      }
    }
    
    ////
    var timeTaken = Date.now() - start;
    console.log("The scene setup took " + timeTaken + " milliseconds for " + blocks.length + " blocks. That's " + (timeTaken / blocks.length) + " milliseconds per block.");
    ////
    
    var material = new THREE.MeshPhongMaterial({color: 0x00cc00});
    var totalMesh = new THREE.Mesh(totalGeometry, material);
    scene.add(totalMesh);
  }
  
}

function init() {
  scene = new THREE.Scene();

  renderer = new THREE.WebGLRenderer();
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);
  
  WIDTH = window.innerWidth;
  HEIGHT = window.innerHeight;
  HALFWIDTH = WIDTH / 2;
  HALFHEIGHT = HEIGHT / 2;
  
  window.onkeydown = function(e) {
    if (InputFlags[e.keyCode] !== undefined) {
      InputFlags[e.keyCode] = true;
    }
  };
  window.onkeyup = function(e) {
    if (InputFlags[e.keyCode] !== undefined) {
      InputFlags[e.keyCode] = false;
    }
  };
  // canvas.onmouseup = function(e) {
  //   InputFlags["click"] = true;
  // };
  document.onmousemove = function(e) {
    var x = e.clientX - window.innerWidth/2;
    
    var y = e.clientY - HALFHEIGHT - 8;
    InputFlags["mousepos"]["dx"] = x - InputFlags["mousepos"]["x"];
    InputFlags["mousepos"]["dy"] = y - InputFlags["mousepos"]["y"];
    InputFlags["mousepos"]["x"] = x;
    InputFlags["mousepos"]["y"] = y;
    
    console.log("camera.rotation.x: " + GC.getCamera().rotation.x + ", camera.rotation.y: " + GC.getCamera().rotation.y);
  };
  
  GC = new GameController();
  
  loop();
}

function loop() {
  window.requestAnimationFrame(loop);
  
  GC.update();
}
