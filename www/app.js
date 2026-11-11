const state = {
  messages: JSON.parse(localStorage.getItem('impulso_messages') || '[]'),
  goal: localStorage.getItem('impulso_goal') || '',
  lastStep: localStorage.getItem('impulso_last_step') || '',
  nextStep: localStorage.getItem('impulso_next_step') || '',
  status: localStorage.getItem('impulso_status') || 'idle',
  progress: Number(localStorage.getItem('impulso_progress') || 0),
  blocker: localStorage.getItem('impulso_blocker') || '',
  energy: localStorage.getItem('impulso_energy') || 'unknown',
  mode: localStorage.getItem('impulso_mode') || 'support'
};

const $ = (s) => document.querySelector(s);
const userInput = $('#userInput');
const chatInput = $('#chatInput');
const homeView = $('#homeView');
const conversationView = $('#conversationView');
const messagesEl = $('#messages');
const actionBar = $('#actionBar');

function save(){
  localStorage.setItem('impulso_messages', JSON.stringify(state.messages));
  localStorage.setItem('impulso_goal', state.goal);
  localStorage.setItem('impulso_last_step', state.lastStep);
  localStorage.setItem('impulso_next_step', state.nextStep);
  localStorage.setItem('impulso_status', state.status);
  localStorage.setItem('impulso_progress', state.progress);
  localStorage.setItem('impulso_blocker', state.blocker);
  localStorage.setItem('impulso_energy', state.energy);
  localStorage.setItem('impulso_mode', state.mode);
}
function escapeHTML(str){return str.replace(/[&<>'"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','"':'&quot;'}[c]));}
function renderMessages(){
  messagesEl.innerHTML = state.messages.map(m => m.role === 'user'
    ? `<div class="message user"><div class="bubble">${escapeHTML(m.content)}</div></div>`
    : `<div class="message"><span class="ai-avatar"></span><div class="bubble">${escapeHTML(m.content)}</div></div>`).join('');
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
function setProgress(value, label){
  state.progress = Math.max(0, Math.min(100, value));
  $('#progressLine').style.width = `${Math.max(8,state.progress)}%`;
  $('#progressPercent').textContent = `${state.progress}%`;
  if(label) $('#currentStepLabel').textContent = label;
}
function openConversation(){
  homeView.classList.add('hidden');
  $('.quick-start').classList.add('hidden');
  conversationView.classList.remove('hidden');
  renderMessages();
  updateSessionUI();
  chatInput.focus();
}
function startConversation(text){
  const clean = text.trim(); if(!clean) return;
  openConversation();
  sendMessage(clean);
}
function updateSessionUI(){
  const stateText = state.status === 'resting' ? 'En pausa' : state.status === 'completed' ? 'Completado' : 'En curso';
  $('#sessionState').textContent = stateText;
  $('#sessionState').style.background = state.status === 'resting' ? '#F4EFE5' : 'var(--green-soft)';
  $('#sessionState').style.color = state.status === 'resting' ? '#8B6B37' : 'var(--green)';
  actionBar.classList.toggle('hidden', !state.messages.length || state.status === 'completed');
}
async function sendMessage(text){
  state.status = 'active';
  state.messages.push({role:'user', content:text});
  if(!state.goal) state.goal = text;
  save(); renderMessages(); updateSessionUI();
  setProgress(Math.max(state.progress, 12), 'Entender qué necesitás');

  const typing = {role:'assistant', content:'…'};
  state.messages.push(typing); renderMessages();
  try{
    const history = state.messages.slice(0,-1);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    const res = await fetch('https://genjagrxsmyrtaaplzwe.supabase.co/functions/v1/chat', {
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json'},
      body: JSON.stringify({messages: history, state: {goal:state.goal, blocker:state.blocker, energy:state.energy, lastStep:state.lastStep, nextStep:state.nextStep, status:state.status, progress:state.progress, mode:state.mode}}),
      signal: controller.signal
    });
    clearTimeout(timeout);
    const rawResponse = await res.text();
    let data = {};
    try { data = JSON.parse(rawResponse || '{}'); } catch {}
    if(!res.ok){
      const diagnostic = data && data.diagnostic ? data.diagnostic : {};
      const requestId = data && data.requestId ? data.requestId : '';
      const rawDetail = rawResponse ? ` Detalle: ${rawResponse.slice(0, 300)}` : '';
      const detail = (new URLSearchParams(location.search).has('diag'))
        ? ` Diagnóstico: HTTP ${diagnostic.status ?? res.status}; type=${diagnostic.type ?? 'unknown'}; code=${diagnostic.code ?? 'unknown'}${requestId ? `; id=${requestId}` : ''}.`
        : '';
      const apiError = (data && typeof data.error === 'string') ? ` Error: ${data.error.slice(0, 300)}` : '';
      throw new Error(`HTTP ${res.status}.${detail}${apiError}${rawDetail}`);
    }
    const reply = data.reply || data.message || 'No pude obtener una respuesta en este momento.';
    state.messages[state.messages.length-1] = {role:'assistant', content:reply};
    state.goal = data.goal ?? state.goal;
    state.blocker = data.blocker ?? state.blocker;
    state.energy = data.energy ?? state.energy;
    state.nextStep = data.nextStep ?? state.nextStep;
    state.lastStep = data.lastStep ?? state.lastStep;
    state.status = data.status ?? state.status;
    state.mode = data.mode ?? state.mode;
    if(typeof data.progress === 'number') state.progress = data.progress;
    save(); renderMessages(); updateSessionUI();
  }catch(err){
    if (typeof timeout !== 'undefined') clearTimeout(timeout);
    const diagnosticMode = new URLSearchParams(location.search).has('diag');
    const message = diagnosticMode && err && err.message
      ? err.message
      : 'Ahora mismo no puedo conectar con la IA. La conversación queda guardada; cuando la conexión esté disponible, seguimos desde acá.';
    state.messages[state.messages.length-1] = {role:'assistant', content:message};
    save(); renderMessages();
  }
}

$('#sendBtn').addEventListener('click',()=>startConversation(userInput.value));
userInput.addEventListener('keydown',e=>{ if(e.key==='Enter' && !e.shiftKey){e.preventDefault();startConversation(userInput.value);} });

document.querySelectorAll('.path-card').forEach(btn=>btn.addEventListener('click',()=>startConversation(btn.dataset.prompt)));
$('#chatSendBtn').addEventListener('click',()=>{const t=chatInput.value.trim(); if(t){chatInput.value='';sendMessage(t)}});
chatInput.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();$('#chatSendBtn').click()}});
$('#backBtn').addEventListener('click',()=>{conversationView.classList.add('hidden');homeView.classList.remove('hidden');$('.quick-start').classList.remove('hidden')});
$('#newSessionBtn').addEventListener('click',()=>{state.messages=[];state.goal='';state.lastStep='';state.nextStep='';state.status='idle';state.progress=0;state.blocker='';state.energy='unknown';state.mode='support';save();location.reload()});
$('#doneBtn').addEventListener('click',()=>{state.progress=Math.min(100,state.progress+18);state.status=state.progress>=100?'completed':'active';state.lastStep=state.nextStep||state.lastStep;state.nextStep='';save();setProgress(state.progress,state.status==='completed'?'Objetivo completado':'Reconocer el avance y elegir el próximo paso');updateSessionUI();sendMessage('Lo hice. Quiero seguir con el próximo paso.');});
$('#restBtn').addEventListener('click',()=>{state.status='resting';save();updateSessionUI();sendMessage('Necesito descansar por hoy. Guardemos dónde quedé y retomamos mañana.');});
$('#stuckBtn').addEventListener('click',()=>sendMessage('Me trabé. Necesito que me ayudes a encontrar otra forma de avanzar.'));

if(state.messages.length){openConversation();}
