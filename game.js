const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game state
let score = 0;
let highScore = parseInt(localStorage.getItem('flappyHighScore') || '0');
let gameRunning = false;
let gameOvered = false;
let gameOverSettled = false;
let delta = 0;
let lastTime = 0;

// Bird animation frame sets — fixed missing commas
const birdFramesSets = [
    [
        'res/textures/bird/2-1.png',
        'res/textures/bird/2-2.png',
        'res/textures/bird/2-3.png',
        'res/textures/bird/2-4.png'
    ],
    [
        'res/textures/bird/1-1.png',
        'res/textures/bird/1-2.png',
        'res/textures/bird/1-3.png'
    ],
    [
        'res/textures/bird/3-1.png',
        'res/textures/bird/3-2.png',
        'res/textures/bird/3-3.png'
    ]
];

// ─── Bird ────────────────────────────────────────────────────────────────────
const bird = {
    x: 80,
    y: 300,
    vel: 0,
    currentFrame: 0,
    texture: null,
    frames: [],
    hitFlash: 0,

    getRect() {
        const pad = 5;
        return {
            x: this.x + pad,
            y: this.y + pad,
            width: this.texture.width - pad * 2,
            height: this.texture.height - pad * 2
        };
    },

    flap() {
        if (!gameRunning || gameOvered) return;
        this.vel = -360;
        playSound('wing');
    },

    draw() {
        if (!this.texture) return;
        const maxAngle = 30 * (Math.PI / 180);
        const rotation = Math.max(-maxAngle, Math.min(maxAngle, (this.vel / 400) * maxAngle * 2.5));

        ctx.save();
        ctx.translate(this.x + this.texture.width / 2, this.y + this.texture.height / 2);
        ctx.rotate(rotation);

        // Red flash on hit
        if (this.hitFlash > 0) {
            ctx.globalAlpha = 0.6;
            ctx.filter = 'brightness(5) saturate(0) sepia(1) hue-rotate(-20deg)';
        }
        ctx.drawImage(this.texture, -this.texture.width / 2, -this.texture.height / 2);
        ctx.restore();

        if (this.hitFlash > 0) this.hitFlash -= delta;
    },

    update(delta) {
        this.currentFrame += delta * 8;
        if (this.currentFrame >= this.frames.length) this.currentFrame = 0;
        if (this.frames.length > 0) this.texture = this.frames[Math.floor(this.currentFrame)];

        if (!this.texture) return;

        if (gameRunning || gameOvered) {
            this.vel += delta * 1150;
            this.y += this.vel * delta;

            if (this.y < 0) {
                this.y = 0;
                this.vel = 0;
            }
            const groundY = getGroundY();
            if (this.y + this.texture.height >= groundY) {
                this.y = groundY - this.texture.height;
                this.vel = 0;
                if (gameOvered) gameOverSettled = true;
            }
        }
    },

    reset() {
        this.y = 300;
        this.vel = 0;
        this.currentFrame = 0;
        this.hitFlash = 0;

        return new Promise((resolve) => {
            const idx = Math.floor(Math.random() * birdFramesSets.length);
            Promise.all(
                birdFramesSets[idx].map(src => {
                    const img = new Image();
                    img.src = src;
                    return new Promise(r => { img.onload = () => r(img); img.onerror = () => r(img); });
                })
            ).then(frames => {
                this.frames = frames;
                this.texture = frames[0];
                resolve();
            });
        });
    }
};

// ─── Pipes ───────────────────────────────────────────────────────────────────
const pipes = [];
const PIPE_GAP = 175;
const BASE_PIPE_INTERVAL = 2000;
let lastPipeTime = 0;

function createPipe() {
    const groundY = getGroundY();
    const minGapTop = 120;
    const maxGapTop = groundY - PIPE_GAP - 80;
    const gapTop = minGapTop + Math.random() * (maxGapTop - minGapTop);
    const gapBottom = gapTop + PIPE_GAP;

    return {
        x: canvas.width + 10,
        gapTop,
        gapBottom,
        scored: false,

        getUpperRect() {
            return { x: this.x, y: 0, width: pipeTexture.width || 52, height: this.gapTop };
        },
        getLowerRect() {
            return { x: this.x, y: this.gapBottom, width: pipeTexture.width || 52, height: canvas.height };
        },

        draw() {
            if (!pipeTexture.complete || !pipeTexture.naturalWidth) return;

            // Upper pipe (flip vertically, bottom edge at gapTop)
            ctx.save();
            ctx.translate(this.x, this.gapTop);
            ctx.scale(1, -1);
            ctx.drawImage(pipeTexture, 0, 0);
            ctx.restore();

            // Lower pipe (top edge at gapBottom)
            ctx.drawImage(pipeTexture, this.x, this.gapBottom);
        }
    };
}

