// Get the canvas and context
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Variables
let score = 0;
let gameRunning = false;
let gameOvered = false;
let delta;
let lastTime = 0;

const birdFramesSets = [
    [ // Set 1 of bird frames
        'res/textures/bird/1-2.png',
        'res/textures/bird/1-3.png',
        'res/textures/bird/1-2.png',
        'res/textures/bird/1-1.png'
    ],
    [ // Set 2 of bird frames
        'res/textures/bird/2-2.png',
        'res/textures/bird/2-3.png',
        'res/textures/bird/2-2.png',
        'res/textures/bird/2-1.png'
    ],
    [ // Set 3 of bird frames
        'res/textures/bird/3-2.png',
        'res/textures/bird/3-3.png',
        'res/textures/bird/3-2.png',
        'res/textures/bird/3-1.png'
    ]
];

const bird = {
    y: 200, // Start bird at the middle of the canvas
    vel: 0,
    currentFrame: 0,
    texture: null,
    frames: [],

    getRect() {
        return {
            x: 50,
            y: this.y,
            width: this.texture.width,
            height: this.texture.height
        };
    },

    flap() {
        if (!gameRunning || gameOvered) return;
        this.vel = -350; // Adjusted flap velocity to prevent the bird from disappearing
    },

    draw() {
        const rotation = (8 * (this.vel / 400)) * (Math.PI / 180);
        ctx.save();
        ctx.translate(50 + this.texture.width / 2, this.y + this.texture.height / 2);
        ctx.rotate(rotation);
        ctx.drawImage(this.texture, -this.texture.width / 2, -this.texture.height / 2);
        ctx.restore();
    },

    update(delta) {
        this.currentFrame += delta * 4;
        if (this.currentFrame >= this.frames.length) {
            this.currentFrame = 0;
        }
        this.texture = this.frames[Math.floor(this.currentFrame)];

        if (gameRunning || gameOvered) { // Allow bird to fall even after game is over
            this.vel += delta * 1200;
            this.y += this.vel * delta;

            // Ensure the bird doesn't go off the screen
            if (this.y < 0) {
                this.y = 0;
                this.vel = 0;
            }
            if (this.y + this.texture.height > backgroundTexture.height) {
                this.y = backgroundTexture.height - this.texture.height;
                this.vel = 0;
            }
        }
    },

    reset() {
        this.y = 200; // Reset bird to the middle of the canvas
        this.vel = 0;
        this.currentFrame = 0;

        return new Promise((resolve) => {
            // Select a random bird frame set
            const randomSetIndex = Math.floor(Math.random() * birdFramesSets.length);
            const selectedFrameSet = birdFramesSets[randomSetIndex];

            // Load the frames of the selected set
            Promise.all(
                selectedFrameSet.map(src => {
                    const img = new Image();
                    img.src = src;
                    return new Promise(resolve => {
                        img.onload = () => resolve(img);
                    });
                })
            ).then(loadedFrames => {
                this.frames = loadedFrames;
                this.texture = this.frames[0];
                resolve(); // Resolve once the frames are loaded
            });
        });
    }
};

const pipes = [];
const pipeInterval = 3500; // Time in milliseconds
let lastPipeTime = 0;

const ground = {
    offset: 0,

    draw(delta) {
        if (gameRunning && !gameOvered) {
            this.offset -= delta * 100;
            if (this.offset <= -24) {
                this.offset += 24;
            }
        }

        ctx.drawImage(groundTexture, this.offset, backgroundTexture.height);
        ctx.drawImage(groundTexture, this.offset + groundTexture.width, backgroundTexture.height);
    }
};

// Textures and assets
const backgrounds = {
    day: 'res/textures/background/day.png',
    night: 'res/textures/background/night.png',
    impossible: 'res/textures/background/impossible.png',
    map1: 'res/textures/background/map1.png',
    map2: 'res/textures/background/map2.png',
    map3: 'res/textures/background/map3.png',
    map4: 'res/textures/background/map4.png',
    map5: 'res/textures/background/map5.png',
    map6: 'res/textures/background/map6.png',
    windowex: 'res/textures/background/windowex.png',
    error: 'res/textures/background/error.png'
    
};

const backgroundTexture = new Image();
backgroundTexture.src = backgrounds.day; // Start with 'day' background

const groundTexture = new Image();
groundTexture.src = 'res/textures/ground.png';

const font = 'bold 24px Arial';

// Load pipe texture
const pipeTexture = new Image();
pipeTexture.src = 'res/textures/pipe.png';

// Load game over texture
const gameOverTexture = new Image();
gameOverTexture.src = 'res/textures/gameover.png';

// Load start button texture
const startButtonTexture = new Image();
startButtonTexture.src = 'res/textures/tryagain.png';

// Utility functions
function intersects(rect1, rect2) {
    return (
        rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y
    );
}

// Function to draw a pipe
function drawPipe(x, y, flipped) {
    ctx.save();
    ctx.translate(x, y);
    if (flipped) {
        ctx.scale(1, -1); // Flip the image vertically
        ctx.drawImage(pipeTexture, 0, -pipeTexture.height);
    } else {
        ctx.drawImage(pipeTexture, 0, 0);
    }
    ctx.restore();
}

// Game reset function
function resetGame() {
    gameRunning = false;
    gameOvered = false;
    score = 0;

    // Wait for the bird frames to load before resetting the game
    bird.reset().then(() => {
        pipes.length = 0;
    });
}

// Variable to track whether the start button is shown
let showStartButtonFlag = false;

