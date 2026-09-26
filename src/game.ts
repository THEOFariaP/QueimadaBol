export type ClassId = 'padrao' | 'tanque' | 'dps' | 'suporte'
export type Phase = 'lobby' | 'playing' | 'shop'

export const RULES = {
  roundMs: 15 * 60 * 1000,
  killXp: 30,
  xpBountyFactor: 0.15,
  poisonTickMs: 3000,
  poisonDurationMs: 7000,
  poisonDamage: 3,
  superUsesPerRound: 1,
  superDamageMultiplier: 1.8,
  superHealMultiplier: 1.8,
  upgradeMaxLevel: 5,
  attackUpgrade: 5,
  upgradeBaseCost: 25,
  upgradeCostStep: 15,
  defensePerLevel: 0.1,
  maxNameLength: 18,
  maxPlayers: 24,
} as const

export const CLASSES: Record<ClassId, { label: string; hp: number; damage: number; heal: number; color: string; superName: string; glyph: string }> = {
  padrao: { label: 'Padrão', hp: 100, damage: 20, heal: 0, color: 'orange', superName: 'Bola de Fogo', glyph: '◯' },
  tanque: { label: 'Tanque', hp: 150, damage: 12, heal: 0, color: 'blue', superName: 'Soco Forte', glyph: '▽' },
  dps: { label: 'DPS', hp: 75, damage: 30, heal: 0, color: 'pink', superName: 'Corte Relâmpago', glyph: '╱' },
  suporte: { label: 'Suporte', hp: 80, damage: 10, heal: 22, color: 'green', superName: 'Coração de Ouro', glyph: '♡' },
}

export interface Shot {
  id: number
  damage: number
  heal: number
  poison: boolean
  super: boolean
}
export interface Poison { source: string; until: number; nextTick: number; tickMs: number; damage: number }
export interface Player {
  id: string
  name: string
  classId: ClassId
  hp: number
  maxHp: number
  damage: number
  heal: number
  xp: number
  ready: boolean
  superUses: number
  maxSuperUses: number
  superName: string
  superDamageMultiplier: number
  superHealMultiplier: number
  poisonDamage: number
  poisonDurationMs: number
  poisonTickMs: number
  attackLevel: number
  defenseLevel: number
  shot: Shot | null
  shotSeq: number
  received: Record<string, number>
  poison: Poison | null
  teammateId: string | null
  dead: boolean
  lastHitBy: string | null
}
export interface GameState {
  phase: Phase
  round: number
  endsAt: number | null
  players: Record<string, Player>
  feed: { id: number; text: string; at: number }[]
}
export type Action =
  | { type: 'join'; name: string; classId: ClassId }
  | { type: 'class'; classId: ClassId }
  | { type: 'ready' }
  | { type: 'attack'; super: boolean; heal: boolean }
  | { type: 'receive'; attackerId: string }
  | { type: 'upgrade'; upgrade: 'attack' | 'defense' }

export const initialState = (): GameState => ({ phase: 'lobby', round: 1, endsAt: null, players: {}, feed: [] })
const addFeed = (s: GameState, text: string) => {
  s.feed.unshift({ id: Date.now() + Math.random(), text, at: Date.now() })
  s.feed = s.feed.slice(0, 18)
}
const classKeys = Object.keys(CLASSES) as ClassId[]

function kill(s: GameState, victim: Player, killerId: string | null) {
  if (victim.hp > 0) return
  victim.hp = 0
  victim.dead = true
  victim.poison = null
  clearTeammate(s, victim)
  const killer = killerId ? s.players[killerId] : undefined
  if (killer && killer.id !== victim.id) {
    const bounty = RULES.killXp + Math.floor(victim.xp * RULES.xpBountyFactor)
    killer.xp += bounty
    addFeed(s, `${killer.name} eliminou ${victim.name} · +${bounty} XP`)
    const teammate = killer.teammateId ? s.players[killer.teammateId] : undefined
    if (teammate && teammate.hp > 0) {
      teammate.xp += bounty
      addFeed(s, `${teammate.name} recebeu +${bounty} XP de equipe`)
    }
  } else addFeed(s, `${victim.name} foi eliminado(a)`)
}

