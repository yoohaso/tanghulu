import { useCallback, useEffect, useMemo, useRef } from 'react';
import Rectangle from './model/Rectangle';

function Canvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rAFref = useRef<number | null>(null);

  const blueRectangle = useMemo(() => new Rectangle(100, 100, 100, 100, 'blue'), []);

  const drawRectangle = useCallback(
    (ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      blueRectangle.animate(ctx, 0.1, 2);
      window.requestAnimationFrame(() => drawRectangle(ctx, canvas));
    },
    [blueRectangle],
  );

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
