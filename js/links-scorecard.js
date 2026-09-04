import { scoreName } from './links-game.js?v=20260904h';
import { clubBird } from './links-delight.js?v=20260904h';

export function drawScorecard(ctx, { state, puzzleNumber, date }, bird) {
  const W = 840, H = 900;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#f8f2df'; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = '#d6cfb8'; ctx.lineWidth = 2;
  ctx.strokeRect(24, 24, W - 48, H - 48);
  const text = (value, x, y, size = 24, color = '#264d3b', align = 'left', weight = 'normal', family = 'Arial') => {
    ctx.fillStyle = color; ctx.textAlign = align; ctx.font = `${weight} ${size}px ${family}`; ctx.fillText(value, x, y);
  };
  ctx.fillStyle = '#264d3b'; ctx.fillRect(24, 24, W - 48, 152);
  text('Links', 60, 113, 76, '#fff8e5', 'left', 'bold', 'Georgia');
  text('DAILY WORD GOLF', 778, 83, 19, '#fff8e5', 'right');
  text('DAILY SCORECARD', 778, 120, 16, '#cdddba', 'right');
  text(date || 'ONE HOLE. EVERY DAY.', 60, 220, 19, '#60735b', 'left', 'normal', 'monospace');
  text(`${state.tee.toUpperCase()}  →  ${state.hole.toUpperCase()}`, 60, 268, 29, '#264d3b', 'left', 'bold');
  const xs = [60, 300, 540, 780];
  ctx.fillStyle = '#e4e9d1'; ctx.fillRect(60, 308, 720, 58);
  ctx.strokeStyle = '#879b76'; ctx.lineWidth = 2;
  for (const y of [308, 366, 506]) { ctx.beginPath(); ctx.moveTo(60,y); ctx.lineTo(780,y); ctx.stroke(); }
  for (const x of xs) { ctx.beginPath(); ctx.moveTo(x,308); ctx.lineTo(x,506); ctx.stroke(); }
  ['HOLE','PAR','STROKES'].forEach((v,i) => text(v,xs[i]+120,345,20,'#264d3b','center','bold'));
  [puzzleNumber,state.par,state.strokes].forEach((v,i) => text(String(v),xs[i]+120,462,58,'#264d3b','center','normal','Georgia'));
  const diff = state.strokes - state.par;
  ctx.strokeStyle = '#b9573e'; ctx.lineWidth = 3.5;
  if (diff < 0) {
    ctx.beginPath(); ctx.ellipse(660,442,47,48,-.08,0,Math.PI*2); ctx.stroke();
    if (diff < -1) { ctx.beginPath(); ctx.ellipse(660,442,53,54,.04,0,Math.PI*2); ctx.stroke(); }
  } else if (diff > 0) {
    ctx.strokeRect(614,394,92,92);
    if (diff > 1) ctx.strokeRect(608,388,104,104);
  }
  text(scoreName(state.strokes, state.par).toUpperCase(),60,575,44,'#264d3b','left','bold','Georgia');
  text(diff === 0 ? 'Level par.' : `${Math.abs(diff)} ${diff < 0 ? 'under' : 'over'} par.`,60,618,25);
  const assists = `${state.hints || 0} hints${state.undoUsed ? ' · free undo used' : ''}`;
  text(assists,60,668,20,'#60735b');
  ctx.strokeStyle = '#c1cbb0'; ctx.beginPath(); ctx.moveTo(60,712); ctx.lineTo(520,712); ctx.stroke();
  text('A ROUND TO KEEP',60,746,16,'#60735b');
  text('Can you find your way?',60,787,24,'#264d3b','left','normal','Georgia');
  if (bird) {
    ctx.fillStyle = '#264d3b'; ctx.fillRect(665,730,3,55);
    ctx.fillStyle = '#dc9051'; ctx.beginPath();ctx.moveTo(668,732);ctx.lineTo(716,747);ctx.lineTo(668,765);ctx.fill();
    ctx.drawImage(bird, 569, 543, 205, 205);
  }
  text(`iamgrantbrown.github.io/drift-game/${date ? '?date=' + date : ''}`,420,847,16,'#60735b','center','normal','monospace');
}

let birdPromise;
function loadBird() {
  return birdPromise ??= new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(clubBird());
  });
}
export async function renderShareImage(canvas, props) {
  canvas.width = 840; canvas.height = 900;
  const bird = await loadBird();
  drawScorecard(canvas.getContext('2d'), props, bird);
  canvas.setAttribute('aria-label', `Links hole ${props.puzzleNumber}. ${props.state.tee} to ${props.state.hole}. Par ${props.state.par}, ${props.state.strokes} strokes. ${scoreName(props.state.strokes, props.state.par)}.`);
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
}