function clearTeammate(s: GameState, player: Player) {
  const teammate = player.teammateId ? s.players[player.teammateId] : undefined
  if (teammate?.teammateId === player.id) teammate.teammateId = null
  player.teammateId = null
}

export function advance(s: GameState, now = Date.now()): boolean {
  let changed = false
  if (s.phase === 'playing' && s.endsAt && now >= s.endsAt) {
    s.phase = 'shop'; s.endsAt = null
    Object.values(s.players).forEach(p => { p.ready = false; p.poison = null; p.shot = null; p.dead = p.hp <= 0 })
    addFeed(s, `Fim do round ${s.round}! Hora dos upgrades.`)
    changed = true
  }
  if (s.phase !== 'playing') return changed
  for (const p of Object.values(s.players)) {
    if (!p.poison) continue
    const poison = p.poison
    while (p.hp > 0 && poison.nextTick <= now && poison.nextTick <= poison.until) {
      p.hp = Math.max(0, p.hp - poison.damage)
      poison.nextTick += poison.tickMs
      changed = true
      if (p.hp === 0) kill(s, p, poison.source)
    }
    if (p.poison && now >= poison.until) { p.poison = null; changed = true }
  }
  return changed
}

export function applyAction(s: GameState, actorId: string, action: Action): string | null {
  if (action.type === 'join') {
    if (s.players[actorId]) return null
    if (Object.keys(s.players).length >= RULES.maxPlayers) return 'Sala cheia.'
    if (!classKeys.includes(action.classId) || !action.name.trim()) return 'Nome ou classe inválidos.'
    const c = CLASSES[action.classId]
    s.players[actorId] = { id: actorId, name: action.name.trim().slice(0, RULES.maxNameLength), classId: action.classId,
      hp: s.phase === 'playing' ? 0 : c.hp, maxHp: c.hp, damage: c.damage, heal: c.heal,
      xp: 0, ready: false, superUses: RULES.superUsesPerRound, maxSuperUses: RULES.superUsesPerRound,
      superName: c.superName, superDamageMultiplier: RULES.superDamageMultiplier,
      superHealMultiplier: RULES.superHealMultiplier, poisonDamage: RULES.poisonDamage,
      poisonDurationMs: RULES.poisonDurationMs, poisonTickMs: RULES.poisonTickMs,
      attackLevel: 0, defenseLevel: 0,
      shot: null, shotSeq: 0,
      received: {}, poison: null, teammateId: null, dead: s.phase === 'playing', lastHitBy: null }
    addFeed(s, `${s.players[actorId].name} entrou na arena`)
    return null
  }
  const p = s.players[actorId]
  if (!p) return 'Jogador não encontrado.'
  if (action.type === 'class') {
    if (s.phase === 'playing' || !classKeys.includes(action.classId)) return 'Classe indisponível durante o round.'
    const c = CLASSES[action.classId]
    p.classId = action.classId; p.maxHp = c.hp; p.hp = c.hp; p.damage = c.damage + p.attackLevel * RULES.attackUpgrade; p.heal = c.heal; p.superName = c.superName
    p.ready = false; p.shot = null
    return null
  }
  if (action.type === 'ready') {
    if (s.phase === 'playing') return 'Round em andamento.'
    p.ready = !p.ready
    const players = Object.values(s.players)
    if (players.length >= 2 && players.every(player => player.ready)) {
      s.phase = 'playing'; s.endsAt = Date.now() + RULES.roundMs
      for (const player of players) {
        player.hp = player.maxHp; player.poison = null; clearTeammate(s, player); player.dead = false; player.lastHitBy = null
        player.shot = null; player.received = {}; player.superUses = player.maxSuperUses; player.ready = false
      }
      addFeed(s, `Round ${s.round} começou! Boa queimada!`)
      s.round++
    }
    return null
  }
  if (action.type === 'upgrade') {
    if (s.phase !== 'shop') return 'Upgrades só podem ser comprados entre rounds.'
    const level = action.upgrade === 'attack' ? p.attackLevel : p.defenseLevel
    if (level >= RULES.upgradeMaxLevel) return 'Esse upgrade já está no nível máximo.'
    const cost = RULES.upgradeBaseCost + level * RULES.upgradeCostStep
    if (p.xp < cost) return `Você precisa de ${cost} XP para esse upgrade.`
    p.xp -= cost
    if (action.upgrade === 'attack') {
      p.attackLevel++
      p.damage = CLASSES[p.classId].damage + p.attackLevel * RULES.attackUpgrade
    } else p.defenseLevel++
    addFeed(s, `${p.name} melhorou ${action.upgrade === 'attack' ? 'o ataque' : 'a defesa'} para o nível ${level + 1}`)
    return null
  }
  if (s.phase !== 'playing' || !p.hp) return 'Você está fora do round.'
  if (action.type === 'attack') {
    if (action.super && p.superUses <= 0) return 'Sem super ataques restantes.'
    if (action.super && p.classId === 'suporte') return 'O healer não possui super.'
    if (action.heal && p.classId !== 'suporte') return 'Somente o healer pode curar.'
    if (action.super) p.superUses--
    p.shotSeq++
    const isHealing = p.classId === 'suporte' && action.heal
    p.shot = { id: p.shotSeq, damage: isHealing ? 0 : Math.max(0, p.damage * (action.super ? p.superDamageMultiplier : 1)),
      heal: isHealing ? Math.max(0, p.heal) : 0,
      poison: p.classId === 'dps' && action.super, super: action.super }
    addFeed(s, `${p.name} preparou ${action.super ? p.superName : isHealing ? 'uma cura' : 'um ataque'}!`)
    return null
  }
  if (action.type === 'receive') {
    const attacker = s.players[action.attackerId]
    if (!attacker || attacker.id === p.id || !attacker.hp || !attacker.shot) return 'Ataque indisponível. Peça para atacar primeiro.'
    if (attacker.teammateId === p.id || p.teammateId === attacker.id) {
      if (attacker.shot.heal <= 0) {
        return 'Jogadores da mesma equipe não podem se atacar.'
      }
    }
    const shot = attacker.shot
    if ((p.received[attacker.id] ?? 0) >= shot.id) return 'Esse ataque já foi registrado. Peça um novo ataque.'
    p.received[attacker.id] = shot.id
    if (shot.heal > 0) {
      if (attacker.teammateId && attacker.teammateId !== p.id) return 'Você só pode ter uma pessoa na sua equipe.'
      if (p.teammateId && p.teammateId !== attacker.id) return 'Esse jogador já está em outra equipe.'
      const healed = Math.min(p.maxHp - p.hp, shot.heal)
      p.hp += healed
      if (healed > 0) {
        attacker.teammateId = p.id
        p.teammateId = attacker.id
      }
      addFeed(s, `${attacker.name} curou ${p.name} em ${Math.ceil(healed)} PV${healed > 0 ? ' · equipe!' : ''}`)
    } else {
      const mitigation = Math.min(0.5, p.defenseLevel * RULES.defensePerLevel)
      const damage = Math.min(p.hp, shot.damage * (1 - mitigation))
      p.hp = Math.max(0, p.hp - damage)
      p.lastHitBy = attacker.id
      if (shot.poison && p.hp > 0) p.poison = { source: attacker.id, damage: attacker.poisonDamage, tickMs: attacker.poisonTickMs,
        until: Date.now() + attacker.poisonDurationMs, nextTick: Date.now() + attacker.poisonTickMs }
      addFeed(s, `${p.name} recebeu ${Math.ceil(damage)} de ${attacker.name}${shot.poison ? ' · veneno visual!' : ''}`)
      if (p.hp === 0) kill(s, p, attacker.id)
    }
    return null
  }
  return 'Ação inválida.'
}

export function disconnectPlayer(s: GameState, id: string) {
  if (!s.players[id]) return
  const name = s.players[id].name
  clearTeammate(s, s.players[id])
  delete s.players[id]
  for (const p of Object.values(s.players)) {
    if (p.poison?.source === id) p.poison = null
  }
  addFeed(s, `${name} saiu da sala`)
}