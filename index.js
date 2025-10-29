import { Message, DeMessage, PROTOCOL_MESSAGE_TYPE } from './messages.js';
import { resolve4 } from 'dns/promises';
import crypto from 'node:crypto';
import net from 'node:net';


let peers = [];
const PEER_COUNT = 2;

async function giveMeNodes() {
    return await resolve4("seed.btc.petertodd.org");
}

async function bitcoin() {
    await fillPeers();
}

async function fillPeers() {
    const peerLength = peers.length;

    if (peerLength < PEER_COUNT) {
        const addresses = await giveMeNodes();
        for (let i = 0; i < PEER_COUNT - peerLength; i++) {
            const addr = addresses[i];
            addPeer({ addr, port: 8333, services: 0 });
        }
    }
}

function addPeer(netaddr) {
    const client = new net.Socket();

    const versionMessage = {
        version: 70015,
        services: netaddr.services,
        timestamp: Math.floor(Date.now()/1000),
        addr_recv: { services: 0, addr: '0.0.0.0', port: 0 },
        addr_from: { services: 0, addr: '0.0.0.0', port: 0 },
        nonce: crypto.randomBytes(8).readBigUInt64LE(),
        user_agent: '/Satoshi:28.1.0/',
        start_height: 0,
        relay: false
    };

    let peer;

    client.on('close', async () => {
        if (peer)
            peers = peers.slice(peers.indexOf(peer), 1);

        await fillPeers();
    });

    let buffer = Buffer.alloc(0);
    client.on('data', (chunk) => {
        buffer = Buffer.concat([buffer, chunk]);

        while (buffer.length >= 24) { //message header length
            const { buffer: newBuffer, command, obj } = DeMessage(buffer);
            buffer = newBuffer;
            console.log(command + ":");
            console.log(obj);

            switch (command) {
                case PROTOCOL_MESSAGE_TYPE.version:
                    client.write(Message(PROTOCOL_MESSAGE_TYPE.verack));

                    if (!peer)
                        throw new Error();

                    peer.veracked = true;
                    break;
                default:
                    break;
            }
        }
    });

    client.connect(netaddr.port, netaddr.addr, () => {
        peer = new Peer(false, client);
        peers.push(peer);
        client.write(Message(PROTOCOL_MESSAGE_TYPE.version, versionMessage));
    });
}

class Peer {
    constructor(veracked, socket) {
        this.veracked = veracked;
        this.socket = socket;
    }
}

bitcoin();