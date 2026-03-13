import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Settings, Play, RotateCcw, Volume2, VolumeX, Music, Info, Menu as MenuIcon, X } from 'lucide-react';
import { GameEngine } from './gameEngine';
import { BUBBLE_RADIUS, CANVAS_WIDTH, CANVAS_HEIGHT, ALL_BUBBLE_TYPES, UI_COLORS, GRID_ROWS, GRID_COLS } from './constants';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [nextType, setNextType] = useState(0);
  const [currentType, setCurrentType] = useState(0);
  const [activeTypes, setActiveTypes] = useState(ALL_BUBBLE_TYPES.slice(0, 7));
  const [angle, setAngle] = useState(-Math.PI / 2);
  const [bgmUrl, setBgmUrl] = useState('bgm.mp3');
  const [isMuted, setIsMuted] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  const popAudioRef = useRef<HTMLAudioElement | null>(null);
  const bubbleFrameRef = useRef<HTMLImageElement | null>(null);

  const playPop = useCallback(() => {
    if (popAudioRef.current && !isMuted) {
      popAudioRef.current.currentTime = 0;
      popAudioRef.current.play().catch(() => {});
    }
  }, [isMuted]);

  const updateState = useCallback(() => {
    if (engineRef.current) {
      setScore(engineRef.current.score);
      setGameOver(engineRef.current.gameOver);
      setNextType(engineRef.current.nextTypeIndex);
      setCurrentType(engineRef.current.currentTypeIndex);
      setActiveTypes(engineRef.current.activeTypes);
    }
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    const engine = new GameEngine(updateState, playPop);
    engineRef.current = engine;
    updateState();

    // Load pop sound
    popAudioRef.current = new Audio('pop.wav');
    
    // Load bubble frame
    const img = new Image();
    img.src = 'bubble.png';
    img.onload = () => { bubbleFrameRef.current = img; };

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const render = () => {
      engine.update();
      draw(ctx, engine);
      animationId = requestAnimationFrame(render);
    };
    render();

    return () => cancelAnimationFrame(animationId);
  }, [updateState, playPop]);

  const draw = (ctx: CanvasRenderingContext2D, engine: GameEngine) => {
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // 绘制背景网格纹理 (FGO 风格)
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.05)';
    ctx.lineWidth = 1;
    for (let i = 0; i < CANVAS_WIDTH; i += 40) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, CANVAS_HEIGHT);
      ctx.stroke();
    }
    for (let i = 0; i < CANVAS_HEIGHT; i += 40) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(CANVAS_WIDTH, i);
      ctx.stroke();
    }

    // 绘制网格泡泡
    engine.grid.forEach((row) => {
      row.forEach((bubble) => {
        if (bubble) drawBubble(ctx, bubble.x, bubble.y, bubble.typeIndex);
      });
    });

    // 绘制正在消除的泡泡 (缩放 + 震动 + 透明度)
    engine.poppingBubbles.forEach((p) => {
      ctx.save();
      const scale = 1 - p.timer;
      const alpha = 1 - p.timer;
      ctx.globalAlpha = alpha;
      ctx.translate(p.x + p.shakeX, p.y + p.shakeY);
      ctx.scale(scale, scale);
      drawBubble(ctx, 0, 0, p.typeIndex);
      ctx.restore();
    });

    // 绘制正在掉落的泡泡
    engine.fallingBubbles.forEach((f) => {
      ctx.save();
      ctx.globalAlpha = f.opacity;
      drawBubble(ctx, f.x, f.y, f.typeIndex);
      ctx.restore();
    });

    // 绘制发射中的泡泡
    if (engine.projectile) {
      drawBubble(ctx, engine.projectile.x, engine.projectile.y, engine.projectile.typeIndex);
    }

    // 绘制发射器和预测轨迹
    const shooterX = CANVAS_WIDTH / 2;
    const shooterY = CANVAS_HEIGHT - 40;
    
      // 预测轨迹
      if (!engine.projectile && !engine.gameOver) {
        ctx.beginPath();
        ctx.setLineDash([8, 4]);
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.shadowBlur = 8;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.5)';
        
        let curX = shooterX;
        let curY = shooterY;
        let curVX = Math.cos(angle) * 12;
        let curVY = Math.sin(angle) * 12;
        
        ctx.moveTo(curX, curY);
        
        for (let i = 0; i < 50; i++) {
          curX += curVX;
          curY += curVY;
          
          if (curX < BUBBLE_RADIUS || curX > CANVAS_WIDTH - BUBBLE_RADIUS) {
            curVX *= -1;
          }
          
          ctx.lineTo(curX, curY);
          if (curY < BUBBLE_RADIUS) break;

          // 碰撞预测
          let hit = false;
          for (let r = 0; r < GRID_ROWS; r++) {
            for (let c = 0; c < GRID_COLS; c++) {
              const b = engine.grid[r][c];
              if (b) {
                const d = Math.hypot(curX - b.x, curY - b.y);
                if (d < BUBBLE_RADIUS * 2 - 4) { hit = true; break; }
              }
            }
            if (hit) break;
          }
          if (hit) break;
        }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.shadowBlur = 0;
      }

    drawBubble(ctx, shooterX, shooterY, engine.currentTypeIndex);
  };

  const imagesRef = useRef<Record<string, HTMLImageElement>>({});

  useEffect(() => {
    ALL_BUBBLE_TYPES.forEach(type => {
      const img = new Image();
      img.referrerPolicy = 'no-referrer';
      img.src = type.icon;
      img.onload = () => {
        imagesRef.current[type.id] = img;
      };
    });
  }, []);

  const drawBubble = (ctx: CanvasRenderingContext2D, x: number, y: number, typeIndex: number) => {
    if (!engineRef.current) return;
    const type = engineRef.current.activeTypes[typeIndex];
    if (!type) return;
    
    ctx.save();
    
    // 外部发光
    ctx.shadowBlur = 10;
    ctx.shadowColor = type.color;
    
    // 绘制 bubble.png 作为背景/框
    if (bubbleFrameRef.current && bubbleFrameRef.current.complete) {
      ctx.drawImage(
        bubbleFrameRef.current, 
        x - BUBBLE_RADIUS, 
        y - BUBBLE_RADIUS, 
        BUBBLE_RADIUS * 2, 
        BUBBLE_RADIUS * 2
      );
    } else {
      // 备用方案：绘制主体圆形
      ctx.beginPath();
      ctx.arc(x, y, BUBBLE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = type.color;
      ctx.fill();
    }

    // 绘制从者图片 (在泡泡内部)
    const img = imagesRef.current[type.id];
    if (img && img.complete && img.naturalWidth !== 0) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, BUBBLE_RADIUS - 4, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, x - BUBBLE_RADIUS + 2, y - BUBBLE_RADIUS + 2, (BUBBLE_RADIUS - 2) * 2, (BUBBLE_RADIUS - 2) * 2);
      ctx.restore();
    } else {
      // 如果图片没加载出来，显示文字标签
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 14px font-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(type.label, x, y);
    }

    // 绘制金边 (FGO 风格)
    ctx.beginPath();
    ctx.arc(x, y, BUBBLE_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.restore();
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    updateAngle(x, y);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const touch = e.touches[0];
    const scaleX = CANVAS_WIDTH / rect.width;
    const scaleY = CANVAS_HEIGHT / rect.height;
    const x = (touch.clientX - rect.left) * scaleX;
    const y = (touch.clientY - rect.top) * scaleY;
    updateAngle(x, y);
  };

  const updateAngle = (x: number, y: number) => {
    const shooterX = CANVAS_WIDTH / 2;
    const shooterY = CANVAS_HEIGHT - 40;
    
    let newAngle = Math.atan2(y - shooterY, x - shooterX);
    // 限制角度，防止向下射击
    if (newAngle > -0.1) newAngle = -0.1;
    if (newAngle < -Math.PI + 0.1) newAngle = -Math.PI + 0.1;
    setAngle(newAngle);
  };

  const handleClick = () => {
    engineRef.current?.shoot(angle);
  };

  const resetGame = () => {
    engineRef.current?.reset();
    setGameOver(false);
  };

  const startGame = () => {
    setGameStarted(true);
    if (audioRef.current && audioRef.current.src) {
      audioRef.current.play().catch(err => {
        console.warn("Audio playback failed, possibly due to browser restrictions or invalid source:", err);
      });
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#050A1A] text-white font-serif overflow-x-hidden flex flex-col items-center justify-start lg:justify-center p-4 relative">
      {/* 背景装饰 (FGO 风格) */}
      <div className="absolute inset-0 opacity-40 pointer-events-none overflow-hidden">
        <img 
          src="https://picsum.photos/seed/fgo_bg/1920/1080" 
          alt="Background" 
          className="w-full h-full object-cover scale-105 blur-[1px]"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-[#050A1A]/40" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(0,71,171,0.2),transparent)]" />
      </div>

      {/* 顶部 UI - FGO 编成风格 */}
      <div className="w-full max-w-md lg:max-w-5xl flex justify-between items-center mb-4 z-10 border-b-2 border-[#D4AF37]/30 pb-2 px-2">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl lg:text-3xl font-bold italic tracking-widest text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]">
              武内脸泡泡龙
            </h1>
          </div>
          <div className="flex gap-4 items-center">
            <div className="bg-gradient-to-r from-blue-900/80 to-transparent border-l-4 border-[#D4AF37] px-3 py-0.5">
              <span className="text-[8px] lg:text-[10px] uppercase tracking-widest text-[#D4AF37] block">战利品 LOOT</span>
              <span className="text-lg lg:text-2xl font-bold font-mono tracking-wider text-white">{score.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className="p-2 bg-blue-900/40 border border-[#D4AF37]/50 rounded-sm"
          >
            {isMuted ? <VolumeX size={18} className="text-[#D4AF37]" /> : <Volume2 size={18} className="text-[#D4AF37]" />}
          </button>
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 bg-blue-900/40 border border-[#D4AF37]/50 rounded-sm"
          >
            <Settings size={18} className="text-[#D4AF37]" />
          </button>
        </div>
      </div>

      {/* 游戏主体区域 */}
      <div className="relative z-10 flex flex-col lg:flex-row gap-4 lg:gap-8 items-center lg:items-start w-full max-w-md lg:max-w-none">
        {!gameStarted ? (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative p-8 lg:p-12 bg-[#050A1A]/90 border-2 border-[#D4AF37] shadow-[0_0_50px_rgba(212,175,55,0.3)] backdrop-blur-xl flex flex-col items-center w-full mx-4"
          >
            <div className="absolute -top-4 -left-4 w-12 h-12 border-t-4 border-l-4 border-[#D4AF37]" />
            <div className="absolute -top-4 -right-4 w-12 h-12 border-t-4 border-r-4 border-[#D4AF37]" />
            <div className="absolute -bottom-4 -left-4 w-12 h-12 border-b-4 border-l-4 border-[#D4AF37]" />
            <div className="absolute -bottom-4 -right-4 w-12 h-12 border-b-4 border-r-4 border-[#D4AF37]" />
            
            <h2 className="text-2xl lg:text-4xl font-bold text-[#D4AF37] mb-8 italic tracking-[0.2em] text-center">
              准备开始战斗
            </h2>
            
            <div className="flex flex-col gap-4 w-full max-w-[240px]">
              <button 
                onClick={startGame}
                className="group relative px-8 py-4 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-bold uppercase tracking-[0.4em] hover:brightness-125 transition-all shadow-[0_0_20px_rgba(212,175,55,0.4)] flex items-center justify-center gap-3"
              >
                <Play size={20} fill="currentColor" />
                开始游戏
              </button>
              
              <button 
                onClick={() => setShowSettings(true)}
                className="px-8 py-3 border border-[#D4AF37]/50 text-[#D4AF37] font-bold uppercase tracking-[0.2em] hover:bg-[#D4AF37]/10 transition-all text-sm"
              >
                系统设置
              </button>
            </div>
            
            <p className="mt-8 text-[10px] text-[#B0C4DE] opacity-50 tracking-widest uppercase">
              TYPE-MOON / Takeuchi Takashi Style
            </p>
          </motion.div>
        ) : (
          <>
            {/* 手机端顶部信息栏 */}
            <div className="lg:hidden w-full flex justify-between items-center px-4 mb-2">
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-[#D4AF37] font-bold uppercase tracking-widest">NEXT:</span>
                <div className="w-10 h-10 rounded-full border border-[#D4AF37] flex items-center justify-center overflow-hidden" style={{ backgroundColor: activeTypes[nextType]?.color }}>
                  <span className="text-xs font-bold">{activeTypes[nextType]?.label}</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-[#D4AF37] font-bold uppercase tracking-widest block">SCORE</span>
                <span className="text-xl font-mono font-bold">{score}</span>
              </div>
            </div>

            {/* 左侧边栏 - 下一位从者 (桌面端) */}
            <div className="hidden lg:flex flex-col gap-6">
              <div className="relative">
                <div className="absolute -top-3 -left-3 w-12 h-12 border-t-2 border-l-2 border-[#D4AF37] z-10" />
                <div className="bg-[#050A1A]/80 border border-[#D4AF37]/50 p-4 rounded-sm relative w-36 shadow-xl backdrop-blur-md">
                  <span className="text-[10px] uppercase tracking-widest text-[#D4AF37] block mb-3 text-center border-b border-[#D4AF37]/30 pb-1">下一位从者</span>
                  <div className="w-20 h-20 mx-auto rounded-full border-2 border-[#D4AF37] flex items-center justify-center relative overflow-hidden shadow-[0_0_15px_rgba(212,175,55,0.4)]" style={{ backgroundColor: activeTypes[nextType]?.color }}>
                    <span className="text-2xl font-bold drop-shadow-md">{activeTypes[nextType]?.label}</span>
                    <div className="absolute inset-0 bg-gradient-to-tr from-white/30 to-transparent" />
                  </div>
                  <div className="mt-3 text-center text-[10px] text-[#D4AF37] font-bold tracking-widest uppercase">{activeTypes[nextType]?.id}</div>
                </div>
              </div>
            </div>

            {/* 画布容器 */}
            <div className="relative w-full max-w-[440px] px-2">
              {/* 装饰角 */}
              <div className="absolute -top-2 -left-2 w-8 h-8 border-t-2 border-l-2 border-[#D4AF37] z-20" />
              <div className="absolute -top-2 -right-2 w-8 h-8 border-t-2 border-r-2 border-[#D4AF37] z-20" />
              <div className="absolute -bottom-2 -left-2 w-8 h-8 border-b-2 border-l-2 border-[#D4AF37] z-20" />
              <div className="absolute -bottom-2 -right-2 w-8 h-8 border-b-2 border-r-2 border-[#D4AF37] z-20" />

              <div className="relative p-0.5 bg-gradient-to-b from-[#D4AF37] via-[#D4AF37]/20 to-[#D4AF37] shadow-2xl overflow-hidden">
                <canvas
                  ref={canvasRef}
                  width={CANVAS_WIDTH}
                  height={CANVAS_HEIGHT}
                  onMouseMove={handleMouseMove}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleClick}
                  onClick={handleClick}
                  className="w-full h-auto bg-[#050A1A] cursor-crosshair touch-none"
                />
              </div>

          {/* 游戏结束覆盖层 */}
          <AnimatePresence>
            {gameOver && (
              <motion.div 
                initial={{ opacity: 0, scale: 1.1 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="absolute inset-0 bg-black/85 flex flex-col items-center justify-center z-30 backdrop-blur-sm"
              >
                <div className="relative p-8 border-y-2 border-[#D4AF37] w-full text-center bg-blue-900/20">
                  <motion.h2 
                    initial={{ y: 20 }}
                    animate={{ y: 0 }}
                    className="text-5xl font-bold text-[#D4AF37] mb-4 uppercase tracking-[0.2em] italic drop-shadow-[0_0_15px_rgba(212,175,55,0.6)]"
                  >
                    任务失败
                  </motion.h2>
                  <p className="text-[#B0C4DE] mb-8 font-mono text-xl tracking-widest">最终战绩: {score}</p>
                  <button 
                    onClick={resetGame}
                    className="relative px-16 py-4 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-bold uppercase tracking-[0.3em] hover:brightness-125 transition-all shadow-[0_0_20px_rgba(212,175,55,0.4)]"
                  >
                    再次挑战
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </>
    )}
  </div>

      {/* 底部菜单栏 - 已删除 */}

      {/* 设置弹窗 */}
      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4 backdrop-blur-md"
          >
            <div className="bg-[#050A1A] border-2 border-[#D4AF37] p-10 max-w-lg w-full relative shadow-[0_0_50px_rgba(0,71,171,0.4)]">
              <button 
                onClick={() => setShowSettings(false)}
                className="absolute top-6 right-6 text-[#D4AF37] hover:text-white transition-colors"
              >
                <X size={28} />
              </button>
              
              <h2 className="text-3xl font-bold text-[#D4AF37] mb-8 uppercase tracking-[0.2em] italic flex items-center gap-4 border-b border-[#D4AF37]/30 pb-4">
                <Music size={24} /> 系统设置
              </h2>

              <div className="space-y-8">
                <div>
                  <label className="block text-xs text-[#D4AF37] uppercase tracking-widest mb-3 font-bold">背景音乐 URL (BGM)</label>
                  <input 
                    type="text" 
                    value={bgmUrl}
                    onChange={(e) => setBgmUrl(e.target.value)}
                    className="w-full bg-blue-900/20 border border-[#D4AF37]/50 p-4 text-sm font-mono focus:outline-none focus:border-[#D4AF37] text-white"
                    placeholder="请输入 MP3 链接..."
                  />
                  <p className="text-[10px] text-[#B0C4DE] mt-3 italic opacity-60">支持直接填入 MP3 文件的网络地址。</p>
                </div>

                <div className="flex justify-between items-center bg-blue-900/10 p-4 border border-[#D4AF37]/20">
                  <span className="text-xs text-[#D4AF37] uppercase tracking-widest font-bold">主音量调节</span>
                  <input type="range" className="accent-[#D4AF37] w-48" />
                </div>

                <button 
                  onClick={() => setShowSettings(false)}
                  className="w-full py-4 bg-gradient-to-r from-[#D4AF37] to-[#B8860B] text-black font-bold uppercase tracking-widest hover:brightness-110 transition-all shadow-lg"
                >
                  确认并返回
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 音频元素 */}
      <audio 
        ref={audioRef} 
        src={bgmUrl} 
        loop 
        muted={isMuted} 
      />
    </div>
  );
}
