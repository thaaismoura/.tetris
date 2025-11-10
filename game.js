/* ========= TETRIS – game.js (pause, gradativo e sem cortes) ========= */

/* --- Config base --- */
const COLS = 10, ROWS = 20, BLOCK = 30;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nctx = nextCanvas ? nextCanvas.getContext('2d') : null;

const overlayStart = document.getElementById('overlayStart');
const overlayGO = document.getElementById('overlayGO');
const btnStart = document.getElementById('btnStart');
const btnAgain = document.getElementById('btnAgain');

const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const speedEl = document.getElementById('speed');

const COLORS = { I:'#60a5fa', J:'#c084fc', L:'#34d399', O:'#f59e0b', S:'#22d3ee', T:'#f472b6', Z:'#fb7185', X:'rgba(255,255,255,.07)' };
const SHAPES = {
  I:[[1,1,1,1]], J:[[1,0,0],[1,1,1]], L:[[0,0,1],[1,1,1]],
  O:[[1,1],[1,1]], S:[[0,1,1],[1,1,0]], T:[[0,1,0],[1,1,1]], Z:[[1,1,0],[0,1,1]],
};
const PIECES = Object.keys(SHAPES);

const state = {
  board: Array.from({length:ROWS},()=>Array(COLS).fill('')),
  piece:null, next:null, pos:{x:0,y:0},
  score:0, lines:0, level:1,
  dropInterval:1000, lastTime:0, acc:0,
  running:false, paused:false, gameover:false
};

/* --- Utils --- */
function randomPiece(){ const t=PIECES[(Math.random()*PIECES.length)|0]; return {type:t,matrix:SHAPES[t].map(r=>r.slice())}; }
function rotate(m){ const N=m.length,M=m[0].length,r=Array.from({length:M},()=>Array(N).fill(0)); for(let y=0;y<N;y++)for(let x=0;x<M;x++)r[x][N-1-y]=m[y][x]; return r; }
function collide(b,m,p){
  for(let y=0;y<m.length;y++)for(let x=0;x<m[y].length;x++) if(m[y][x]){
    const ny=y+p.y, nx=x+p.x;
    if(nx<0||nx>=COLS||ny>=ROWS) return true;
    if(ny>=0 && b[ny][nx]) return true;
  }
  return false;
}

/* --- Mecânicas --- */
function merge(){ const {matrix,type}=state.piece; for(let y=0;y<matrix.length;y++)for(let x=0;x<matrix[y].length;x++) if(matrix[y][x]) state.board[state.pos.y+y][state.pos.x+x]=type; }
function clearLines(){
  let c=0; for(let y=ROWS-1;y>=0;y--){ if(state.board[y].every(Boolean)){ state.board.splice(y,1); state.board.unshift(Array(COLS).fill('')); c++; y++; } }
  if(c){ const pts=[0,40,100,300,1200][c]*state.level; state.score+=pts; state.lines+=c;
    if(state.lines>=state.level*10){ state.level++; state.dropInterval=Math.max(120,1000-(state.level-1)*80); }
    updateHUD();
  }
}
function spawn(){
  state.piece=state.next||randomPiece(); state.next=randomPiece();
  state.pos.x=((COLS/2)|0)-((state.piece.matrix[0].length/2)|0);
  state.pos.y=-1;
  if(collide(state.board,state.piece.matrix,state.pos)){ gameOver(); return false; }
  drawNext(); return true;
}
function hardDrop(){ while(!collide(state.board,state.piece.matrix,{x:state.pos.x,y:state.pos.y+1})) state.pos.y++; lockPiece(); }
function move(dx){ const np={x:state.pos.x+dx,y:state.pos.y}; if(!collide(state.board,state.piece.matrix,np)) state.pos=np; }
function soft(){ const np={x:state.pos.x,y:state.pos.y+1}; if(!collide(state.board,state.piece.matrix,np)) state.pos=np; else lockPiece(); }
function spin(){ const r=rotate(state.piece.matrix); for(const k of [0,-1,1,-2,2]){ const np={x:state.pos.x+k,y:state.pos.y}; if(!collide(state.board,r,np)){ state.piece.matrix=r; state.pos=np; return; } } }
function lockPiece(){ merge(); clearLines(); spawn(); }

