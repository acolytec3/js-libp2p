'use strict'

const debug = require('debug')
const log = debug('libp2p:auto-relay')
log.error = debug('libp2p:auto-relay:error')

const MulticodecTopology = require('libp2p-interfaces/src/topology/multicodec-topology')

const { relay: multicodec } = require('./multicodec')
const { canHop } = require('./circuit/hop')

class AutoRelay {
  /**
   * Creates an instance of AutoRelay
   * @constructor
   * @param {object} params
   * @param {Libp2p} params.libp2p
   * @param {Circuit} params.circuit
   * @param {number} params.maxListeners maximum number of relays to listen.
   */
  constructor ({ libp2p, circuit, maxListeners }) {
    this._libp2p = libp2p
    this._registrar = libp2p.registrar
    this._peerStore = libp2p.peerStore
    this._connectionManager = libp2p.connectionManager
    this._transportManager = libp2p.transportManager

    this._circuit = circuit // TODO: for listen, maybe transportManager

    this.maxListeners = maxListeners

    /**
     * @type {Set<string>}
     */
    this._listenRelays = new Set()

    this._onPeerConnected = this._onPeerConnected.bind(this)
    this._onPeerDisconnected = this._onPeerDisconnected.bind(this)

    // register protocol with topology
    const topology = new MulticodecTopology({
      multicodecs: multicodec,
      handlers: {
        onConnect: this._onPeerConnected,
        onDisconnect: this._onPeerDisconnected
      }
    })
    this._registrar.register(topology)
  }

  /**
   * Registrar notifies a connection successfully with circuit protocol.
   * @private
   * @param {PeerId} peerId remote peer-id
   * @param {Connection} connection connection to the peer
   */
  async _onPeerConnected (peerId, connection) {
    // Check if already listening on enough relays
    if (this._listenRelays.size >= this.maxListeners) {
      return
    }

    const idB58Str = peerId.toB58String()
    log('connected', idB58Str)

    // Check if already listening on the relay
    if (this._listenRelays.has(idB58Str)) {
      return
    }

    try {
      await canHop({ connection })
      // const nodeCanHop = await canHop({ connection })
      // console.log('canHop', nodeCanHop)

      // TODO: Listen on
      this._listenRelays.add(idB58Str)
    } catch (err) {
      log.error(err)
      // console.log('connected err', err)
    }

    // console.log('connected')
  }

  /**
   * Registrar notifies a closing connection with circuit protocol.
   * @private
   * @param {PeerId} peerId peerId
   * @param {Error} err error for connection end
   */
  _onPeerDisconnected (peerId, err) {
    const idB58Str = peerId.toB58String()

    // Not listening on this relay
    if (!this._listenRelays.has(idB58Str)) {
      return
    }

    this._listenRelays.delete(idB58Str)
    // TODO: not listen on multiaddr

    log('connection ended', idB58Str, err ? err.message : '')

    // TODO: Listen on alternative relays if available
  }
}

module.exports = AutoRelay
