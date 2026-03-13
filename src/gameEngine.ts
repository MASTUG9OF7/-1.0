import { BUBBLE_RADIUS, GRID_ROWS, GRID_COLS, CANVAS_WIDTH, CANVAS_HEIGHT, ALL_BUBBLE_TYPES } from './constants';

export interface Bubble {
  x: number;
  y: number;
  typeIndex: number;
  id: string;
}

export interface FallingBubble extends Bubble {
  vx: number;
  vy: number;
  opacity: number;
}

export interface PoppingBubble extends Bubble {
  timer: number; // 0 to 1
  shakeX: number;
  shakeY: number;
}

export class GameEngine {
  grid: (Bubble | null)[][];
  projectile: { x: number; y: number; vx: number; vy: number; typeIndex: number; speed: number } | null = null;
  fallingBubbles: FallingBubble[] = [];
  poppingBubbles: PoppingBubble[] = [];
  currentTypeIndex: number;
  nextTypeIndex: number;
  activeTypes: typeof ALL_BUBBLE_TYPES;
  score: number = 0;
  gameOver: boolean = false;
  onUpdate: () => void;
  onPop: () => void;

  constructor(onUpdate: () => void, onPop: () => void) {
    this.onUpdate = onUpdate;
    this.onPop = onPop;
    this.activeTypes = this.getRandomTypes();
    this.grid = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));
    this.currentTypeIndex = Math.floor(Math.random() * this.activeTypes.length);
    this.nextTypeIndex = Math.floor(Math.random() * this.activeTypes.length);
    this.initRandomGrid();
  }

  getRandomTypes() {
    const shuffled = [...ALL_BUBBLE_TYPES].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 7);
  }

  initRandomGrid() {
    for (let r = 0; r < 5; r++) {
      const cols = r % 2 === 0 ? GRID_COLS : GRID_COLS - 1;
      for (let c = 0; c < cols; c++) {
        const pos = this.getBubblePosition(r, c);
        this.grid[r][c] = {
          x: pos.x,
          y: pos.y,
          typeIndex: Math.floor(Math.random() * this.activeTypes.length),
          id: Math.random().toString(36).substr(2, 9),
        };
      }
    }
  }

  getBubblePosition(row: number, col: number) {
    const offset = row % 2 === 0 ? 0 : BUBBLE_RADIUS;
    return {
      x: col * (BUBBLE_RADIUS * 2) + BUBBLE_RADIUS + offset + 20,
      y: row * (BUBBLE_RADIUS * 2 * 0.866) + BUBBLE_RADIUS + 20,
    };
  }

  shoot(angle: number) {
    if (this.projectile || this.gameOver) return;

    const initialSpeed = 2;
    this.projectile = {
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT - 60,
      vx: Math.cos(angle) * initialSpeed,
      vy: Math.sin(angle) * initialSpeed,
      typeIndex: this.currentTypeIndex,
      speed: initialSpeed,
    };

    this.currentTypeIndex = this.nextTypeIndex;
    this.nextTypeIndex = Math.floor(Math.random() * this.activeTypes.length);
    this.onUpdate();
  }

  update() {
    // Update falling bubbles
    this.fallingBubbles = this.fallingBubbles.map(f => ({
      ...f,
      x: f.x + f.vx,
      y: f.y + f.vy,
      vy: f.vy + 0.4, // Gravity g
      opacity: f.opacity - 0.015,
    })).filter(f => f.y < CANVAS_HEIGHT + 50 && f.opacity > 0);

    // Update popping bubbles (Shake then Shrink)
    this.poppingBubbles = this.poppingBubbles.map(p => {
      const newTimer = p.timer + 0.08; // Approx 0.2s at 60fps
      let shakeX = 0;
      let shakeY = 0;
      
      // First 30% of time is shaking
      if (newTimer < 0.3) {
        shakeX = (Math.random() - 0.5) * 6;
        shakeY = (Math.random() - 0.5) * 6;
      }

      return { ...p, timer: newTimer, shakeX, shakeY };
    }).filter(p => p.timer < 1);

    if (!this.projectile) return;

    const maxSpeed = 14;
    if (this.projectile.speed < maxSpeed) {
      this.projectile.speed += 0.5;
      const angle = Math.atan2(this.projectile.vy, this.projectile.vx);
      this.projectile.vx = Math.cos(angle) * this.projectile.speed;
      this.projectile.vy = Math.sin(angle) * this.projectile.speed;
    }

    this.projectile.x += this.projectile.vx;
    this.projectile.y += this.projectile.vy;

    if (this.projectile.x < BUBBLE_RADIUS || this.projectile.x > CANVAS_WIDTH - BUBBLE_RADIUS) {
      this.projectile.vx *= -1;
    }

    if (this.projectile.y < BUBBLE_RADIUS + 20) {
      this.snapProjectile();
      return;
    }

    for (let r = 0; r < GRID_ROWS; r++) {
      const cols = r % 2 === 0 ? GRID_COLS : GRID_COLS - 1;
      for (let c = 0; c < cols; c++) {
        const bubble = this.grid[r][c];
        if (bubble) {
          const dist = Math.hypot(this.projectile.x - bubble.x, this.projectile.y - bubble.y);
          if (dist < BUBBLE_RADIUS * 2 - 4) {
            this.snapProjectile();
            return;
          }
        }
      }
    }

    if (this.projectile.y > CANVAS_HEIGHT || this.projectile.y < -100) {
      this.projectile = null;
    }
  }

  snapProjectile() {
    if (!this.projectile) return;

    let bestDist = Infinity;
    let bestR = 0, bestC = 0;

    for (let r = 0; r < GRID_ROWS; r++) {
      const cols = r % 2 === 0 ? GRID_COLS : GRID_COLS - 1;
      for (let c = 0; c < cols; c++) {
        if (this.grid[r][c]) continue;
        const pos = this.getBubblePosition(r, c);
        const dist = Math.hypot(this.projectile.x - pos.x, this.projectile.y - pos.y);
        if (dist < bestDist) {
          bestDist = dist;
          bestR = r;
          bestC = c;
        }
      }
    }

    const pos = this.getBubblePosition(bestR, bestC);
    this.grid[bestR][bestC] = {
      x: pos.x,
      y: pos.y,
      typeIndex: this.projectile.typeIndex,
      id: Math.random().toString(36).substr(2, 9),
    };

    const typeIndex = this.projectile.typeIndex;
    this.projectile = null;

    this.handleMatches(bestR, bestC, typeIndex);
    this.handleFalling();

    if (bestR >= GRID_ROWS - 1) {
      this.gameOver = true;
    }

    this.onUpdate();
  }

  handleMatches(row: number, col: number, typeIndex: number) {
    const matches = this.findMatches(row, col, typeIndex);
    if (matches.length >= 3) {
      this.onPop();
      matches.forEach(({ r, c }) => {
        const b = this.grid[r][c]!;
        this.poppingBubbles.push({
          ...b,
          timer: 0,
          shakeX: 0,
          shakeY: 0
        });
        this.grid[r][c] = null;
      });
      this.score += matches.length * 10;
    }
  }

  findMatches(row: number, col: number, typeIndex: number) {
    const matches: { r: number; c: number }[] = [];
    const visited = new Set<string>();
    const queue = [{ r: row, c: col }];
    visited.add(`${row},${col}`);

    while (queue.length > 0) {
      const { r, c } = queue.shift()!;
      matches.push({ r, c });

      const neighbors = this.getNeighbors(r, c);
      for (const n of neighbors) {
        const neighborBubble = this.grid[n.r][n.c];
        if (neighborBubble && neighborBubble.typeIndex === typeIndex && !visited.has(`${n.r},${n.c}`)) {
          visited.add(`${n.r},${n.c}`);
          queue.push(n);
        }
      }
    }
    return matches;
  }

  getNeighbors(r: number, c: number) {
    const neighbors: { r: number; c: number }[] = [];
    const isEven = r % 2 === 0;

    const offsets = isEven
      ? [
          { dr: -1, dc: -1 }, { dr: -1, dc: 0 },
          { dr: 0, dc: -1 }, { dr: 0, dc: 1 },
          { dr: 1, dc: -1 }, { dr: 1, dc: 0 },
        ]
      : [
          { dr: -1, dc: 0 }, { dr: -1, dc: 1 },
          { dr: 0, dc: -1 }, { dr: 0, dc: 1 },
          { dr: 1, dc: 0 }, { dr: 1, dc: 1 },
        ];

    for (const { dr, dc } of offsets) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < GRID_ROWS) {
        const cols = nr % 2 === 0 ? GRID_COLS : GRID_COLS - 1;
        if (nc >= 0 && nc < cols) {
          neighbors.push({ r: nr, c: nc });
        }
      }
    }
    return neighbors;
  }

  handleFalling() {
    const connected = new Set<string>();
    const queue: { r: number; c: number }[] = [];

    for (let c = 0; c < GRID_COLS; c++) {
      if (this.grid[0][c]) {
        queue.push({ r: 0, c });
        connected.add(`0,${c}`);
      }
    }

    while (queue.length > 0) {
      const { r, c } = queue.shift()!;
      const neighbors = this.getNeighbors(r, c);
      for (const n of neighbors) {
        if (this.grid[n.r][n.c] && !connected.has(`${n.r},${n.c}`)) {
          connected.add(`${n.r},${n.c}`);
          queue.push(n);
        }
      }
    }

    for (let r = 0; r < GRID_ROWS; r++) {
      const cols = r % 2 === 0 ? GRID_COLS : GRID_COLS - 1;
      for (let c = 0; c < cols; c++) {
        if (this.grid[r][c] && !connected.has(`${r},${c}`)) {
          const b = this.grid[r][c]!;
          this.fallingBubbles.push({
            ...b,
            vx: (Math.random() - 0.5) * 6,
            vy: 1 + Math.random() * 2,
            opacity: 1,
          });
          this.grid[r][c] = null;
          this.score += 20;
        }
      }
    }
  }

  reset() {
    this.activeTypes = this.getRandomTypes();
    this.grid = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));
    this.fallingBubbles = [];
    this.poppingBubbles = [];
    this.score = 0;
    this.gameOver = false;
    this.currentTypeIndex = Math.floor(Math.random() * this.activeTypes.length);
    this.nextTypeIndex = Math.floor(Math.random() * this.activeTypes.length);
    this.initRandomGrid();
    this.onUpdate();
  }
}
