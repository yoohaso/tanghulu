import { useCallback, useEffect, useRef } from 'react';
import Fruit from './model/Fruit';
import Skewer from './model/Skewer';
import blueberryUrl from './assets/blueberry.png';
import strawberryUrl from './assets/strawberry.png';
import pineappleUrl from './assets/pineapple.png';

interface FruitConfig {
  url: string;
  size: number;
}

const FRUITS: FruitConfig[] = [
  { url: blueberryUrl, size: 50 },
  { url: strawberryUrl, size: 80 },
  { url: pineappleUrl, size: 90 },
];

const MAX_FRUIT_SIZE = Math.max(...FRUITS.map(f => f.size));

const COLLISION_X_THRESHOLD = 30;

const COATING_DURATION = 60; // frames (~1s)
const EXIT_DURATION = 90; // frames (~1.5s)

type GamePhase = 'playing' | 'coating' | 'exiting';

interface Sparkle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
}

interface LoadedFruit {
  image: HTMLImageElement;
  width: number;
  height: number;
}

function loadFruits(fruits: FruitConfig[]): Promise<LoadedFruit[]> {
  return Promise.all(
    fruits.map(
      fruit =>
        new Promise<LoadedFruit>((resolve, reject) => {
          const img = new Image();
          img.onload = () => {
            const aspect = img.naturalWidth / img.naturalHeight;
            resolve({
              image: img,
              width: fruit.size * aspect,
              height: fruit.size,
            });
          };
          img.onerror = reject;
          img.src = fruit.url;
        }),
    ),
  );
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// NOTE: https://www.cemyuksel.com/cyCodeBase/soln/poisson_disk_sampling.html
function poissonDisk1D(viewportWidth: number, rectWidth: number, margin: number) {
  const minSpace = rectWidth + margin;
  const maxXPointCount = Math.floor(viewportWidth / minSpace);
  const targetXPointCount = maxXPointCount;

  const points: number[] = [];
  const MAX_ATTEMPTS = 1000;
  let attempts = 0;

  while (points.length < targetXPointCount && attempts < MAX_ATTEMPTS) {
    attempts++;
    const candidateXPoint = Math.random() * (viewportWidth - rectWidth - margin * 2) + margin;
    const validXPoint = points.every(point => Math.abs(candidateXPoint - point) >= minSpace);

    if (validXPoint) {
      points.push(candidateXPoint);
      attempts = 0;
    }
  }

  return points;
}

function getRandomYAboveViewport() {
  return -Math.random() * 1000;
}

function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rAFref = useRef<number | null>(null);
  const fruitsRef = useRef<Fruit[]>([]);
  const availableXRef = useRef<number[]>([]);
  const loadedFruitsRef = useRef<LoadedFruit[]>([]);
  const skewerRef = useRef<Skewer | null>(null);
  const mouseXRef = useRef<number>(0);

  // State machine refs
  const gamePhaseRef = useRef<GamePhase>('playing');
  const phaseTimerRef = useRef<number>(0);
  const coatingFrozenXRef = useRef<number>(0);
  const sparklesRef = useRef<Sparkle[]>([]);
  const exitStartYRef = useRef<number>(0);
  const logicalWidthRef = useRef<number>(window.innerWidth);
  const logicalHeightRef = useRef<number>(window.innerHeight);

  const resizeCanvas = (canvas: HTMLCanvasElement) => {
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;

    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';

    logicalWidthRef.current = w;
    logicalHeightRef.current = h;

    return dpr;
  };

  const recycleFruit = (fruit: Fruit) => {
    const pool = availableXRef.current;
    const idx = Math.floor(Math.random() * pool.length);
    pool.push(fruit.x);
    fruit.x = pool[idx];
    pool.splice(idx, 1);
    fruit.y = getRandomYAboveViewport();
    fruit.angle = 0;
    fruit.rotateDirection = Math.random() > 0.5 ? 1 : -1;
    const loaded = pickRandom(loadedFruitsRef.current);
    fruit.image = loaded.image;
    fruit.width = loaded.width;
    fruit.height = loaded.height;
    fruit.skewered = false;
    fruit.bouncing = false;
    fruit.vx = 0;
    fruit.vy = 0;
    fruit.angularVelocity = 0;
  };

  const initAvailableX = (canvasWidth: number) => {
    const initX = poissonDisk1D(canvasWidth, MAX_FRUIT_SIZE, 20);
    availableXRef.current = [...initX];
    return initX;
  };

  const createFruitObjects = useCallback((canvasWidth: number, loaded: LoadedFruit[]) => {
    const initX = initAvailableX(canvasWidth);
    fruitsRef.current = initX.map(x => {
      const fruit = pickRandom(loaded);
      return new Fruit(x, getRandomYAboveViewport(), fruit.width, fruit.height, fruit.image);
    });
  }, []);

  const checkCollision = (fruit: Fruit, skewer: Skewer): boolean => {
    if (fruit.skewered) return false;

    const dx = Math.abs(fruit.x - skewer.x);
    if (dx > COLLISION_X_THRESHOLD) return false;

    const fruitBottom = fruit.y + fruit.height / 2;
    return fruitBottom >= skewer.tipY && fruitBottom <= skewer.tipY + 20;
  };

  const updateAndDrawFallingFruits = (
    ctx: CanvasRenderingContext2D,
    logicalW: number,
    logicalH: number,
    skewer: Skewer,
  ) => {
    fruitsRef.current.forEach(fruit => {
      if (fruit.skewered) return;

      if (fruit.bouncing) {
        fruit.animate(ctx, 0, 0);
        if (fruit.y > logicalH + 100 || fruit.x < -100 || fruit.x > logicalW + 100) {
          recycleFruit(fruit);
        }
        return;
      }

      // Normal falling fruit
      fruit.animate(ctx, 0.03, 2);

      // During playing phase, check collisions
      if (gamePhaseRef.current === 'playing') {
        if (skewer.isFull) {
          const fruitRadius = Math.max(fruit.width, fruit.height) / 2;
          for (const stacked of skewer.skeweredFruits) {
            const stackedRadius = Math.max(stacked.width, stacked.height) / 2;
            const dx = fruit.x - stacked.x;
            const dy = fruit.y - stacked.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < fruitRadius + stackedRadius - 10) {
              fruit.bounce(stacked.x, stacked.y);
              break;
            }
          }
        } else {
          if (checkCollision(fruit, skewer)) {
            const prevX = fruit.x;
            skewer.addFruit(fruit);
            const pool = availableXRef.current;
            pool.push(prevX);
            const idx = Math.floor(Math.random() * pool.length);
            const newX = pool[idx];
            pool.splice(idx, 1);
            const loaded = pickRandom(loadedFruitsRef.current);
            fruitsRef.current.push(
              new Fruit(newX, getRandomYAboveViewport(), loaded.width, loaded.height, loaded.image),
            );
          }
        }
      }

      // Recycle fruits that fell off screen
      if (fruit.y >= logicalH + 100) {
        recycleFruit(fruit);
      }
    });
  };

  const spawnSparkles = (x: number, y: number) => {
    const sparkles = sparklesRef.current;
    for (let i = 0; i < 3; i++) {
      sparkles.push({
        x: x + (Math.random() - 0.5) * 40,
        y: y + (Math.random() - 0.5) * 6,
        vx: (Math.random() - 0.5) * 2,
        vy: -Math.random() * 2 - 0.5,
        life: 0,
        maxLife: 20 + Math.random() * 20,
        size: 1.5 + Math.random() * 2.5,
      });
    }
  };

  const updateAndDrawSparkles = (ctx: CanvasRenderingContext2D) => {
    const sparkles = sparklesRef.current;
    for (let i = sparkles.length - 1; i >= 0; i--) {
      const s = sparkles[i];
      s.x += s.vx;
      s.y += s.vy;
      s.life++;

      if (s.life >= s.maxLife) {
        sparkles.splice(i, 1);
        continue;
      }

      const alpha = 1 - s.life / s.maxLife;
      const isGold = Math.random() > 0.4;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = isGold ? '#FFD700' : '#FFFFFF';
      ctx.beginPath();
      // Draw a small star shape
      const cx = s.x;
      const cy = s.y;
      const r = s.size;
      for (let j = 0; j < 4; j++) {
        const angle = (j * Math.PI) / 2;
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(angle) * r, cy + Math.sin(angle) * r);
      }
      ctx.arc(cx, cy, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  const drawCoatingOverlay = (ctx: CanvasRenderingContext2D, skewer: Skewer, progress: number) => {
    const baseY = skewer.stackBaseY;
    const topY = skewer.stackTopY;
    const coatingLineY = baseY - (baseY - topY) * progress;

    // Draw amber overlay on each coated fruit
    for (const fruit of skewer.skeweredFruits) {
      if (fruit.y + fruit.height / 2 < coatingLineY) continue; // above coating line
      const rx = fruit.width / 2 + 4;
      const ry = fruit.height / 2 + 4;

      ctx.save();
      // Amber gloss overlay
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = 'rgba(255, 180, 50, 1)';
      ctx.beginPath();
      ctx.ellipse(fruit.x, fruit.y, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();

      // White highlight crescent
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.ellipse(
        fruit.x - rx * 0.25,
        fruit.y - ry * 0.2,
        rx * 0.5,
        ry * 0.6,
        -0.3,
        0,
        Math.PI * 2,
      );
      ctx.fill();
      ctx.restore();
    }

    // Glow line at coating front
    ctx.save();
    const glowGrad = ctx.createLinearGradient(
      skewer.x - 35,
      coatingLineY,
      skewer.x + 35,
      coatingLineY,
    );
    glowGrad.addColorStop(0, 'rgba(255, 220, 100, 0)');
    glowGrad.addColorStop(0.3, 'rgba(255, 220, 100, 0.7)');
    glowGrad.addColorStop(0.5, 'rgba(255, 255, 200, 0.9)');
    glowGrad.addColorStop(0.7, 'rgba(255, 220, 100, 0.7)');
    glowGrad.addColorStop(1, 'rgba(255, 220, 100, 0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(skewer.x - 35, coatingLineY - 3, 70, 6);
    ctx.restore();

    // Spawn sparkles at coating front
    spawnSparkles(skewer.x, coatingLineY);
  };

  const gameLoop = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const w = logicalWidthRef.current;
    const h = logicalHeightRef.current;
    ctx.clearRect(0, 0, w, h);

    const skewer = skewerRef.current;
    if (!skewer) return;

    const phase = gamePhaseRef.current;

    // --- 1. Update positions (before drawing) ---
    if (phase === 'playing') {
      const targetX = mouseXRef.current;
      skewer.x += (targetX - skewer.x) * 0.12;
      skewer.updateFruitPositions();
    } else if (phase === 'coating') {
      skewer.x = coatingFrozenXRef.current;
      skewer.updateFruitPositions();
      phaseTimerRef.current++;
    } else if (phase === 'exiting') {
      skewer.x = coatingFrozenXRef.current;
      phaseTimerRef.current++;
      const progress = Math.min(phaseTimerRef.current / EXIT_DURATION, 1);
      const eased = progress * progress;
      const totalDist = exitStartYRef.current + skewer.height + 100;
      skewer.y = exitStartYRef.current - totalDist * eased;
      skewer.updateFruitPositions();
      // Snap skewered fruits to target immediately (no lerp lag)
      for (const fruit of skewer.skeweredFruits) {
        fruit.y = fruit.targetY;
      }
    }

    // --- 2. Draw falling fruits (always) ---
    updateAndDrawFallingFruits(ctx, w, h, skewer);

    // --- 3. Draw skewer + skewered fruits ---
    skewer.draw(ctx);
    skewer.skeweredFruits.forEach(fruit => {
      fruit.animate(ctx, 0, 0);
    });

    // --- 4. Phase-specific overlays & transitions ---
    if (phase === 'playing') {
      if (skewer.isFull) {
        gamePhaseRef.current = 'coating';
        phaseTimerRef.current = 0;
        coatingFrozenXRef.current = skewer.x;
        sparklesRef.current = [];
      }
    } else if (phase === 'coating') {
      const progress = Math.min(phaseTimerRef.current / COATING_DURATION, 1);
      drawCoatingOverlay(ctx, skewer, progress);
      updateAndDrawSparkles(ctx);

      if (progress >= 1) {
        gamePhaseRef.current = 'exiting';
        phaseTimerRef.current = 0;
        exitStartYRef.current = skewer.y;
      }
    } else if (phase === 'exiting') {
      drawCoatingOverlay(ctx, skewer, 1);
      updateAndDrawSparkles(ctx);

      if (skewer.y + skewer.height < -50) {
        fruitsRef.current = fruitsRef.current.filter(f => !f.skewered);
        skewerRef.current = new Skewer(w / 2, h - 30);
        gamePhaseRef.current = 'playing';
        phaseTimerRef.current = 0;
        sparklesRef.current = [];
      }
    }

    rAFref.current = window.requestAnimationFrame(() => gameLoop(ctx, canvas));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    resizeCanvas(canvas);
    const w = logicalWidthRef.current;
    const h = logicalHeightRef.current;

    // Initialize skewer at bottom center
    skewerRef.current = new Skewer(w / 2, h - 30);
    mouseXRef.current = w / 2;

    // --- Input handlers (registered on canvas) ---
    const handleMouseMove = (e: MouseEvent) => {
      mouseXRef.current = e.clientX;
    };

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        mouseXRef.current = e.touches[0].clientX;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault(); // Prevent scroll / pull-to-refresh
      if (e.touches.length > 0) {
        mouseXRef.current = e.touches[0].clientX;
      }
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('touchstart', handleTouchStart, { passive: true });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });

    // --- Resize handler ---
    const handleResize = () => {
      resizeCanvas(canvas);
      const newW = logicalWidthRef.current;
      const newH = logicalHeightRef.current;

      // Reposition skewer to new bottom center (only during playing phase)
      const skewer = skewerRef.current;
      if (skewer) {
        skewer.y = newH - 30;
        if (gamePhaseRef.current === 'playing') {
          skewer.x = Math.min(Math.max(skewer.x, 0), newW);
        }
        skewer.updateFruitPositions();
      }
    };

    window.addEventListener('resize', handleResize);

    loadFruits(FRUITS).then(loaded => {
      loadedFruitsRef.current = loaded;
      createFruitObjects(w, loaded);

      const ctx = canvas.getContext('2d');
      if (ctx) {
        rAFref.current = window.requestAnimationFrame(() => {
          gameLoop(ctx, canvas);
        });
      }
    });

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('resize', handleResize);
      if (rAFref.current) {
        window.cancelAnimationFrame(rAFref.current);
      }
    };
  }, [gameLoop, createFruitObjects]);

  return <canvas ref={canvasRef}></canvas>;
}

export default Canvas;
