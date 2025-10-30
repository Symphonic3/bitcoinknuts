import { Message, DeMessage, PROTOCOL_MESSAGE_TYPE } from './messages.js';
import net from 'node:net';
import crypto from "node:crypto";
import { resolve4 } from 'dns/promises';

const peers = new Set();

export async function initPeersAsync(count) {
    for (let i = 0; i < count; i++) {
        peers.add(await newPeerAsync());
    }
}

async function notifyPeerDeathAsync(peer) {
    peers.delete(peer);
    peers.add(await newPeerAsync());
}

async function newPeerAsync() {
    const addresses = await resolve4("seed.btc.petertodd.org");
    const host = addresses[0]; //TODO replace this with a peerdb
    return connectIPv4(host, 8333);
}

function connectIPv4(host, port) {
    const client = new net.Socket();
    const peerState = new PeerState(client);

    client.on('error', err => {
        console.log(err);
    }); //don't crash don't care

    client.on('close', async () => {
        console.log("disconnecting...");
        await notifyPeerDeathAsync(peerState);
    });

    client.on('ready', async () => {
        openAsync(peerState);
    });

    //i love closures, why even use a class when you're a functional programming genius?
    let buffer = Buffer.alloc(0);
    client.on('data', async (chunk) => {
        //the buffer will automatically throw a rangeerror 
        //and kill the peer if they spam data (>~1GB)
        buffer = Buffer.concat([buffer, chunk]);

        while (buffer.length >= 24) { //message header length
            const { buffer: newBuffer, command, obj } = DeMessage(buffer);
            buffer = newBuffer;

            if (command !== undefined) {
                console.log(command + ":");
                console.log(obj);

                await handleAsync(peerState, command, obj);
            }
        }
    });

    client.connect(port, host);

    return peerState;
}

const TIMEOUTS = Object.freeze({
    version: { name: "version", length: 5000 },
    verack: { name: "verack", length: 5000 },
    pong: { name: "pong", length: 10000 }
});

function timeoutFor(client, timeout) {
    return setTimeout(async () => {
        console.log("timing out...");
        client.destroySoon();
    }, timeout.length);
}

async function openAsync(peerState) {
    peerState.verTimeout = timeoutFor(peerState.client, TIMEOUTS.version);
    peerState.verackTimeout = timeoutFor(peerState.client, TIMEOUTS.verack);

    const versionMessage = {
        version: 70012, //we don't like things that are complex
        services: BigInt(0),
        timestamp: BigInt(Math.floor(Date.now()/1000)),
        addr_recv: { services: BigInt(0), addr: '0.0.0.0', port: 0 },
        addr_from: { services: BigInt(0), addr: '0.0.0.0', port: 0 },
        nonce: crypto.randomBytes(8).readBigUInt64LE(),
        user_agent: '/Satoshi:28.1.0/',
        start_height: 0,
        relay: false //i don't want txns
    };

    peerState.client.write(Message(PROTOCOL_MESSAGE_TYPE.version, versionMessage));
}

async function handleAsync(peerState, command, obj) {
    switch (command) {
        case PROTOCOL_MESSAGE_TYPE.version:
            if (peerState.ver || peerState.verTimeout === undefined)
                throw new Error("already recd version");
            peerState.ver = true;
            clearTimeout(peerState.verTimeout);
            peerState.client.write(Message(PROTOCOL_MESSAGE_TYPE.verack));
            break;
        case PROTOCOL_MESSAGE_TYPE.verack:
            if (peerState.verack || peerState.verackTimeout === undefined)
                throw new Error("already recd verack");
            peerState.verack = true;
            clearTimeout(peerState.verackTimeout);
            break;
        default:
            if (!peerState.ver || !peerState.verack)
                throw new Error("recd unrelated init command")
            break;
    }

    handleStandard(peerState, command, obj);
}

function handleStandard(peerState, command, obj) {
    return; //TODO handle other commands
}

//messy state object to isolate side effects of mutability
class PeerState {
    constructor(client) {
        this.client = client;
    }
}