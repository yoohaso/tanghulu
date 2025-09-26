import { useCallback, useEffect, useRef } from 'react';
import Rectangle from './model/Rectangle';

const RECTANGLE_SIZE = {
  width: 50,
  height: 50,
};

// NOTE: https://www.cemyuksel.com/cyCodeBase/soln/poisson_disk_sampling.html
function poissonDisk1D(viewportWidth: number, rectWidth: number, margin: number) {
  const minSpace = rectWidth + margin;
  const maxPointCount = Math.floor(viewportWidth / minSpace);
  const targetPointCount = Math.floor(Math.random() * (maxPointCount + 1));

  const points: number[] = [];
  const MAX_ATTEMPTS = 1000;
  let attempts = 0;

  while (points.length < targetPointCount && attempts < MAX_ATTEMPTS) {
    attempts++;
    const candidatePoint = Math.random() * (viewportWidth - rectWidth - margin * 2) + margin;
    const validPoint = points.every(point => Math.abs(candidatePoint - point) >= minSpace);

    if (validPoint) {
      points.push(candidatePoint);
      attempts = 0;
    }
  }

  return points;
}

function generateBlueRect(viewportWidth: number) {
  const xPoints = poissonDisk1D(viewportWidth, RECTANGLE_SIZE.width, 20);

  if (xPoints.length < 2) {
    return generateBlueRect(viewportWidth);
  }

  return xPoints.map(
    xPoint => new Rectangle(xPoint, 0, RECTANGLE_SIZE.width, RECTANGLE_SIZE.height, 'blue'),
  );
}

function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rAFref = useRef<number | null>(null);
  const blueRectRef = useRef(generateBlueRect(window.innerWidth));

  const drawRectangle = useCallback((ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    blueRectRef.current.forEach(rec => {
      rec.animate(ctx, 0.1, 2);
    });

    const anyOutOfBounds = blueRectRef.current.some(rect => rect.y >= canvas.height);
    if (anyOutOfBounds) {
      blueRectRef.current = generateBlueRect(canvas.width);
    }

    window.requestAnimationFrame(() => drawRectangle(ctx, canvas));
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

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
  }, [drawRectangle]);

  return <canvas ref={canvasRef}></canvas>;
}

export default Canvas;