// Function to draw the start button
function drawStartButton() {
    if (showStartButtonFlag) {
        ctx.drawImage(
            startButtonTexture, 
            canvas.width / 2 - startButtonTexture.width / 2, 
            canvas.height / 2 + 100 // Position the button below the "Game Over" text
        );
    }
}

// Add an event listener to detect clicks on the start button
canvas.addEventListener('click', (e) => {
    if (showStartButtonFlag) {
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        const buttonX = canvas.width / 2 - startButtonTexture.width / 2;
        const buttonY = canvas.height / 2 + 100;
        const buttonWidth = startButtonTexture.width;
        const buttonHeight = startButtonTexture.height;

        // Check if the click is within the bounds of the start button
        if (
            clickX >= buttonX &&
            clickX <= buttonX + buttonWidth &&
            clickY >= buttonY &&
            clickY <= buttonY + buttonHeight
        ) {
            location.reload(); // Reload the page to restart the game
        }
    }
});


// Update background based on the score, cycling through the maps every 5 points
function updateBackground() {
    // Create an array of the maps you want to cycle through
    const mapCycle = [
        backgrounds.day,     // Default day map
        backgrounds.map1,    // Map 1
        backgrounds.map2,    // Map 2
        backgrounds.windowex, // Special map 1
        backgrounds.error,     // Special map 2
        backgrounds.map3,    // Map 3
        backgrounds.map4,    // Map 4
        backgrounds.map5,    // Map 5
        backgrounds.map6,    // Map 6
        backgrounds.impossible
        
    ];
    
    
    // Calculate the index based on the score divided by 5
    const mapIndex = Math.floor(score / 5) % mapCycle.length;

    // Update the background texture
    backgroundTexture.src = mapCycle[mapIndex];
}



// Update function
function update(delta) {
    bird.update(delta);

    if (!gameOvered) {
        pipes.forEach(pipe => {
            pipe.x -= 100 * delta;

            const birdRect = bird.getRect();
            if (
                intersects(birdRect, pipe.getUpperRect()) ||
                intersects(birdRect, pipe.getLowerRect())
            ) {
                gameOvered = true;
            }

            if (pipe.x + pipeTexture.width < birdRect.x && !pipe.scored) {
                pipe.scored = true;
                score++;
                updateBackground(); // Update the background when the score changes
            }
        });

        // Add new pipes at intervals
        if (gameRunning && !gameOvered) {
            if (performance.now() - lastPipeTime > pipeInterval) {
                lastPipeTime = performance.now();

                const y = 100 + (Math.random() * 5 - 3) * 50;
                pipes.push({
                    x: canvas.width,
                    y: y,
                    scored: false,
                    getUpperRect() {
                        return { x: this.x, y: this.y + 340, width: pipeTexture.width, height: pipeTexture.height };
                    },
                    getLowerRect() {
                        return { x: this.x, y: this.y - 340, width: pipeTexture.width, height: pipeTexture.height };
                    },
                    draw() {
                        drawPipe(this.x, this.y + 340, false); // Upper pipe
                        drawPipe(this.x, this.y - 340, true);  // Lower pipe
                    }
                });
            }

            if (pipes.length > 4) {
                pipes.shift();
            }
        }
    } else {
        // Ensure bird falls to the ground when game is over
        bird.vel += delta * 1200;
        bird.y += bird.vel * delta;

        if (bird.y + bird.texture.height >= backgroundTexture.height) {
            bird.y = backgroundTexture.height - bird.texture.height;
            bird.vel = 0;
        }
    }
}

// Draw function
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw background
    ctx.drawImage(backgroundTexture, 0, 0);

    // Draw pipes
    pipes.forEach(pipe => pipe.draw());

    // Draw ground
    ground.draw(delta);

    // Draw bird
    bird.draw();

    // Draw score
    ctx.fillStyle = '#000';
    ctx.font = font;
    ctx.fillText(`Score: ${score}`, canvas.width / 2 - 40, 30);

    // Draw game over screen if game over
    if (gameOvered && bird.y + bird.texture.height >= backgroundTexture.height) {
        ctx.drawImage(gameOverTexture, canvas.width / 2 - gameOverTexture.width / 2, canvas.height / 2 - gameOverTexture.height / 2);

        // Show the start button
        showStartButtonFlag = true;
        drawStartButton();
    }
}

// Main game loop
function gameLoop(timestamp) {
    delta = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    update(delta);
    draw();

    if (!gameOvered || bird.y + bird.texture.height < backgroundTexture.height) {
        requestAnimationFrame(gameLoop);
    }
}

// Input handling
canvas.addEventListener('mousedown', () => {
    if (!gameRunning) {
        gameRunning = true;
        lastPipeTime = performance.now();
        pipes.push({
            x: canvas.width,
            y: 100 + (Math.random() * 5 - 3) * 50,
            scored: false,
            getUpperRect() {
                return { x: this.x, y: this.y + 340, width: pipeTexture.width, height: pipeTexture.height };
            },
            getLowerRect() {
                return { x: this.x, y: this.y - 340, width: pipeTexture.width, height: pipeTexture.height };
            },
            draw() {
                drawPipe(this.x, this.y + 340, false); // Upper pipe
                drawPipe(this.x, this.y - 340, true);  // Lower pipe
            }
        });
    } else if (gameOvered) {
        resetGame();
    }
    bird.flap();
});

// Preload bird frames
bird.reset().then(() => {
    requestAnimationFrame(gameLoop);
});
