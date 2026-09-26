import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronRight, Clock3, Copy, Crosshair, Droplets, Heart, HeartHandshake, Menu, Plus, Shield, Skull, Sparkles, Swords, Users, X, Zap } from 'lucide-react'
import { CLASSES, initialState, RULES, type ClassId, type GameState } from './game'
import { matchesGesture, type Point } from './gesture'
import { randomCode, Room } from './network'
import './App.css'

const icons = { padrao: Crosshair, tanque: Shield, dps: Zap, suporte: HeartHandshake }
type Modal = 'damage' | 'super' | 'shop' | 'menu' | null

function App() {
  const [name, setName] = useState(() => localStorage.getItem('qb-name') || '')
  const [classId, setClassId] = useState<ClassId>('padrao')
  const [codeInput, setCodeInput] = useState('')
  const [code, setCode] = useState('')
  const [room, setRoom] = useState<Room | null>(null)
  const [state, setState] = useState<GameState>(initialState)
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [modal, setModal] = useState<Modal>(null)
  const [superChecked, setSuperChecked] = useState(false)
  const [healChecked, setHealChecked] = useState(false)
  const [time, setTime] = useState(0)
  const [copied, setCopied] = useState(false)
  const [drawing, setDrawing] = useState<Point[]>([])
  const [gestureError, setGestureError] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointsRef = useRef<Point[]>([])
  const roomRef = useRef<Room | null>(null)

  useEffect(() => {
    const interval = window.setInterval(() => setTime(Date.now()), 500)
    return () => { window.clearInterval(interval); roomRef.current?.close() }
  }, [])
  const me = room?.id ? state.players[room.id] : undefined
  const others = Object.values(state.players).filter(p => p.id !== room?.id)
  const remaining = Math.max(0, (state.endsAt || 0) - time)
  const timer = `${Math.floor(remaining / 60000).toString().padStart(2, '0')}:${Math.floor(remaining / 1000 % 60).toString().padStart(2, '0')}`
  const living = Object.values(state.players).filter(p => p.hp > 0).length

  function enter(host: boolean) {
    if (!name.trim()) { setError('Escolha um nome para entrar na arena.'); return }
    const nextCode = host ? randomCode() : codeInput.trim().replace(/[^a-z0-9]/gi, '').toUpperCase()
    if (!host && !nextCode) { setError('Digite o código da sala.'); return }
    localStorage.setItem('qb-name', name.trim())
    setError(''); setStatus('connecting'); setCode(nextCode)
    const instance = new Room(nextCode, host, name.trim(), classId, setState, setStatus, setError)
    roomRef.current = instance; setRoom(instance)
  }
  function leave() {
    roomRef.current?.close(); roomRef.current = null; setRoom(null); setState(initialState()); setStatus('idle'); setModal(null)
  }
  function chooseClass(id: ClassId) {
    setClassId(id)
    if (room && me && state.phase !== 'playing') room.dispatch({ type: 'class', classId: id })
  }
  function fire(superAttack = false) {
    room?.dispatch({ type: 'attack', super: superAttack, heal: healChecked })
    setSuperChecked(false); setModal(null)
  }
  function drawPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect()
    const point = { x: event.clientX - rect.left, y: event.clientY - rect.top }
    pointsRef.current = [...pointsRef.current, point]
    setDrawing(pointsRef.current)
  }
  function finishDrawing() {
    if (!me || pointsRef.current.length === 0) return
    if (matchesGesture(pointsRef.current, me.classId)) { setGestureError(''); fire(true) }
    else { setGestureError('Quase! Tente desenhar a forma outra vez.'); pointsRef.current = []; setDrawing([]) }
  }
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || modal !== 'super') return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const width = canvas.clientWidth, height = canvas.clientHeight
    canvas.width = width * devicePixelRatio; canvas.height = height * devicePixelRatio
    ctx.scale(devicePixelRatio, devicePixelRatio)
    ctx.clearRect(0, 0, width, height)
    if (drawing.length < 2) return
    ctx.strokeStyle = '#ff6635'; ctx.lineWidth = 10; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.beginPath(); ctx.moveTo(drawing[0].x, drawing[0].y)
    drawing.slice(1).forEach(p => ctx.lineTo(p.x, p.y)); ctx.stroke()
  }, [drawing, modal])

  const classCards = (selected: ClassId, choose: (id: ClassId) => void) => (
    <div className="class-grid">{(Object.keys(CLASSES) as ClassId[]).map(id => {
      const c = CLASSES[id], Icon = icons[id]
      return <button type="button" key={id} className={`class-card ${c.color} ${selected === id ? 'selected' : ''}`} onClick={() => choose(id)}>
        <span className="class-icon"><Icon size={25} strokeWidth={2.3} /></span><span className="class-title">{c.label}</span>
        <span className="class-stats"><Heart size={13} /> {c.hp} <Swords size={13} /> {c.damage}</span>
        {selected === id && <span className="selected-mark"><Check size={14} strokeWidth={3} /></span>}
      </button>
    })}</div>
  )

  return <div className="app-shell">
    <header className="topbar">
      <div className="topbar-inner"><a className="brand" href="#" onClick={e => e.preventDefault()}><span className="brand-ball">✹</span> QUEIMADA<span>BOL</span><span className="brand-period">.</span></a>
        <div className="top-actions">{room && <><span className="room-pill">{code}</span><button className="icon-btn" title={copied ? 'Copiado' : 'Copiar código'} onClick={async () => { await navigator.clipboard.writeText(code); setCopied(true); window.setTimeout(() => setCopied(false), 1800) }}>{copied ? <Check size={18} /> : <Copy size={18} />}</button><button className="icon-btn" title="Menu" onClick={() => setModal('menu')}><Menu size={20} /></button></>}</div>
      </div>
    </header>
    {!room ? <main className="landing"><div className="landing-card"><label className="field-label" htmlFor="player-name">NOME</label><input id="player-name" className="text-input" placeholder="Nome" maxLength={RULES.maxNameLength} value={name} onChange={e => setName(e.target.value)} />
      <div className="select-heading"><span>CLASSE</span></div>{classCards(classId, setClassId)}
      <button className="primary-btn create-btn" onClick={() => enter(true)}><Plus size={20} strokeWidth={3} /> CRIAR UMA SALA <ArrowRight size={20} /></button>
      <div className="join-row"><input className="text-input code-input" aria-label="Código da sala" placeholder="CÓDIGO" maxLength={12} value={codeInput} onChange={e => setCodeInput(e.target.value.toUpperCase())} onKeyDown={e => { if (e.key === 'Enter') enter(false) }} /><button className="join-btn" onClick={() => enter(false)}>ENTRAR <ChevronRight size={18} /></button></div>
      {error && <p className="error-message">{error}</p>}
    </div></main> : <main className="game-layout">
      <div className="game-main"><div className="game-heading"><span className={`phase-chip ${state.phase}`}>{state.phase === 'playing' ? `ROUND ${state.round - 1}` : state.phase === 'shop' ? 'UPGRADES' : `ROUND ${state.round}`}</span></div>
        <div className="match-strip"><div><span className="strip-label">ROUND</span><strong>{state.phase === 'playing' ? state.round - 1 : state.round}</strong></div><div><span className="strip-label">{state.phase === 'playing' ? 'TEMPO RESTANTE' : 'PRÓXIMO ROUND'}</span><strong className="timer"><Clock3 size={20} /> {state.phase === 'playing' ? timer : '15:00'}</strong></div><div><span className="strip-label">NA ARENA</span><strong><Users size={20} /> {state.phase === 'playing' ? living : Object.keys(state.players).length}</strong></div></div>
        {me && <section className="player-panel"><div className="player-top"><div className={`avatar ${CLASSES[me.classId].color}`}>{(() => { const Icon = icons[me.classId]; return <Icon size={30} /> })()}</div><div className="player-identity"><h2>{me.name}</h2><span>{CLASSES[me.classId].label}</span></div><span className="xp-tag"><Sparkles size={15} /> {me.xp} XP</span></div>
          <div className="health-head"><span><Heart size={17} fill="currentColor" /> VIDA</span><strong>{Math.ceil(me.hp)} <small>/ {me.maxHp} PV</small></strong></div><div className="health-track"><div className="health-fill" style={{ width: `${me.hp / me.maxHp * 100}%` }} /></div>
          <div className="stat-row"><span><Swords size={17} /> DANO <strong>{me.damage}</strong></span><span><Shield size={17} /> DEFESA <strong>{me.defenseLevel * 10}%</strong></span>{me.classId === 'dps' ? <span><Zap size={17} /> SUPER <strong>{me.superUses} / {me.maxSuperUses}</strong></span> : <span className="coming-soon"><Zap size={17} /> SUPER EM BREVE</span>}{me.poison && <span className="status-poison"><Droplets size={17} /> ENVENENADO</span>}{me.teammateId && state.players[me.teammateId] && <span className="status-team"><Users size={17} /> EQUIPE: {state.players[me.teammateId].name}</span>}{me.dead && <span className="status-dead"><Skull size={17} /> ELIMINADO</span>}</div>
        </section>}
        {state.phase === 'playing' && me ? <section className="action-section">
          <div className="action-grid"><div className="attack-card">
            <div className="attack-options">{me.classId === 'dps' ? <label className="check-option"><input type="checkbox" checked={superChecked} onChange={e => setSuperChecked(e.target.checked)} disabled={me.superUses <= 0 || me.hp <= 0} /><span className="custom-check"><Check size={14} /></span><span>SUPER <small>({me.superUses}) · VENENO</small></span></label> : <span className="coming-soon"><Zap size={15} /> SUPER EM BREVE</span>}
            {me.classId === 'suporte' && <label className="check-option"><input type="checkbox" checked={healChecked} onChange={e => setHealChecked(e.target.checked)} /><span className="custom-check"><Check size={14} /></span><span>Curar em vez de atacar</span></label>}</div>
            <button className="primary-btn attack-btn" disabled={!me.hp} onClick={() => { if (superChecked) { pointsRef.current = []; setDrawing([]); setGestureError(''); setModal('super') } else fire() }}>{healChecked && me.classId === 'suporte' ? <Heart size={20} /> : <Swords size={20} />} {healChecked && me.classId === 'suporte' ? 'CURAR' : 'ATACAR'} <ArrowRight size={19} /></button>
            {me.shot && <span className="prepared-note"><CheckCircle2 size={15} /> {me.shot.super ? me.superName : 'Ataque'} · {me.classId === 'suporte' ? `${Math.ceil(me.shot.heal)} cura` : `${Math.ceil(me.shot.damage)} dano`}</span>}</div>
            <div className="damage-card"><button className="damage-btn" disabled={!me.hp} onClick={() => setModal('damage')}><Heart size={19} /> TAKE DAMAGE <ArrowRight size={19} /></button></div></div>
        </section> : <section className="waiting-panel"><div className="waiting-actions">{state.phase === 'shop' && <button className="outline-btn" onClick={() => setModal('shop')}>UPGRADES <ChevronRight size={17} /></button>}<button className="primary-btn" disabled={!me || Object.keys(state.players).length < 2} onClick={() => room.dispatch({ type: 'ready' })}>{me?.ready ? <><Check size={19} /> PRONTO</> : <>PRONTO <ArrowRight size={19} /></>}</button></div></section>}
        <section className="roster-section"><div className="panel-title-row"><span className="section-label">JOGADORES</span><span className="helper-text">{Object.keys(state.players).length}</span></div><div className="roster-list">{Object.values(state.players).map(player => { const Icon = icons[player.classId]; return <div className={`roster-player ${player.dead ? 'knocked-out' : ''}`} key={player.id}><div className={`mini-avatar ${CLASSES[player.classId].color}`}>{player.dead ? <Skull size={19} /> : <Icon size={19} />}</div><div className="roster-name"><strong>{player.name}{player.id === room.id && <span className="self-label"> · VOCÊ</span>}{player.teammateId && <span className="team-label"> · EQUIPE</span>}</strong><span>{CLASSES[player.classId].label} · {player.xp} XP{player.poison ? ' · ☠ Envenenado' : ''}</span></div>{state.phase === 'playing' ? <div className="roster-hp"><span>{Math.ceil(player.hp)} / {player.maxHp}</span><div className="mini-track"><div style={{ width: `${player.hp / player.maxHp * 100}%` }} /></div></div> : <span className={`ready-indicator ${player.ready ? 'is-ready' : ''}`}>{player.ready ? '✓' : '…'}</span>}</div> })}</div></section>
      </div></main>}
    {error && room && <div className="toast-error" role="alert">{error} <button onClick={() => setError('')} aria-label="Fechar aviso"><X size={16} /></button>{status === 'disconnected' && <button onClick={leave}>SAIR</button>}</div>}
    {modal && <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) setModal(null) }}><div className="modal" role="dialog" aria-modal="true" aria-label={modal}><button className="modal-close" onClick={() => setModal(null)} aria-label="Fechar"><X size={21} /></button>
      {modal === 'damage' && <><h2>{me?.classId === 'suporte' && healChecked ? 'Escolha quem curar' : 'Take damage'}</h2><div className="modal-player-list">{others.filter(p => p.hp > 0 && p.shot && (me?.received[p.id] ?? 0) < p.shot.id && (p.shot.heal > 0 || !(me?.teammateId === p.id || p.teammateId === me?.id))).map(p => { const Icon = icons[p.classId]; return <button key={p.id} onClick={() => { room?.dispatch({ type: 'receive', attackerId: p.id }); setModal(null) }}><span className={`mini-avatar ${CLASSES[p.classId].color}`}><Icon size={21} /></span><span><strong>{p.name}</strong><small>{p.shot!.heal > 0 ? `${Math.ceil(p.shot!.heal)} cura` : `${Math.ceil(p.shot!.damage)} dano`}{p.shot?.poison ? ' · ☠ VENENO' : ''}{p.shot?.super ? ' · SUPER' : ''}</small></span><ChevronRight size={19} /></button> })}{!others.some(p => p.hp > 0 && p.shot && (me?.received[p.id] ?? 0) < p.shot.id && (p.shot.heal > 0 || !(me?.teammateId === p.id || p.teammateId === me?.id))) && <div className="no-attacks">Nenhum ataque ou cura disponível</div>}</div></>}
      {modal === 'super' && me && <><h2 className="super-title">{me.superName}</h2><div className="drawing-area"><span className="drawing-guide">{CLASSES[me.classId].glyph}</span><canvas ref={canvasRef} onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); pointsRef.current = []; setDrawing([]); setGestureError(''); drawPoint(e) }} onPointerMove={e => { if (e.buttons) drawPoint(e) }} onPointerUp={finishDrawing} /></div>{gestureError && <p className="gesture-error">Tente novamente.</p>}<div className="gesture-bottom"><span>{CLASSES[me.classId].glyph}</span><button onClick={() => { pointsRef.current = []; setDrawing([]); setGestureError('') }}>LIMPAR <X size={14} /></button></div></>}
      {modal === 'shop' && <><h2>UPGRADES · {me?.xp || 0} XP</h2><div className="upgrade-grid">{me && (['attack', 'defense'] as const).map(type => { const attack = type === 'attack', level = attack ? me.attackLevel : me.defenseLevel, cost = RULES.upgradeBaseCost + level * RULES.upgradeCostStep, Icon = attack ? Swords : Shield; return <button type="button" className="upgrade-slot" key={type} disabled={me.xp < cost || level >= RULES.upgradeMaxLevel} onClick={() => room?.dispatch({ type: 'upgrade', upgrade: type })}><span className="slot-icon"><Icon size={22} /></span><strong>{attack ? 'ATAQUE' : 'DEFESA'}</strong><span>Nível {level}/{RULES.upgradeMaxLevel}</span><span>{level >= RULES.upgradeMaxLevel ? 'MÁXIMO' : `+${attack ? RULES.attackUpgrade : RULES.defensePerLevel * 100}% · ${cost} XP`}</span><span className="slot-plus"><Plus size={19} /></span></button> })}<div className="upgrade-slot unavailable"><span className="slot-icon"><Sparkles size={22} /></span><strong>HABILIDADES</strong><span>EM BREVE</span></div><div className="upgrade-slot unavailable"><span className="slot-icon"><Zap size={22} /></span><strong>SUPER</strong><span>EM BREVE</span></div></div></>}
      {modal === 'menu' && <><h2>SALA {code}</h2>{state.phase !== 'playing' && <>{classCards(me?.classId || classId, chooseClass)}</>}<button className="menu-item leave-item" onClick={leave}><ArrowLeft size={20} /> SAIR</button></>}
    </div></div>}
  </div>
}
export default App