// ─── Ground ──────────────────────────────────────────────────────────────────
const ground = {
    offset: 0,

    draw(delta) {
        if (!groundTexture.complete || !groundTexture.naturalWidth) return;
        const groundSpeed = 150 + Math.min(score * 3, 250);

        if (gameRunning && !gameOvered) {
            this.offset -= delta * groundSpeed;
            if (this.offset <= -groundTexture.width) this.offset += groundTexture.width;
        }

        const y = getGroundY();
        for (let x = this.offset; x < canvas.width + groundTexture.width; x += groundTexture.width) {
            ctx.drawImage(groundTexture, x, y);
        }
    },

    reset() {
        this.offset = 0;
    }
};

// ─── Textures ─────────────────────────────────────────────────────────────────
const backgrounds = {
    day: 'res/textures/background/day.png',
    night: 'res/textures/background/night.png',
    map1: 'res/textures/background/map1.png',
    map2: 'res/textures/background/map2.png',
    map3: 'res/textures/background/map3.png',
    map4: 'res/textures/background/map4.png',
    map5: 'res/textures/background/map5.png',
    map6: 'res/textures/background/map6.png',
    windowxp: 'res/textures/background/windowxp.png',
    error: 'res/textures/background/error.png',
    impossible: 'res/textures/background/impossible.png'
};

const mapCycle = [
    backgrounds.day, backgrounds.map1, backgrounds.map2,
    backgrounds.windowxp, backgrounds.error, backgrounds.map3,
    backgrounds.map4, backgrounds.map5, backgrounds.map6,
    backgrounds.impossible
];

const backgroundTexture = new Image();
backgroundTexture.src = backgrounds.day;

const groundTexture = new Image();
groundTexture.src = 'res/textures/ground.png';

const pipeTexture = new Image();
pipeTexture.src = 'res/textures/pipe.png';

const gameOverTexture = new Image();
gameOverTexture.src = 'res/textures/gameover.png';

const logoTexture = new Image();
logoTexture.src = 'res/textures/logo.png';

function getGroundY() {
    if (backgroundTexture.complete && backgroundTexture.naturalHeight) {
        return backgroundTexture.naturalHeight;
    }
    return canvas.height - (groundTexture.naturalHeight || 112);
}

// ─── Sound ───────────────────────────────────────────────────────────────────
let soundEnabled = true;
const soundBuffers = {};

function loadSound(name, src) {
    const audio = new Audio(src);
    audio.preload = 'auto';
    soundBuffers[name] = audio;
}

loadSound('wing', 'res/sounds/sfx_wing.wav');
loadSound('hit', 'res/sounds/sfx_hit.wav');
loadSound('point', 'res/sounds/sfx_point.wav');
loadSound('die', 'res/sounds/sfx_die.wav');

function playSound(name) {
    if (!soundEnabled) return;
    try {
        const s = soundBuffers[name];
        if (!s) return;
        const clone = s.cloneNode();
        clone.volume = 0.4;
        clone.play().catch(() => { });
    } catch (e) { }
}

// Synthesized level-up jingle played when the map changes
function playMapChangeSound() {
    if (!soundEnabled) return;
    try {
        const AudioCtx = window.AudioContext || /** @type {any} */ (window).webkitAudioContext;
        const ac = new AudioCtx();
        // Three ascending notes: C5 → E5 → G5
        const notes = [523.25, 659.25, 783.99];
        notes.forEach((freq, i) => {
            const osc = ac.createOscillator();
            const gain = ac.createGain();
            osc.connect(gain);
            gain.connect(ac.destination);
            osc.type = 'sine';
            osc.frequency.value = freq;
            const start = ac.currentTime + i * 0.12;
            const end = start + 0.18;
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(0.35, start + 0.02);
            gain.gain.linearRampToValueAtTime(0, end);
            osc.start(start);
            osc.stop(end);
        });
    } catch (e) { }
}

// ─── Utilities ───────────────────────────────────────────────────────────────
function intersects(r1, r2) {
    return (
        r1.x < r2.x + r2.width && r1.x + r1.width > r2.x &&
        r1.y < r2.y + r2.height && r1.y + r1.height > r2.y
    );
}

let lastMapIndex = 0;

function updateBackground() {
    const idx = Math.floor(score / 10) % mapCycle.length;
    if (idx !== lastMapIndex) {
        lastMapIndex = idx;
        backgroundTexture.src = mapCycle[idx];
        playMapChangeSound();
    }
}

// ─── Score display ────────────────────────────────────────────────────────────
function drawText(text, x, y, size, fillColor, strokeColor) {
    ctx.font = `bold ${size}px Arial`;
    ctx.textAlign = 'center';
    ctx.lineWidth = size / 10;
    if (strokeColor) {
        ctx.strokeStyle = strokeColor;
        ctx.strokeText(text, x, y);
    }
    ctx.fillStyle = fillColor;
    ctx.fillText(text, x, y);
    ctx.textAlign = 'left';
}

function drawScore() {
    drawText(`${score}`, canvas.width / 2, 65, 52, 'white', '#333');
}