/* --- Desenho --- */
function drawCell(x,y,t){ ctx.fillStyle=COLORS[t]||COLORS.X; ctx.fillRect(x*30+1,y*30+1,28,28); }
function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle='rgba(255,255,255,.04)';
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++) ctx.fillRect(x*30+1,y*30+1,28,28);
  for(let y=0;y<ROWS;y++)for(let x=0;x<COLS;x++) if(state.board[y][x]) drawCell(x,y,state.board[y][x]);
  if(state.piece){ for(let y=0;y<state.piece.matrix.length;y++)for(let x=0;x<state.piece.matrix[y].length;x++) if(state.piece.matrix[y][x]){ const gx=state.pos.x+x, gy=state.pos.y+y; if(gy>=0) drawCell(gx,gy,state.piece.type); } }
}
function drawNext(){
  if(!nctx) return;
  nctx.clearRect(0,0,nextCanvas.width,nextCanvas.height);
  const m=state.next.matrix,t=state.next.type,bw=m[0].length,bh=m.length;
  const size=Math.max(6,Math.floor(Math.min((nextCanvas.width-4)/bw,(nextCanvas.height-4)/bh)));
  const ox=Math.floor((nextCanvas.width-bw*size)/2), oy=Math.floor((nextCanvas.height-bh*size)/2);
  nctx.fillStyle='rgba(255,255,255,.05)'; nctx.fillRect(0,0,nextCanvas.width,nextCanvas.height);
  for(let y=0;y<bh;y++)for(let x=0;x<bw;x++) if(m[y][x]){ nctx.fillStyle=COLORS[t]; nctx.fillRect(ox+x*size+1,oy+y*size+1,size-2,size-2); }
}

/* --- Loop --- */
function update(time=0){
  if(!state.running || state.paused) return;
  const dt=time-state.lastTime; state.lastTime=time; state.acc+=dt;
  if(state.acc>=state.dropInterval){ state.acc=0; soft(); }
  draw(); requestAnimationFrame(update);
}

/* --- HUD --- */
function updateHUD(){
  if(scoreEl) scoreEl.textContent=state.score;
  if(linesEl) linesEl.textContent=state.lines;
  if(levelEl) levelEl.textContent=state.level;
  if(speedEl) speedEl.textContent=(1000/state.dropInterval).toFixed(1)+'x';
}

/* --- Fluxo --- */
function reset(){
  state.board=Array.from({length:ROWS},()=>Array(COLS).fill(''));
  state.score=0; state.lines=0; state.level=1;
  state.dropInterval=1000; state.acc=0; state.gameover=false; state.paused=false;
  updateHUD();
}
function start(){
  document.body.classList.add('playing');          // esconde painel Info
  if(overlayStart) overlayStart.style.display='none';
  if(overlayGO) overlayGO.classList.remove('show');
  reset(); state.next=randomPiece();
  if(spawn()){ state.running=true; state.lastTime=0; requestAnimationFrame(update); }
}
function pauseGame(){
  if(!state.running) return;
  state.paused = true;
  if(btnStart){ btnStart.textContent='Retomar'; }
  if(overlayStart){ overlayStart.style.display='flex'; }
}
function resumeGame(){
  if(!state.running) return;
  state.paused = false;
  if(overlayStart) overlayStart.style.display='none';
  requestAnimationFrame(update);
}
function togglePause(){
  if(!state.running) return;
  if(state.paused) resumeGame(); else pauseGame();
}
function gameOver(){
  state.running=false; state.gameover=true; state.paused=false;
  document.body.classList.remove('playing');       // mostra Info de novo
  if(overlayGO) overlayGO.classList.add('show');
  if(btnStart) btnStart.textContent='Começar';
  resizeCanvas();                                   // recalcula com Info visível
}

