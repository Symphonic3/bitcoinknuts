import { Serialize, SerializeMessage, PROTOCOL_DATA_TYPE, DeserializeMessage, Deserialize } from './protocol.js';

//idk kinda messy
export const PROTOCOL_MESSAGE_TYPE = Object.freeze({
    version: "version",
    verack: "verack",
    alert: "alert",
    ping: "ping",
    pong: "pong",
    getdata: "getdata",
    block: "block",
    addr: "addr"
});

const PROTOCOL_MESSAGE = Object.freeze({
    version: [
        { name: "version", type: PROTOCOL_DATA_TYPE.int32 },
        { name: "services", type: PROTOCOL_DATA_TYPE.uint64 },
        { name: "timestamp", type: PROTOCOL_DATA_TYPE.int64 },
        { name: "addr_recv", type: PROTOCOL_DATA_TYPE.net_addr_notime },
        { name: "addr_from", type: PROTOCOL_DATA_TYPE.net_addr_notime },
        { name: "nonce", type: PROTOCOL_DATA_TYPE.uint64 },
        { name: "user_agent", type: PROTOCOL_DATA_TYPE.var_str },
        { name: "start_height", type: PROTOCOL_DATA_TYPE.int32 },
        { name: "relay", type: PROTOCOL_DATA_TYPE.bool }
    ],
    verack: [],
    alert: [
        { name: "payload", type: PROTOCOL_DATA_TYPE.dump },
    ],
    block: [
        { name: "payload", type: PROTOCOL_DATA_TYPE.dump },
    ],
    ping: [
        { name: "nonce", type: PROTOCOL_DATA_TYPE.uint64 }
    ],
    pong: [
        { name: "nonce", type: PROTOCOL_DATA_TYPE.uint64 }
    ],
    getdata: [
        { name: "inventory", type: PROTOCOL_DATA_TYPE.array_with_varint_count, item: PROTOCOL_DATA_TYPE.inv_vect }
    ],
    addr: [
        { name: "addr_list", type: PROTOCOL_DATA_TYPE.array_with_varint_count, item: PROTOCOL_DATA_TYPE.net_addr }
    ]
});

export function Message(command, obj) {
    //do we need to do this? better safe than sorry.
    if (!Object.keys(PROTOCOL_MESSAGE_TYPE).includes(command))
        throw new Error();

    return SerializeMessage(command, Serialize(PROTOCOL_MESSAGE[command], obj ?? Buffer.alloc(0)));
}

export function DeMessage(buffer) {
    let { buffer: newBuffer, command, payload } = DeserializeMessage(buffer);

    if (command === undefined || payload === undefined)
        return { buffer: newBuffer };

    //we definitely should do this.
    if (!Object.keys(PROTOCOL_MESSAGE_TYPE).includes(command)) {
        console.log("Unknown command " + command);
    } else {
        const obj = Deserialize(PROTOCOL_MESSAGE[command], payload);
        return { buffer: newBuffer, command, obj };
    }

    return { buffer: newBuffer };
}