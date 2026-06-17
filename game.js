const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreValue = document.getElementById("scoreValue");
const bestValue = document.getElementById("bestValue");
const overlay = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlayText = document.getElementById("overlayText");
const startButton = document.getElementById("startButton");

const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 2));
const minSpeed = 330;
const maxSpeed = 1200;
const targetJumpHeight = 76;
const audioSources = {
  jump: "./assets/audio/youshi-zaiwo.m4a",
  flourish: "./assets/audio/bobo-shengji.m4a",
  fail: "./assets/audio/wobu-mingbai.m4a",
};
const audioPreloads = Object.values(audioSources).map((src) => {
  const audio = new Audio(src);
  audio.preload = "auto";
  return audio;
});
const runnerHeadImage = new Image();
runnerHeadImage.src = "./assets/images/character-reference-close.png";

let width = 0;
let height = 0;
let groundY = 0;
let lastTime = 0;
let running = false;
let gameOver = false;
let score = 0;
let bestScore = Number(localStorage.getItem("adv-run-best") || 0);
let speed = minSpeed;
let obstacleTimer = 0;
let jumpVoiceCount = 0;
let trackOffset = 0;

const guards = [];
const dusts = [];

const runner = {
  x: 86,
  y: 0,
  w: 28,
  h: 54,
  vy: 0,
  gravity: 1750,
  grounded: true,
  anim: 0,
  dead: false,
};

function resize() {
  const rect = canvas.getBoundingClientRect();
  width = rect.width;
  height = rect.height;
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  groundY = Math.round(height * 0.78);
  if (runner.grounded) {
    runner.y = groundY - runner.h;
  }
}

function reset() {
  running = true;
  gameOver = false;
  score = 0;
  speed = minSpeed;
  obstacleTimer = 0.9;
  jumpVoiceCount = 0;
  trackOffset = 0;
  guards.length = 0;
  dusts.length = 0;
  runner.vy = 0;
  runner.gravity = 1750;
  runner.grounded = true;
  runner.dead = false;
  runner.anim = 0;
  runner.y = groundY - runner.h;
  hideOverlay();
  updateScore();
}

function updateScore() {
  scoreValue.textContent = String(Math.floor(score));
  bestValue.textContent = String(Math.floor(bestScore));
}

function showOverlay(title, text, buttonLabel) {
  overlayTitle.textContent = title;
  overlayText.textContent = text;
  startButton.textContent = buttonLabel;
  overlay.classList.remove("is-hidden");
}

function hideOverlay() {
  overlay.classList.add("is-hidden");
}

function saveBest() {
  bestScore = Math.max(bestScore, score);
  localStorage.setItem("adv-run-best", String(Math.floor(bestScore)));
  updateScore();
}

function audioPlaybackRate() {
  return 1 + speedProgress() * 0.35;
}

function playAudio(src) {
  const audio = new Audio(src);
  audio.playbackRate = audioPlaybackRate();
  audio.play().catch(() => {});
  audio.addEventListener("ended", () => {
    audio.remove();
  });
  return audio;
}

function playVoice() {
  playAudio(audioSources.jump);
}

function playFlourishVoice() {
  playAudio(audioSources.flourish);
}

function playFailVoice() {
  playAudio(audioSources.fail);
}

function nextObstacleDelay() {
  const baseDelay = Math.max(0.62, 0.98 - ((speed - minSpeed) / 820));
  const jitter = (Math.random() - 0.5) * 0.14;
  const minDelay = Math.max(0.56, 150 / speed);
  const maxDelay = Math.max(minDelay + 0.06, 0.98 - ((speed - minSpeed) / 1400));
  return Math.min(maxDelay, Math.max(minDelay, baseDelay + jitter));
}

function speedProgress() {
  return Math.max(0, Math.min(1, (speed - minSpeed) / (maxSpeed - minSpeed)));
}

function currentJumpPhysics() {
  const progress = speedProgress();
  const airtime = 0.68 - progress * 0.24;
  return {
    gravity: (8 * targetJumpHeight) / (airtime * airtime),
    velocity: (4 * targetJumpHeight) / airtime,
  };
}