/* --- Controles --- */
function gradualHold(el, fn, delay=160){
  if(!el) return;
  let id;
  const down=(e)=>{ e && e.preventDefault(); fn(); id=setInterval(fn,delay); };
  const up = ()=>{ clearInterval(id); id=null; };
  el.addEventListener('touchstart', down, {passive:false});
  el.addEventListener('touchend', up);
  el.addEventListener('mousedown', down);
  el.addEventListener('mouseup', up);
  el.addEventListener('mouseleave', up);
}

const btnLeft  = document.getElementById('btnLeft');
const btnRight = document.getElementById('btnRight');
const btnDown  = document.getElementById('btnDown');
const btnUp    = document.getElementById('btnUp');
const btnDrop  = document.getElementById('btnDrop');
const btnPause = document.getElementById('btnPause');

gradualHold(btnLeft,  ()=> state.running && !state.paused && move(-1), 160);
gradualHold(btnRight, ()=> state.running && !state.paused && move(1),  160);
gradualHold(btnDown,  ()=> state.running && !state.paused && soft(),   120);
if(btnUp)   btnUp.onclick   = ()=> state.running && !state.paused && spin();
if(btnDrop) btnDrop.onclick = ()=> state.running && !state.paused && hardDrop();
if(btnPause) btnPause.onclick = togglePause;

// Teclado (opcional no desktop)
window.addEventListener('keydown', (e)=>{
  if(!state.running) return;
  if(e.code==='KeyP'){ togglePause(); return; }
  if(state.paused) return;
  switch(e.code){
    case 'ArrowLeft':  move(-1); break;
    case 'ArrowRight': move(1);  break;
    case 'ArrowDown':  soft();   break;
    case 'ArrowUp':    spin();   break;
    case 'Space': e.preventDefault(); hardDrop(); break;
  }
});

/* --- Redimensionamento (com margem de segurança) --- */
function viewportWH(){ const vv=window.visualViewport; return { w: vv ? vv.width : window.innerWidth, h: vv ? vv.height : window.innerHeight }; }
function resizeCanvas(){
  const {w:vw,h:vh}=viewportWH();
  const columnW=Math.min(vw,540);

  const titleH=document.querySelector('.title')?.getBoundingClientRect().height||0;
  const info=document.querySelector('.info-panel');
  const infoH=(info && getComputedStyle(info).display!=='none') ? (info.getBoundingClientRect().height||0) : 0;
  const dockH=document.querySelector('.controls-dock')?.getBoundingClientRect().height||100;
  const stage=document.querySelector('.stage');

  const gaps=24, safety=10; // safety reduz um pouco para garantir que não corte
  const availableH=Math.max(220, vh - dockH - titleH - infoH - gaps - safety);

  const maxW=columnW - 32;
  let targetW=Math.min(maxW, availableH/2) * 0.98; // 2% menor
  targetW=Math.max(208, Math.min(320, targetW));   // limites ajustados
  const targetH=targetW*2;

  canvas.style.width=targetW+'px';
  canvas.style.height=targetH+'px';
  stage.style.maxWidth=(targetW+16)+'px';
}
function bindResize(){
  resizeCanvas();
  if(window.visualViewport){
    visualViewport.addEventListener('resize', resizeCanvas);
    visualViewport.addEventListener('scroll', resizeCanvas);
  }
  window.addEventListener('resize', resizeCanvas);
  window.addEventListener('orientationchange', resizeCanvas);
}

/* --- Eventos de UI --- */
if(btnStart) btnStart.addEventListener('click', ()=>{
  if(!state.running || state.gameover){ start(); }
  else if(state.paused){ resumeGame(); }
});
if(btnAgain) btnAgain.addEventListener('click', ()=>{ start(); });

window.addEventListener('load', ()=>{
  if(overlayStart) overlayStart.style.display='flex';
  draw();       // grade inicial
  bindResize(); // garante que tudo caiba
});
