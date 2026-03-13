import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Play, RotateCcw, Volume2, VolumeX } from 'lucide-react';

// --- Constants ---
const BUBBLE_RADIUS = 20;
const BUBBLE_DIAMETER = BUBBLE_RADIUS * 2;
const ROW_HEIGHT = BUBBLE_DIAMETER * 0.866; // Hexagonal grid vertical spacing
const CANVAS_WIDTH = 440;
const CANVAS_HEIGHT = 600;
const GRID_ROWS = 12;
const GRID_COLS = 10;
const COLORS = ['#FF4D4D', '#4DFF4D', '#4D4DFF', '#FFFF4D', '#FF4DFF', '#4DFFFF'];

// --- Types ---
type Bubble = {
  color: string;
  x: number;
  y: number;
  row: number;
  col: number;
};

type Projectile = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  speed: number;
};

type FallingBubble = Bubble & {
  vy: number;
  opacity: number;
};

export default function BubbleShooter() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [grid, setGrid] = useState<(Bubble | null)[][]>([]);
  const [projectile, setProjectile] = useState<Projectile | null>(null);
  const [nextColor, setNextColor] = useState(COLORS[0]);
  const [score, setScore] = useState(0);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [fallingBubbles, setFallingBubbles] = useState<FallingBubble[]>([]);
  
  // Audio Refs
  const bgmRef = useRef<HTMLAudioElement | null>(null);
  const popSoundRef = useRef<HTMLAudioElement | null>(null);
  const bubbleImgRef = useRef<HTMLImageElement | null>(null);

  // --- Initialization ---
  const initGame = useCallback(() => {
    const newGrid: (Bubble | null)[][] = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));
    
    // Fill top 5 rows
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < (r % 2 === 0 ? GRID_COLS : GRID_COLS - 1); c++) {
        const color = COLORS[Math.floor(Math.random() * COLORS.length)];
        const { x, y } = getGridPosition(r, c);
        newGrid[r][c] = { color, x, y, row: r, col: c };
      }
    }
    
    setGrid(newGrid);
    setProjectile(null);
    setNextColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
    setScore(0);
    setIsGameOver(false);
    setFallingBubbles([]);
  }, []);

  useEffect(() => {
    initGame();
    
    // Load Assets
    bgmRef.current = new Audio('bgm.mp3');
    bgmRef.current.loop = true;
    popSoundRef.current = new Audio('pop.wav');
    
    const img = new Image();
    img.src = 'bubble.png';
    bubbleImgRef.current = img;

    return () => {
      bgmRef.current?.pause();
    };
  }, [initGame]);

  // --- Grid Math ---
  function getGridPosition(row: number, col: number) {
    const offset = (row % 2 === 1) ? BUBBLE_RADIUS : 0;
    const x = col * BUBBLE_DIAMETER + offset + BUBBLE_RADIUS + 20; // 20 is left padding
    const y = row * ROW_HEIGHT + BUBBLE_RADIUS + 20; // 20 is top padding
    return { x, y };
  }

  function getClosestGridCell(x: number, y: number) {
    let closestRow = 0;
    let closestCol = 0;
    let minDist = Infinity;

    for (let r = 0; r < GRID_ROWS; r++) {
      const colsInRow = r % 2 === 0 ? GRID_COLS : GRID_COLS - 1;
      for (let c = 0; c < colsInRow; c++) {
        const pos = getGridPosition(r, c);
        const dist = Math.hypot(x - pos.x, y - pos.y);
        if (dist < minDist) {
          minDist = dist;
          closestRow = r;
          closestCol = c;
        }
      }
    }
    return { row: closestRow, col: closestCol };
  }

  // --- Logic ---
  const playPop = () => {
    if (!isMuted && popSoundRef.current) {
      popSoundRef.current.currentTime = 0;
      popSoundRef.current.play().catch(() => {});
    }
  };

  const findMatches = (row: number, col: number, color: string, currentGrid: (Bubble | null)[][]) => {
    const matches: { r: number; c: number }[] = [];
    const visited = new Set<string>();
    const queue = [{ r: row, c: col }];
    visited.add(`${row},${col}`);

    while (queue.length > 0) {
      const { r, c } = queue.shift()!;
      matches.push({ r, c });

      // Neighbors in hexagonal grid
      const neighbors = getNeighbors(r, c);
      for (const [nr, nc] of neighbors) {
        const neighbor = currentGrid[nr]?.[nc];
        if (neighbor && neighbor.color === color && !visited.has(`${nr},${nc}`)) {
          visited.add(`${nr},${nc}`);
          queue.push({ r: nr, c: nc });
        }
      }
    }
    return matches;
  };

  const getNeighbors = (r: number, c: number) => {
    const neighbors: [number, number][] = [];
    const isOdd = r % 2 === 1;
    
    // Standard neighbors
    const offsets = isOdd 
      ? [[-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0], [1, 1]]
      : [[-1, -1], [-1, 0], [0, -1], [0, 1], [1, -1], [1, 0]];

    for (const [dr, dc] of offsets) {
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < GRID_ROWS) {
        const maxCols = nr % 2 === 0 ? GRID_COLS : GRID_COLS - 1;
        if (nc >= 0 && nc < maxCols) {
          neighbors.push([nr, nc]);
        }
      }
    }
    return neighbors;
  };

  const handleCollision = (proj: Projectile) => {
    const { row, col } = getClosestGridCell(proj.x, proj.y);
    
    setGrid(prev => {
      const newGrid = prev.map(r => [...r]);
      const pos = getGridPosition(row, col);
      newGrid[row][col] = { color: proj.color, x: pos.x, y: pos.y, row, col };

      // Check matches
      const matches = findMatches(row, col, proj.color, newGrid);
      if (matches.length >= 3) {
        playPop();
        matches.forEach(m => {
          newGrid[m.r][m.c] = null;
        });
        setScore(s => s + matches.length * 10);
        
        // Check for floating bubbles
        const floating = findFloatingBubbles(newGrid);
        if (floating.length > 0) {
          const newFalling = floating.map(f => ({
            ...newGrid[f.r][f.c]!,
            vy: 2,
            opacity: 1
          }));
          setFallingBubbles(prev => [...prev, ...newFalling]);
          floating.forEach(f => {
            newGrid[f.r][f.c] = null;
          });
          setScore(s => s + floating.length * 20);
        }
      }

      if (row >= GRID_ROWS - 1) setIsGameOver(true);
      return newGrid;
    });

    setProjectile(null);
    setNextColor(COLORS[Math.floor(Math.random() * COLORS.length)]);
  };

  const findFloatingBubbles = (currentGrid: (Bubble | null)[][]) => {
    const anchored = new Set<string>();
    const queue: { r: number; c: number }[] = [];

    // Start from top row
    for (let c = 0; c < GRID_COLS; c++) {
      if (currentGrid[0][c]) {
        queue.push({ r: 0, c });
        anchored.add(`0,${c}`);
      }
    }

    while (queue.length > 0) {
      const { r, c } = queue.shift()!;
      const neighbors = getNeighbors(r, c);
      for (const [nr, nc] of neighbors) {
        if (currentGrid[nr]?.[nc] && !anchored.has(`${nr},${nc}`)) {
          anchored.add(`${nr},${nc}`);
          queue.push({ r: nr, c: nc });
        }
      }
    }

    const floating: { r: number; c: number }[] = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      const cols = r % 2 === 0 ? GRID_COLS : GRID_COLS - 1;
      for (let c = 0; c < cols; c++) {
        if (currentGrid[r][c] && !anchored.has(`${r},${c}`)) {
          floating.push({ r, c });
        }
      }
    }
    return floating;
  };

  // --- Animation Loop ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;

    const render = () => {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // Draw Grid
      grid.forEach(row => {
        row.forEach(bubble => {
          if (bubble) drawBubble(ctx, bubble);
        });
      });

      // Draw Falling Bubbles
      setFallingBubbles(prev => {
        const next = prev.map(f => ({
          ...f,
          y: f.y + f.vy,
          vy: f.vy + 0.2, // Gravity
          opacity: f.opacity - 0.01
        })).filter(f => f.y < CANVAS_HEIGHT && f.opacity > 0);
        
        next.forEach(f => {
          ctx.save();
          ctx.globalAlpha = f.opacity;
          drawBubble(ctx, f);
          ctx.restore();
        });
        return next;
      });

      // Draw Projectile
      if (projectile) {
        // Weight/Acceleration smoothing
        const speedLimit = 8;
        if (projectile.speed < speedLimit) {
          projectile.speed += 0.5;
          const angle = Math.atan2(projectile.vy, projectile.vx);
          projectile.vx = Math.cos(angle) * projectile.speed;
          projectile.vy = Math.sin(angle) * projectile.speed;
        }

        projectile.x += projectile.vx;
        projectile.y += projectile.vy;

        // Wall bounce
        if (projectile.x < BUBBLE_RADIUS || projectile.x > CANVAS_WIDTH - BUBBLE_RADIUS) {
          projectile.vx *= -1;
        }

        drawBubble(ctx, { x: projectile.x, y: projectile.y, color: projectile.color } as Bubble);

        // Collision check
        let collided = false;
        if (projectile.y < BUBBLE_RADIUS + 20) {
          collided = true;
        } else {
          for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 0; c < GRID_COLS; c++) {
              const b = grid[r][c];
              if (b) {
                const dist = Math.hypot(projectile.x - b.x, projectile.y - b.y);
                if (dist < BUBBLE_DIAMETER - 2) {
                  collided = true;
                  break;
                }
              }
            }
            if (collided) break;
          }
        }

        if (collided) {
          handleCollision(projectile);
        }
      }

      // Draw Shooter Preview
      if (!projectile && !isGameOver) {
        ctx.beginPath();
        ctx.arc(CANVAS_WIDTH / 2, CANVAS_HEIGHT - 40, BUBBLE_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle = nextColor;
        ctx.fill();
        ctx.closePath();
      }

      animationId = requestAnimationFrame(render);
    };

    render();
    return () => cancelAnimationFrame(animationId);
  }, [grid, projectile, isGameOver, nextColor, fallingBubbles]);

  function drawBubble(ctx: CanvasRenderingContext2D, bubble: Bubble) {
    if (bubbleImgRef.current && bubbleImgRef.current.complete) {
      // Draw image if loaded
      ctx.drawImage(
        bubbleImgRef.current, 
        bubble.x - BUBBLE_RADIUS, 
        bubble.y - BUBBLE_RADIUS, 
        BUBBLE_DIAMETER, 
        BUBBLE_DIAMETER
      );
      // Tint with color
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = bubble.color;
      ctx.beginPath();
      ctx.arc(bubble.x, bubble.y, BUBBLE_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else {
      // Fallback to circle
      ctx.beginPath();
      ctx.arc(bubble.x, bubble.y, BUBBLE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = bubble.color;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.closePath();
    }
  }

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (projectile || isGameOver) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const startX = CANVAS_WIDTH / 2;
    const startY = CANVAS_HEIGHT - 40;
    
    const angle = Math.atan2(mouseY - startY, mouseX - startX);
    const initialSpeed = 2; // Start slow for "weight" feel
    
    setProjectile({
      x: startX,
      y: startY,
      vx: Math.cos(angle) * initialSpeed,
      vy: Math.sin(angle) * initialSpeed,
      color: nextColor,
      speed: initialSpeed
    });

    if (!isMuted && bgmRef.current?.paused) {
      bgmRef.current.play().catch(() => {});
    }
  };

  return (
    <div className="min-h-screen bg-[#1a1a1a] flex flex-col items-center justify-center p-4 font-sans text-white">
      <div className="max-w-md w-full bg-[#2a2a2a] rounded-3xl shadow-2xl overflow-hidden border border-white/10">
        {/* Header */}
        <div className="p-6 flex items-center justify-between bg-gradient-to-r from-indigo-600 to-purple-600">
          <div>
            <h1 className="text-2xl font-black tracking-tighter uppercase italic">Bubble Pro</h1>
            <p className="text-xs opacity-70 font-mono">PHYSICS ENGINE V2.0</p>
          </div>
          <div className="text-right">
            <p className="text-xs uppercase opacity-70">Score</p>
            <p className="text-3xl font-mono font-bold leading-none">{score.toString().padStart(5, '0')}</p>
          </div>
        </div>

        {/* Game Area */}
        <div className="relative bg-[#0f0f0f] flex justify-center p-2">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onClick={handleCanvasClick}
            className="cursor-crosshair rounded-xl shadow-inner bg-[radial-gradient(circle_at_center,_#1a1a1a_0%,_#000_100%)]"
          />

          {/* Game Over Overlay */}
          {isGameOver && (
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center p-8 text-center">
              <h2 className="text-5xl font-black text-red-500 mb-2 italic">GAME OVER</h2>
              <p className="text-xl mb-8 font-mono">FINAL SCORE: {score}</p>
              <button
                onClick={initGame}
                className="flex items-center gap-2 bg-white text-black px-8 py-4 rounded-full font-bold hover:bg-indigo-400 transition-colors"
              >
                <RotateCcw size={20} />
                RETRY MISSION
              </button>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="p-6 flex items-center justify-between bg-[#222]">
          <div className="flex gap-4">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className="p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
            >
              {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
            </button>
            <button
              onClick={initGame}
              className="p-3 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
            >
              <RotateCcw size={24} />
            </button>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-[10px] uppercase opacity-50">Next Up</p>
              <div 
                className="w-8 h-8 rounded-full border-2 border-white/20 shadow-lg"
                style={{ backgroundColor: nextColor }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="mt-8 grid grid-cols-2 gap-8 max-w-md opacity-50 text-[11px] uppercase tracking-widest font-medium">
        <div className="flex flex-col gap-1">
          <span className="text-indigo-400">Physics</span>
          <span>Hexagonal Grid Snapping</span>
          <span>Circle-Distance Collision</span>
        </div>
        <div className="flex flex-col gap-1 text-right">
          <span className="text-purple-400">Logic</span>
          <span>3+ Color Match Pop</span>
          <span>Gravity Drop Orphaning</span>
        </div>
      </div>
    </div>
  );
}
