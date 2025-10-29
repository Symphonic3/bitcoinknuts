import { MESSAGE_VERSION, Serialize, SerializeMessage } from './protocol.js';
import { resolve4 } from 'dns/promises';
import net from 'node:net';

const message = {
    version: 70015,
    services: 0,
    timestamp: Math.floor(Date.now()/1000),
    addr_recv: { services: 0, addr: '0.0.0.0', port: 0 },
    addr_from: { services: 0, addr: '0.0.0.0', port: 0 },
    nonce: 0,
    user_agent: '/Satoshi:28.1.0/',
    start_height: 0,
    relay: false
};

const serMsg = SerializeMessage("version", Serialize(MESSAGE_VERSION, message));

async function bitcoin() {
    const addresses = await resolve4("seed.btc.petertodd.org");
    const client = await connectWithPromise(8333, addresses[0]);
    client.write(serMsg);
}

bitcoin();

function connectWithPromise(port, host) {
    return new Promise((resolve, reject) => {
        const client = new net.Socket();
        client.on('error', (err) => {
            reject(err);
        });
        client.on('data', (data) => {
            console.log("Connected to client: " + data.toString('ascii'));
        });
        client.connect(port, host, () => {
            resolve(client);
        });
    });
}