function jump() {
  if (!running) {
    reset();
  }
  if (!runner.grounded) return;
  runner.grounded = false;
  const jumpPhysics = currentJumpPhysics();
  runner.gravity = jumpPhysics.gravity;
  runner.vy = -jumpPhysics.velocity;
  jumpVoiceCount += 1;
  if (jumpVoiceCount % 10 === 0) {
    playFlourishVoice();
  } else {
    playVoice();
  }
  for (let i = 0; i < 6; i += 1) {
    dusts.push({
      x: runner.x + 10,
      y: runner.y + runner.h - 2,
      vx: -30 + Math.random() * 30,
      vy: -40 - Math.random() * 45,
      life: 0.35 + Math.random() * 0.15,
      size: 2 + Math.random() * 2,
    });
  }
}

function spawnGuard() {
  const h = 44 + (Math.random() < 0.38 ? 8 : 0);
  guards.push({
    x: width + 24,
    y: groundY - h,
    w: 26,
    h,
    stride: Math.random() * Math.PI * 2,
    arm: Math.random() * Math.PI * 2,
  });
}

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function fail() {
  running = false;
  gameOver = true;
  runner.dead = true;
  playFailVoice();
  saveBest();
  showOverlay("游戏结束", "点击按钮重新来一局。", "重新开始");
}

function update(dt) {
  if (!running) return;

  score += dt * 10;
  speed = Math.min(maxSpeed, speed + dt * 18);
  const speedFactor = speed / minSpeed;
  runner.anim += dt * (9 + speedFactor * 3.4);
  trackOffset = (trackOffset + speed * dt * 1.05) % 26;

  runner.vy += runner.gravity * dt;
  runner.y += runner.vy * dt;
  if (runner.y >= groundY - runner.h) {
    runner.y = groundY - runner.h;
    runner.vy = 0;
    runner.grounded = true;
  }

  obstacleTimer -= dt;
  if (obstacleTimer <= 0) {
    spawnGuard();
    obstacleTimer = nextObstacleDelay();
  }

  for (let i = guards.length - 1; i >= 0; i -= 1) {
    const guard = guards[i];
    guard.x -= speed * dt;
    guard.stride += dt * (10 + speedFactor * 3);
    guard.arm += dt * (10 + speedFactor * 3);
    if (guard.x + guard.w < -40) guards.splice(i, 1);
    if (overlaps(
      { x: runner.x + 4, y: runner.y + 4, w: runner.w - 8, h: runner.h - 4 },
      { x: guard.x + 6, y: guard.y + 4, w: 18, h: guard.h - 2 }
    )) {
      fail();
    }
  }

  for (let i = dusts.length - 1; i >= 0; i -= 1) {
    const dust = dusts[i];
    dust.life -= dt;
    dust.vy += 180 * dt;
    dust.x += dust.vx * dt;
    dust.y += dust.vy * dt;
    if (dust.life <= 0) dusts.splice(i, 1);
  }

  updateScore();
}

function drawBackground() {
  ctx.fillStyle = "#f9f9f7";
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = "#deded9";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, groundY + 16.5);
  ctx.lineTo(width, groundY + 16.5);
  ctx.stroke();

  ctx.fillStyle = "#ecece8";
  ctx.fillRect(0, groundY + 12, width, 18);

  ctx.strokeStyle = "#c7c7c2";
  for (let x = 0; x < width; x += 26) {
    ctx.beginPath();
    ctx.moveTo(x - trackOffset, groundY + 13);
    ctx.lineTo(x + 16 - trackOffset, groundY + 13);
    ctx.stroke();
  }
}

