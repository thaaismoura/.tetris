// ---------- Configuração do jogo ----------
const COLS = 10, ROWS = 20, BLOCK = 30; // 300x600
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next');
const nctx = nextCanvas.getContext('2d');

// Paleta
const COLORS = { I:'#60a5fa', J:'#c084fc', L:'#34d399', O:'#f59e0b', S:'#22d3ee', T:'#f472b6', Z:'#fb7185', X:'rgba(255,255,255,.07)' };

// Formas
const SHAPES = {
  I:[[1,1,1,1]],
  J:[[1,0,0],[1,1,1]],
  L:[[0,0,1],[1,1,1]],
  O:[[1,1],[1,1]],
  S:[[0,1,1],[1,1,0]],
  T:[[0,1,0],[1,1,1]],
  Z:[[1,1,0],[0,1,1]],
};
const PIECES = Object.keys(SHAPES);

// Estado
const state = {
  board: Array.from({length: ROWS}, () => Array(COLS).fill('')),
  piece: null, next: null, pos: {x:0,y:0},
  score: 0, lines: 0, level: 1,
  dropInterval: 1000, lastTime: 0, acc: 0,
  running: false, gameover: false,
};

function randomPiece(){
  const t = PIECES[(Math.random()*PIECES.length) | 0];
  return { type: t, matrix: SHAPES[t].map(r=>r.slice()) };
}
function rotate(m){
  const N = m.length, M = m[0].length;
  const r = Array.from({length:M},()=>Array(N).fill(0));
  for(let y=0;y<N;y++) for(let x=0;x<M;x++) r[x][N-1-y]=m[y][x];
  return r;
}

// >>> CORREÇÃO AQUI: permitir y < 0 no spawn (não colide enquanto estiver acima do topo)
function collide(board, matrix, pos){
  for(let y=0;y<matrix.length;y++){
    for(let x=0;x<matrix[y].length;x++){
      if(matrix[y][x]){
        const ny = y + pos.y, nx = x + pos.x;
        if (nx < 0 || nx >= COLS || ny >= ROWS) return true;          // paredes e chão
        if (ny >= 0 && board[ny][nx]) return true;                    // só verifica board se dentro da área visível
      }
    }
  }
  return false;
}

function merge(){
  const {matrix,type} = state.piece;
  for(let y=0;y<matrix.length;y++) for(let x=0;x<matrix[y].length;x++){
    if(matrix[y][x]) state.board[state.pos.y+y][state.pos.x+x]=type;
  }
}
function clearLines(){
  let cleared = 0;
  for(let y=ROWS-1; y>=0; y--){
    if(state.board[y].every(Boolean)){
      state.board.splice(y,1);
      state.board.unshift(Array(COLS).fill(''));
      cleared++; y++;
    }
  }
  if(cleared){
    const points = [0,40,100,300,1200][cleared] * state.level;
    state.score += points; state.lines += cleared;
    if(state.lines >= state.level*10){
      state.level++; state.dropInterval = Math.max(120, 1000 - (state.level-1)*80);
    }
    updateHUD();
  }
}

function spawn(){
  state.piece = state.next || randomPiece();
  state.next = randomPiece();
  state.pos.x = ((COLS/2)|0) - ((state.piece.matrix[0].length/2)|0);
  state.pos.y = -1; // nasce um pouco acima

  // Se colidir mesmo com a correção -> game over
  if(collide(state.board, state.piece.matrix, state.pos)){
    gameOver();
    return false;
  }
  drawNext();
  return true;
}

function hardDrop(){
  while(!collide(state.board, state.piece.matrix, {x:state.pos.x, y:state.pos.y+1})) state.pos.y++;
  lockPiece();
}
function move(dx){
  const np = {x: state.pos.x+dx, y: state.pos.y};
  if(!collide(state.board, state.piece.matrix, np)) state.pos = np;
}
function soft(){
  const np = {x: state.pos.x, y: state.pos.y+1};
  if(!collide(state.board, state.piece.matrix, np)) state.pos = np; else lockPiece();
}
function spin(){
  const r = rotate(state.piece.matrix);
  for(const k of [0,-1,1,-2,2]){
    const np = {x: state.pos.x + k, y: state.pos.y};
    if(!collide(state.board, r, np)){ state.piece.matrix = r; state.pos = np; return; }
  }
}
function lockPiece(){ merge(); clearLines(); spawn(); }

