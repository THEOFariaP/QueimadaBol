import Peer, { type DataConnection } from 'peerjs'
import { advance, applyAction, disconnectPlayer, initialState, type Action, type ClassId, type GameState } from './game'

type WireMessage = { type: 'action'; action: Action } | { type: 'state'; state: GameState } | { type: 'error'; text: string }
export const roomId = (code: string) => `queimadabol-${code.toLowerCase().replace(/[^a-z0-9]/g, '')}`
export const randomCode = () => Math.random().toString(36).slice(2, 8).toUpperCase()

export class Room {
  peer: Peer
  connection: DataConnection | null = null
  connections = new Map<string, DataConnection>()
  state = initialState()
  id = ''
  isHost: boolean
  timer: number | undefined
  onState: (state: GameState) => void
  onStatus: (status: string) => void
  onError: (error: string) => void

  constructor(code: string, host: boolean, name: string, classId: ClassId,
    onState: (state: GameState) => void, onStatus: (status: string) => void, onError: (error: string) => void) {
    this.isHost = host
    this.onState = onState; this.onStatus = onStatus; this.onError = onError
    this.peer = host ? new Peer(roomId(code)) : new Peer()
    this.peer.on('open', id => {
      this.id = id
      if (host) {
        this.dispatch({ type: 'join', name, classId })
        this.onStatus('connected')
        this.timer = window.setInterval(() => {
          if (advance(this.state)) this.broadcast()
        }, 500)
      } else {
        this.onStatus('connecting')
        const connection = this.peer.connect(roomId(code), { reliable: true })
        this.connection = connection
        connection.on('open', () => connection.send({ type: 'action', action: { type: 'join', name, classId } } satisfies WireMessage))
        connection.on('data', raw => this.receive(raw))
        connection.on('close', () => this.onStatus('disconnected'))
        connection.on('error', () => this.onStatus('disconnected'))
      }
    })
    this.peer.on('connection', connection => {
      if (!host) { connection.close(); return }
      this.connections.set(connection.peer, connection)
      connection.on('open', () => connection.send({ type: 'state', state: this.state } satisfies WireMessage))
      connection.on('data', raw => {
        const message = raw as WireMessage
        if (message?.type !== 'action') return
        const error = applyAction(this.state, connection.peer, message.action)
        if (error) connection.send({ type: 'error', text: error } satisfies WireMessage)
        else this.broadcast()
      })
      connection.on('close', () => {
        this.connections.delete(connection.peer)
        disconnectPlayer(this.state, connection.peer)
        this.broadcast()
      })
    })
    this.peer.on('error', error => {
      const messages: Record<string, string> = {
        'unavailable-id': 'Código de sala já está em uso. Tente outro.',
        'peer-unavailable': 'Sala não encontrada. Confira o código e se o anfitrião está online.',
        'network': 'Erro de rede. Verifique a conexão e tente novamente.',
      }
      this.onError(messages[error.type] || `Falha na conexão: ${error.message}`)
      this.onStatus('disconnected')
    })
  }

  receive(raw: unknown) {
    const message = raw as WireMessage
    if (message?.type === 'state') {
      this.state = message.state
      this.onState({ ...this.state })
      if (this.state.players[this.id]) this.onStatus('connected')
    } else if (message?.type === 'error') this.onError(message.text)
  }

  dispatch(action: Action) {
    if (!this.id) return
    if (!this.isHost) {
      if (this.connection?.open) this.connection.send({ type: 'action', action } satisfies WireMessage)
      else this.onError('Conexão ainda não está pronta.')
      return
    }
    const error = applyAction(this.state, this.id, action)
    if (error) this.onError(error)
    else this.broadcast()
  }

  broadcast() {
    this.onState({ ...this.state })
    for (const connection of this.connections.values()) if (connection.open) connection.send({ type: 'state', state: this.state } satisfies WireMessage)
  }

  close() {
    window.clearInterval(this.timer)
    this.connections.forEach(connection => connection.close())
    this.connection?.close()
    this.peer.destroy()
  }
}