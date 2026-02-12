import Fruit from './Fruit';

class Skewer {
  x: number;
  y: number;
  width: number;
  height: number;
  skeweredFruits: Fruit[];

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.width = 6;
    this.height = 300;
    this.skeweredFruits = [];
  }

  /** 꼬치 끝(뾰족한 상단) Y 좌표 — 충돌 판정용 */
  get tipY(): number {
    return this.y - this.height;
  }

  /** 꼬치 하단에서 과일이 쌓이기 시작하는 기준점 (하단에서 40px 위) */
  get stackBaseY(): number {
    return this.y - 40;
  }

  /** 현재 쌓인 과일 높이 합 */
  private get stackedHeight(): number {
    return this.skeweredFruits.reduce((sum, f) => sum + f.height * 0.7, 0);
  }

  /** 꼬치가 가득 찼는지 여부 */
  get isFull(): boolean {
    return this.stackBaseY - this.stackedHeight <= this.tipY + 20;
  }

  /** 스택 최상단 Y 좌표 */
  get stackTopY(): number {
    return this.stackBaseY - this.stackedHeight;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const tipY = this.y - this.height;
    const baseY = this.y;

    // Stick body
    ctx.beginPath();
    ctx.moveTo(this.x - this.width / 2, baseY);
    ctx.lineTo(this.x - this.width / 2, tipY + 15);
    ctx.lineTo(this.x, tipY);
    ctx.lineTo(this.x + this.width / 2, tipY + 15);
    ctx.lineTo(this.x + this.width / 2, baseY);
    ctx.closePath();
    ctx.fillStyle = '#c4883c';
    ctx.fill();

    // Subtle edge highlight
    ctx.beginPath();
    ctx.moveTo(this.x - this.width / 2 + 1, baseY);
    ctx.lineTo(this.x - this.width / 2 + 1, tipY + 15);
    ctx.strokeStyle = '#d4a35c';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  addFruit(fruit: Fruit) {
    fruit.skewered = true;
    const stackedHeight = this.skeweredFruits.reduce((sum, f) => sum + f.height * 0.7, 0);
    fruit.targetY = this.stackBaseY - stackedHeight - fruit.height / 2;
    this.skeweredFruits.push(fruit);
  }

  updateFruitPositions() {
    let stackedHeight = 0;
    for (const fruit of this.skeweredFruits) {
      fruit.x = this.x;
      fruit.targetY = this.stackBaseY - stackedHeight - fruit.height / 2;
      stackedHeight += fruit.height * 0.7;
    }
  }
}

export default Skewer;
