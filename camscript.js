// DOM Elements
const bird = document.querySelector('.bird');
const message = document.querySelector('.message');
const score_val = document.querySelector('.score_val');
const score_title = document.querySelector('.score_title');
const video = document.getElementById('video-feed');
const handStatus = document.querySelector('.hand-status');

// Canvas for hand skeleton
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

// Game Variables
let move_speed = 5;
let gravity = 0.3;
let bird_dy = 0;
let bird_y = 0;
let game_state = 'Start';
let pipe_separation = 0;
let pipe_gap = 35;
let background = document.querySelector('.background').getBoundingClientRect();

// Hand Tracking Variables
let handposeModel;
let isPinching = false;
let lastPinchTime = 0;

//button

// Initialize Game
window.addEventListener('load', initGame);

async function initGame() {
    initKeyboardControls();
    try {
        await initHandTracking();
    } catch (error) {
        console.error("Hand tracking initialization failed:", error);
        handStatus.textContent = "Hand tracking disabled - using keyboard";
    }
}

// Keyboard Controls
function initKeyboardControls() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && game_state !== 'Play') startGame();
        if ((e.key === 'ArrowUp' || e.key === ' ') && game_state === 'Play') handleJump();
    });
}

// Jump
function handleJump() {
    if (game_state !== 'Play') {
        startGame();
        return;
    }
    bird_dy = -7.6;
    bird.style.transform = 'rotate(-30deg)';
    setTimeout(() => bird.style.transform = 'rotate(0deg)', 200);
}

// Start Game
function startGame() {
    document.querySelectorAll('.pipe_sprite').forEach(pipe => pipe.remove());
    bird_dy = 0;
    bird_y = window.innerHeight * 0.4;
    bird.style.top = bird_y + 'px';
    game_state = 'Play';
    message.innerHTML = '';
    score_val.innerHTML = '0';
    move();
    applyGravity();
    createPipe();
}

// Apply Gravity
function applyGravity() {
    if (game_state !== 'Play') return;

    bird_dy += gravity;
    bird_y += bird_dy;

    let bird_rect = bird.getBoundingClientRect();
    if (bird_y <= 0 || bird_rect.bottom >= background.bottom) {
        endGame();
        return;
    }

    bird.style.top = bird_y + 'px';
    requestAnimationFrame(applyGravity);
}

// Move Pipes & Check Collision
function move() {
    if (game_state !== 'Play') return;

    let pipes = document.querySelectorAll('.pipe_sprite');
    let bird_rect = bird.getBoundingClientRect();

    pipes.forEach(pipe => {
        let pipe_rect = pipe.getBoundingClientRect();

        if (pipe_rect.right <= 0) {
            pipe.remove();
        } else {
            // Collision
            if (
                bird_rect.left < pipe_rect.left + pipe_rect.width &&
                bird_rect.left + bird_rect.width > pipe_rect.left &&
                bird_rect.top < pipe_rect.top + pipe_rect.height &&
                bird_rect.top + bird_rect.height > pipe_rect.top
            ) {
                endGame();
                return;
            }

            // Scoring
            if (
                pipe_rect.right < bird_rect.left &&
                pipe_rect.right + move_speed >= bird_rect.left &&
                pipe.getAttribute('data-score') === '1'
            ) {
                score_val.innerHTML = +score_val.innerHTML + 1;
            }

            pipe.style.left = pipe_rect.left - move_speed + 'px';
        }
    });

    requestAnimationFrame(move);
}

// Pipe Creation
function createPipe() {
    if (game_state !== 'Play') return;

    if (pipe_separation > 115) {
        pipe_separation = 0;
        let pipe_pos = Math.floor(Math.random() * 43) + 8;

        // Top Pipe
        let topPipe = document.createElement('img');
        topPipe.src = 'assets/pipe-top.png';
        topPipe.className = 'pipe_sprite';
        topPipe.style.top = pipe_pos - 70 + 'vh';
        topPipe.style.left = '100vw';
        document.body.appendChild(topPipe);

        // Bottom Pipe
        let bottomPipe = document.createElement('img');
        bottomPipe.src = 'assets/pipe-bottom.png';
        bottomPipe.className = 'pipe_sprite';
        bottomPipe.style.top = pipe_pos + pipe_gap + 'vh';
        bottomPipe.style.left = '100vw';
        bottomPipe.setAttribute('data-score', '1');
        document.body.appendChild(bottomPipe);
    }

    pipe_separation++;
    requestAnimationFrame(createPipe);
}

// End Game
function endGame() {
    game_state = 'End';
    message.innerHTML = 'Game Over<br>Press Enter/Pinch To Restart';
}

// ========== Hand Tracking ==========

// Initialize Hand Tracking
async function initHandTracking() {
    await tf.setBackend('webgl');
    handposeModel = await handpose.load();

    const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 200, height: 150, facingMode: 'user' }
    });
    video.srcObject = stream;

    video.onloadedmetadata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        document.body.appendChild(canvas);
        detectHand();
    };
}

// Hand Detection
async function detectHand() {
    if (!handposeModel) return;

    try {
        const predictions = await handposeModel.estimateHands(video);
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (predictions.length > 0) {
            const landmarks = predictions[0].landmarks;
            const indexTip = landmarks[8];
            const thumbTip = landmarks[4];

            drawHandSkeleton(landmarks);

            const dx = indexTip[0] - thumbTip[0];
            const dy = indexTip[1] - thumbTip[1];
            const distance = Math.sqrt(dx * dx + dy * dy);

            isPinching = distance < 30;

            if (isPinching && Date.now() - lastPinchTime > 300) {
                lastPinchTime = Date.now();
                handleJump();
            }

            handStatus.textContent = isPinching ? "Pinching - Fly!" : "Hand detected";
        } else {
            handStatus.textContent = "Show your hand to play";
        }
    } catch (error) {
        console.error("Hand detection error:", error);
    }

    requestAnimationFrame(detectHand);
}

// Draw Hand Skeleton
function drawHandSkeleton(landmarks) {
    const connections = [
        [0, 1], [1, 2], [2, 3], [3, 4],
        [0, 5], [5, 6], [6, 7], [7, 8],
        [0, 9], [9, 10], [10, 11], [11, 12],
        [0, 13], [13, 14], [14, 15], [15, 16],
        [0, 17], [17, 18], [18, 19], [19, 20]
    ];

    ctx.strokeStyle = '#FF0000';
    ctx.lineWidth = 2;

    connections.forEach(([start, end]) => {
        const [x1, y1] = landmarks[start];
        const [x2, y2] = landmarks[end];
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    });

    ctx.fillStyle = '#FF0000';
    landmarks.forEach(([x, y]) => {
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.fill();
    });
}

async function toggleCamera() {
  cameraEnabled = !cameraEnabled;

  if (!cameraEnabled) {
      handStatus.textContent = "Camera OFF - using keyboard";
      if (videoStream) {
          videoStream.getTracks().forEach(track => track.stop());
          video.srcObject = null;
      }
      canvas.remove();
  } else {
      handStatus.textContent = "Camera ON - loading hand tracking...";
      try {
          await initHandTracking();
      } catch (error) {
          console.error("Error re-enabling camera:", error);
          handStatus.textContent = "Hand tracking failed to re-enable";
      }
  }
}
