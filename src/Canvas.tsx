import { useCallback, useEffect, useRef } from 'react';
import Rectangle from './model/Rectangle';

const RECTANGLE_SIZE = {
  width: 50,
  height: 50,
};

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

function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rAFref = useRef<number | null>(null);
  const blueRectRef = useRef<Rectangle[]>([]);
  const availableXRef = useRef<number[]>([]);

  const recycleRectangle = (rect: Rectangle) => {
    const pool = availableXRef.current;
    const idx = Math.floor(Math.random() * pool.length);
    pool.push(rect.x);
    rect.x = pool[idx];
    pool.splice(idx, 1);
    rect.y = 0;
  };

  const initAvailableX = (canvasWidth: number) => {
    const initX = poissonDisk1D(canvasWidth, RECTANGLE_SIZE.width, 20);
    availableXRef.current = [...initX];
    return initX;
  };

  const createRectangleObjects = useCallback((canvasWidth: number) => {
    const initX = initAvailableX(canvasWidth);
    blueRectRef.current = initX.map(
      x => new Rectangle(x, 0, RECTANGLE_SIZE.width, RECTANGLE_SIZE.height, 'blue'),
    );
  }, []);

  const drawRectangle = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    blueRectRef.current.forEach(rect => {
      rect.animate(ctx, 0.1, 2);

      if (rect.y >= canvas.height) {
        recycleRectangle(rect);
      }
    });

    window.requestAnimationFrame(() => drawRectangle(ctx, canvas));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      createRectangleObjects(canvas.width);

      if (canvas.getContext('2d')) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          rAFref.current = window.requestAnimationFrame(() => {
            drawRectangle(ctx, canvas);
          });
        }
      }
    }

    return () => {
      if (rAFref.current) {
        window.cancelAnimationFrame(rAFref.current);
      }
    };
  }, [drawRectangle, createRectangleObjects]);

  return <canvas ref={canvasRef}></canvas>;
}

export default Canvas;