function drawRunner() {
  const swing = Math.sin(runner.anim * 2) * (runner.grounded ? 1 : 0.2);
  const x = runner.x;
  const y = runner.y;

  ctx.save();
  ctx.translate(x, y);
  if (runner.dead) ctx.rotate(0.3);

  ctx.fillStyle = "#405f33";
  ctx.fillRect(7, 22, 16, 19);
  ctx.fillStyle = "#314825";
  ctx.fillRect(6, 20, 18, 5);
  ctx.fillStyle = "#d7d8d2";
  ctx.fillRect(14, 24, 2, 11);
  ctx.fillStyle = "#b89244";
  ctx.fillRect(13, 35, 4, 4);

  if (runnerHeadImage.complete && runnerHeadImage.naturalWidth > 0) {
    const headX = -6;
    const headY = -6;
    const headW = 42;
    const headH = 39.9;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(headX + headW / 2, headY + headH / 2 + 1, headW * 0.37, headH * 0.46, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.drawImage(runnerHeadImage, 72, 40, 590, 710, headX, headY, headW, headH);
    ctx.restore();
  } else {
    ctx.fillStyle = "#d6bb99";
    ctx.fillRect(8, 6, 14, 14);
  }

  ctx.strokeStyle = "#405f33";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(10, 40);
  ctx.lineTo(10 - swing, 54);
  ctx.moveTo(18, 40);
  ctx.lineTo(18 + swing, 54);
  ctx.stroke();

  ctx.strokeStyle = "#314825";
  ctx.beginPath();
  ctx.moveTo(7, 25);
  ctx.lineTo(3, 35 + swing);
  ctx.moveTo(21, 25);
  ctx.lineTo(25, 35 - swing);
  ctx.stroke();

  ctx.restore();
}

function drawGuard(guard) {
  const leg = Math.sin(guard.stride) * 2.8;
  const arm = Math.sin(guard.arm) * 2.4;
  ctx.save();
  ctx.translate(guard.x, guard.y);

  ctx.fillStyle = "#c73c32";
  ctx.fillRect(8, 14, 12, guard.h - 18);
  ctx.fillStyle = "#9d2b23";
  ctx.fillRect(7, 12, 14, 5);
  ctx.fillStyle = "#efcfab";
  ctx.fillRect(9, 4, 10, 10);
  ctx.fillStyle = "#8f241d";
  ctx.fillRect(7, 1, 14, 4);
  ctx.fillRect(6, 5, 16, 2);
  ctx.fillStyle = "#5f4a30";
  ctx.fillRect(12, 19, 3, 12);
  ctx.fillStyle = "#3d2d1d";
  ctx.fillRect(20, 16, 6, 2);
  ctx.fillRect(25, 15, 1.5, 19);
  ctx.fillStyle = "#222";
  ctx.fillRect(11, 8, 1.5, 1.5);
  ctx.fillRect(15, 8, 1.5, 1.5);

  ctx.strokeStyle = "#9d2b23";
  ctx.lineCap = "round";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(9, 19);
  ctx.lineTo(4, 28 + arm);
  ctx.moveTo(19, 19);
  ctx.lineTo(23, 28 - arm);
  ctx.moveTo(10, guard.h - 6);
  ctx.lineTo(8 - leg, guard.h + 8);
  ctx.moveTo(17, guard.h - 6);
  ctx.lineTo(19 + leg, guard.h + 8);
  ctx.stroke();

  ctx.restore();
}

function drawDust() {
  ctx.fillStyle = "#d0d0cb";
  for (const dust of dusts) {
    ctx.globalAlpha = dust.life / 0.5;
    ctx.fillRect(dust.x, dust.y, dust.size, dust.size);
  }
  ctx.globalAlpha = 1;
}

function render() {
  ctx.clearRect(0, 0, width, height);
  drawBackground();
  for (const guard of guards) drawGuard(guard);
  drawRunner();
  drawDust();
}

function frame(time) {
  if (!lastTime) lastTime = time;
  const dt = Math.min(0.032, (time - lastTime) / 1000);
  lastTime = time;
  update(dt);
  render();
  requestAnimationFrame(frame);
}

function handleStart() {
  if (!running) reset();
}

function handleJumpAction() {
  if (!running) return;
  jump();
}

window.addEventListener("resize", resize);
window.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    if (running) {
      jump();
    }
  }
});

canvas.addEventListener("pointerdown", handleJumpAction);
startButton.addEventListener("click", handleStart);

resize();
updateScore();
showOverlay("开始游戏", "趣味老蒋跑酷，看看你能取得多少优势！", "开始");
requestAnimationFrame(frame);
