import { useCallback, useEffect, useRef } from 'react';
import Fruit from './model/Fruit';
import Skewer from './model/Skewer';
import blueberryUrl from './assets/blueberry.png';
import strawberryUrl from './assets/strawberry.png';

interface FruitConfig {
  url: string;
  size: number;
}

const FRUITS: FruitConfig[] = [
  { url: blueberryUrl, size: 50 },
  { url: strawberryUrl, size: 80 },
];

const MAX_FRUIT_SIZE = Math.max(...FRUITS.map(f => f.size));

const COLLISION_X_THRESHOLD = 30;

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
  const targetXPointCount = Math.floor(Math.random() * (maxXPointCount + 1));

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
    // 과일 하단이 꼬치 끝 근처를 지나는 순간에만 충돌 (위에서 아래로 통과하는 짧은 구간)
    return fruitBottom >= skewer.tipY && fruitBottom <= skewer.tipY + 20;
  };

  const gameLoop = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const skewer = skewerRef.current;
    if (!skewer) return;

    // Smoothly follow mouse X
    const targetX = mouseXRef.current;
    skewer.x += (targetX - skewer.x) * 0.12;
    skewer.updateFruitPositions();

    // Draw falling & bouncing fruits (not skewered)
    fruitsRef.current.forEach(fruit => {
      if (fruit.skewered) return;

      if (fruit.bouncing) {
        fruit.animate(ctx, 0, 0);
        // Recycle bouncing fruits that left the screen
        if (fruit.y > canvas.height + 100 || fruit.x < -100 || fruit.x > canvas.width + 100) {
          recycleFruit(fruit);
        }
        return;
      }

      // Normal falling fruit
      fruit.animate(ctx, 0.03, 2);

      if (skewer.isFull) {
        // Skewer is full — bounce off stacked fruits
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
        // Check collision with skewer tip
        if (checkCollision(fruit, skewer)) {
          skewer.addFruit(fruit);
        }
      }

      // Recycle fruits that fell off screen
      if (fruit.y >= canvas.height + 100) {
        recycleFruit(fruit);
      }
    });

    // Draw skewer
    skewer.draw(ctx);

    // Draw skewered fruits (on top of skewer)
    skewer.skeweredFruits.forEach(fruit => {
      fruit.animate(ctx, 0, 0);
    });

    rAFref.current = window.requestAnimationFrame(() => gameLoop(ctx, canvas));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Initialize skewer at bottom center
    skewerRef.current = new Skewer(canvas.width / 2, canvas.height - 30);
    mouseXRef.current = canvas.width / 2;

    const handleMouseMove = (e: MouseEvent) => {
      mouseXRef.current = e.clientX;
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        mouseXRef.current = e.touches[0].clientX;
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('touchmove', handleTouchMove);

    loadFruits(FRUITS).then(loaded => {
      loadedFruitsRef.current = loaded;
      createFruitObjects(canvas.width, loaded);

      const ctx = canvas.getContext('2d');
      if (ctx) {
        rAFref.current = window.requestAnimationFrame(() => {
          gameLoop(ctx, canvas);
        });
      }
    });

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('touchmove', handleTouchMove);
      if (rAFref.current) {
        window.cancelAnimationFrame(rAFref.current);
      }
    };
  }, [gameLoop, createFruitObjects]);

  return <canvas ref={canvasRef}></canvas>;
}

export default Canvas;