// ---------- Desenho ----------
function drawCell(x,y,type){
  const px = x*BLOCK, py = y*BLOCK;
  ctx.fillStyle = COLORS[type] || COLORS.X;
  ctx.fillRect(px+1, py+1, BLOCK-2, BLOCK-2);
}
function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = 'rgba(255,255,255,.04)';
  for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++){
    ctx.fillRect(x*BLOCK+1, y*BLOCK+1, BLOCK-2, BLOCK-2);
  }
  for(let y=0;y<ROWS;y++) for(let x=0;x<COLS;x++){
    if(state.board[y][x]) drawCell(x,y,state.board[y][x]);
  }
  if(state.piece){
    for(let y=0;y<state.piece.matrix.length;y++) for(let x=0;x<state.piece.matrix[y].length;x++){
      if(state.piece.matrix[y][x]){
        const gx = state.pos.x + x, gy = state.pos.y + y;
        if(gy>=0) drawCell(gx,gy,state.piece.type);
      }
    }
  }
}

function drawNext(){
  nctx.clearRect(0,0,nextCanvas.width,nextCanvas.height);
  const m = state.next.matrix; const t = state.next.type;
  const bw = m[0].length, bh = m.length;
  const size = 12;
  const ox = Math.floor((nextCanvas.width - bw*size)/2);
  const oy = Math.floor((nextCanvas.height - bh*size)/2);
  nctx.fillStyle = 'rgba(255,255,255,.05)';
  nctx.fillRect(0,0,nextCanvas.width,nextCanvas.height);
  for(let y=0;y<bh;y++) for(let x=0;x<bw;x++) if(m[y][x]){
    nctx.fillStyle = COLORS[t];
    nctx.fillRect(ox + x*size + 1, oy + y*size + 1, size-2, size-2);
  }
}

// ---------- Loop ----------
function update(time=0){
  if(!state.running) return;
  const dt = time - state.lastTime; state.lastTime = time; state.acc += dt;
  if(state.acc >= state.dropInterval){ state.acc = 0; soft(); }
  draw();
  requestAnimationFrame(update);
}

// ---------- HUD ----------
function updateHUD(){
  score.textContent = state.score;
  lines.textContent = state.lines;
  level.textContent = state.level;
  speed.textContent = (1000/state.dropInterval).toFixed(1)+'x';
}

// ---------- Controle do jogo ----------
function reset(){
  state.board = Array.from({length: ROWS}, () => Array(COLS).fill(''));
  state.score=0; state.lines=0; state.level=1; state.dropInterval=1000; state.acc=0; state.gameover=false;
  updateHUD();
}
function start(){
  overlayStart.style.display='none';
  overlayGO.classList.remove('show');
  reset();
  state.next = randomPiece();
  if(spawn()){ state.running = true; state.lastTime = 0; requestAnimationFrame(update); }
}
function gameOver(){
  state.running = false; state.gameover = true;
  overlayGO.classList.add('show');
}

// Botões
btnStart.onclick = start;
btnAgain.onclick = ()=>{ overlayStart.style.display='none'; start(); };

// Toque/Mouse
const hold = (el, fn) => {
  let h; const run = ()=>{ fn(); h = requestAnimationFrame(run); };
  el.addEventListener('touchstart', (e)=>{ e.preventDefault(); fn(); h=requestAnimationFrame(run); }, {passive:false});
  el.addEventListener('touchend', ()=> cancelAnimationFrame(h));
  el.addEventListener('mousedown', ()=>{ fn(); h=requestAnimationFrame(run); });
  el.addEventListener('mouseup', ()=> cancelAnimationFrame(h));
  el.addEventListener('mouseleave', ()=> cancelAnimationFrame(h));
};
hold(btnLeft, ()=> state.running && move(-1));
hold(btnRight,()=> state.running && move(1));
hold(btnDown, ()=> state.running && soft());
btnUp.onclick = ()=> state.running && spin();
btnDrop.onclick = ()=> state.running && hardDrop();

// Início
window.addEventListener('load', ()=>{
  overlayStart.style.display='flex';
  draw();
});