// ─── Screens ──────────────────────────────────────────────────────────────────
function drawStartScreen() {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (logoTexture.complete && logoTexture.naturalWidth) {
        const lx = canvas.width / 2 - logoTexture.width / 2;
        ctx.drawImage(logoTexture, lx, 130);
    } else {
        drawText('FLAPPY BIRD', canvas.width / 2, 200, 36, '#ffe066', '#333');
    }

    drawText('Tap  /  Click  /  Space  to Start', canvas.width / 2, canvas.height / 2 + 60, 20, 'white', '#333');

    if (highScore > 0) {
        drawText(`Best: ${highScore}`, canvas.width / 2, canvas.height / 2 + 100, 22, '#ffe066', '#333');
    }
}

function drawGameOverScreen() {
    if (!gameOverSettled) return;

    if (gameOverTexture.complete && gameOverTexture.naturalWidth) {
        ctx.drawImage(gameOverTexture,
            canvas.width / 2 - gameOverTexture.width / 2,
            canvas.height / 2 - 120
        );
    } else {
        drawText('GAME OVER', canvas.width / 2, canvas.height / 2 - 60, 36, '#ff4444', '#333');
    }

    // Score panel
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    roundRect(ctx, canvas.width / 2 - 110, canvas.height / 2 - 20, 220, 100, 12);
    ctx.fill();

    drawText(`Score: ${score}`, canvas.width / 2, canvas.height / 2 + 20, 24, 'white');
    drawText(`Best:  ${highScore}`, canvas.width / 2, canvas.height / 2 + 55, 24, '#ffe066');

    drawText('Tap / Click / Space to Restart', canvas.width / 2, canvas.height / 2 + 125, 18, 'white', '#333');
}

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}

// ─── Game logic ───────────────────────────────────────────────────────────────
function resetGame() {
    score = 0;
    gameRunning = false;
    gameOvered = false;
    gameOverSettled = false;
    pipes.length = 0;
    lastPipeTime = 0;
    lastMapIndex = 0;
    ground.reset();
    backgroundTexture.src = mapCycle[0];
    bird.reset();
}

function startGame() {
    gameRunning = true;
    lastPipeTime = performance.now();
    pipes.push(createPipe());
    bird.flap();
}

function handleInput() {
    if (!gameRunning && !gameOvered) {
        startGame();
    } else if (gameOvered && gameOverSettled) {
        resetGame();
    } else if (gameRunning && !gameOvered) {
        bird.flap();
    }
}

function update(delta) {
    bird.update(delta);

    if (gameRunning && !gameOvered) {
        const pipeSpeed = 150 + Math.min(score * 4, 280);
        const birdRect = bird.getRect();

        for (let i = pipes.length - 1; i >= 0; i--) {
            const pipe = pipes[i];
            pipe.x -= pipeSpeed * delta;

            // Collision detection
            if (
                intersects(birdRect, pipe.getUpperRect()) ||
                intersects(birdRect, pipe.getLowerRect())
            ) {
                gameOvered = true;
                bird.hitFlash = 0.4;
                playSound('hit');
                setTimeout(() => playSound('die'), 350);

                if (score > highScore) {
                    highScore = score;
                    localStorage.setItem('flappyHighScore', highScore);
                }
                break;
            }

            // Score point
            if (!pipe.scored && pipe.x + (pipeTexture.naturalWidth || 52) < birdRect.x) {
                pipe.scored = true;
                score++;
                playSound('point');
                updateBackground();
            }

            // Remove off-screen pipes
            if (pipe.x + (pipeTexture.naturalWidth || 52) < 0) {
                pipes.splice(i, 1);
            }
        }

        // Spawn new pipe
        const interval = Math.max(1200, BASE_PIPE_INTERVAL - score * 20);
        if (performance.now() - lastPipeTime > interval) {
            lastPipeTime = performance.now();
            pipes.push(createPipe());
        }
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    if (backgroundTexture.complete && backgroundTexture.naturalWidth) {
        ctx.drawImage(backgroundTexture, 0, 0);
    } else {
        ctx.fillStyle = '#70c5ce';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    pipes.forEach(p => p.draw());
    ground.draw(delta);
    bird.draw();

    if (gameRunning || gameOvered) drawScore();
    if (!gameRunning && !gameOvered) drawStartScreen();
    if (gameOvered) drawGameOverScreen();
}

// ─── Main loop ────────────────────────────────────────────────────────────────
function gameLoop(timestamp) {
    delta = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    update(delta);
    draw();

    requestAnimationFrame(gameLoop); // always keep looping
}

// ─── Input ────────────────────────────────────────────────────────────────────
canvas.addEventListener('mousedown', handleInput);

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleInput();
}, { passive: false });

document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        handleInput();
    }
});

// Sound toggle
const soundBtn = document.getElementById('soundToggle');
if (soundBtn) {
    soundBtn.addEventListener('click', () => {
        soundEnabled = !soundEnabled;
        soundBtn.textContent = soundEnabled ? '🔊' : '🔇';
    });
}

// ─── Boot ─────────────────────────────────────────────────────────────────────
bird.reset().then(() => {
    requestAnimationFrame(gameLoop);
});
