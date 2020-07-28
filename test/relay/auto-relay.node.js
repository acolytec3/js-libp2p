'use strict'
/* eslint-env mocha */

const chai = require('chai')
chai.use(require('dirty-chai'))
const { expect } = chai

const delay = require('delay')

const Libp2p = require('../../src')
const { relay: relayMulticodec } = require('../../src/circuit/multicodec')

const { createPeerId } = require('../utils/creators/peer')
const baseOptions = require('../utils/base-options')

const listenAddr = '/ip4/0.0.0.0/tcp/0'

describe('auto-relay', () => {
  let libp2p
  let relayLibp2p1
  let relayLibp2p2

  beforeEach(async () => {
    const peerIds = await createPeerId({ number: 3 })
    // Create 3 nodes, and turn HOP on for the relay
    ;[libp2p, relayLibp2p1, relayLibp2p2] = peerIds.map((peerId, index) => {
      const opts = baseOptions

      if (index !== 0) {
        opts.config.relay = {
          ...opts.config.relay,
          hop: {
            enabled: true
          },
          autoRelay: {
            enabled: true
          }
        }
      }

      return new Libp2p({
        ...opts,
        addresses: {
          listen: [listenAddr]
        },
        peerId
      })
    })
  })

  beforeEach(() => {
    // Start each node
    return Promise.all([libp2p, relayLibp2p1, relayLibp2p2].map(libp2p => libp2p.start()))
  })

  afterEach(() => {
    // Stop each node
    return Promise.all([libp2p, relayLibp2p1, relayLibp2p2].map(libp2p => libp2p.stop()))
  })

  it('should ask if node supports hop on connect (relay protocol)', async () => {
    // console.log('transp', relayLibp2p1.transportManager._transports.get('Circuit'))
    // Discover relay
    relayLibp2p1.peerStore.addressBook.add(relayLibp2p2.peerId, relayLibp2p2.multiaddrs)
    await relayLibp2p1.dial(relayLibp2p2.peerId)

    // TODO: Wait for upgrade
    await delay(1000)

    const knownProtocols = relayLibp2p1.peerStore.protoBook.get(relayLibp2p2.peerId)
    expect(knownProtocols).to.include(relayMulticodec)
  })

  // TODO: disconn
})
