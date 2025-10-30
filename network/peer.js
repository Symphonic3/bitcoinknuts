import { Message, DeMessage, PROTOCOL_MESSAGE_TYPE } from './messages.js';
import net from 'node:net';
import crypto from "node:crypto";

class BasePeer {
    constructor(client, onTerminatedAsync, commandHandler) {
        this.client = client;
        this.onTerminatedAsync = onTerminatedAsync;
        this.commandHandler = commandHandler;
        this.buffer = Buffer.alloc(0);

        client.on('close', this.onDisconnectAsync.bind(this));
        client.on('ready', this.onConnectAsync.bind(this));
        client.on('data', this.onDataAsync.bind(this));
    }

    async onConnectAsync() {
        if (this.commandHandler)
            await this.commandHandler.openAsync(this);
    }

    async onDisconnectAsync() {
        console.log("disconnecting...");
        await this.onTerminatedAsync();
    }

    async onDataAsync(chunk) {
        //the buffer will automatically throw a rangeerror 
        //and kill the peer if they spam data (>~1GB)
        this.buffer = Buffer.concat([this.buffer, chunk]);

        while (this.buffer.length >= 24) { //message header length
            const { buffer: newBuffer, command, obj } = DeMessage(this.buffer);
            this.buffer = newBuffer;

            if (command !== undefined && this.commandHandler) {
                console.log(command + ":");
                console.log(obj);
                await this.commandHandler.handleAsync(this, command, obj);
            }
        }
    }

    send(command, obj) {
        this.client.write(Message(command, obj));
    }

    timeoutFor(timeout) {
        return setTimeout(async () => {
            console.log("timing out...");
            this.client.destroySoon();
        }, timeout.length);
    }
}

export const TIMEOUTS = Object.freeze({
    version: { name: "version", length: 5000 },
    verack: { name: "verack", length: 5000 },
    pong: { name: "pong", length: 10000 }
});

export function connectIPv4(host, port, onTerminatedAsync) {
    const client = new net.Socket();
    const commandHandler = new CommandHandler();
    const basePeer = new BasePeer(client, onTerminatedAsync, commandHandler);

    client.on('error', err => {
        console.log(err);
    }); //don't crash don't care

    client.connect(port, host);

    return basePeer;
}

class CommandHandler {
    constructor() {
        this.ver = false;
        this.verack = false;
    }

    async openAsync(basePeer) {
        this.verTimeout = basePeer.timeoutFor(TIMEOUTS.version);
        this.verackTimeout = basePeer.timeoutFor(TIMEOUTS.verack);

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

        basePeer.send(PROTOCOL_MESSAGE_TYPE.version, versionMessage);
    }

    async handleAsync(basePeer, command, obj) {
        switch (command) {
            case PROTOCOL_MESSAGE_TYPE.version:
                if (this.ver)
                    throw new Error("already recd version");
                this.ver = true;
                clearTimeout(this.verTimeout);
                basePeer.send(PROTOCOL_MESSAGE_TYPE.verack);
                break;
            case PROTOCOL_MESSAGE_TYPE.verack:
                if (this.verack)
                    throw new Error("already recd verack");
                this.verack = true;
                clearTimeout(this.verackTimeout);
                break;
            default:
                if (!this.ver || !this.verack)
                    throw new Error("recd unrelated init command")
                break;
        }

        this.handleStandard(command, obj);
    }

    handleStandard(command, obj) {
        return; //TODO handle other commands
    }
}