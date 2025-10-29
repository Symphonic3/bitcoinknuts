import { Buffer } from 'buffer';
import crypto from 'node:crypto';

const _protocolDataType = Object.freeze({
    int32: "int32",
    int64: "int34",
    uint8: "uint8",
    uint64: "uint64",
    net_addr_notime: "net_addr_notime",
    var_int: "var_int",
    var_str: "var_str",
    bool: "bool"
    //...etc
});

//https://en.bitcoin.it/wiki/Protocol_documentation

export const MESSAGE_VERSION = [
    { name: "version", type: _protocolDataType.int32 },
    { name: "services", type: _protocolDataType.uint64 },
    { name: "timestamp", type: _protocolDataType.int64 },
    { name: "addr_recv", type: _protocolDataType.net_addr_notime },
    { name: "addr_from", type: _protocolDataType.net_addr_notime },
    { name: "nonce", type: _protocolDataType.uint64 },
    { name: "user_agent", type: _protocolDataType.var_str },
    { name: "start_height", type: _protocolDataType.int32 },
    { name: "relay", type: _protocolDataType.bool }
];

export function Serialize(messageType, messageObj) {
    let buffers = [];

    function pushBuffer(n) {
        const buffer = Buffer.alloc(n);
        buffers.push(buffer);
        return buffer;
    }

    function pushVarIntBuffer(data) {
        if (data < 0xFD) {
            pushBuffer(1).writeUInt8(data);
        } else if (data <= 0xFFFF) {
            const buffer = pushBuffer(3);
            buffer.writeUInt16LE(data, buffer.writeUInt8(253));
        } else if (data <= 0xFFFFFFFF) {
            const buffer = pushBuffer(5);
            buffer.writeUInt32LE(data, buffer.writeUInt8(254));
        } else {
            const buffer = pushBuffer(9);
            buffer.writeBigUInt64LE(BigInt(data), buffer.writeUInt8(255));
        }
    }

    for (const part of messageType) {
        const data = messageObj[part.name];
        if (data === undefined)
            throw new ProtocolMessageSerializationError(part.name);

        switch (part.type) {
            case _protocolDataType.int32:
                pushBuffer(4).writeInt32LE(data);
                break;
            case _protocolDataType.int64:
                pushBuffer(8).writeBigInt64LE(BigInt(data));
                break;
            case _protocolDataType.uint64:
                pushBuffer(8).writeBigUInt64LE(BigInt(data));
                break;
            case _protocolDataType.var_int:
                pushVarIntBuffer(data);
                break;
            case _protocolDataType.var_str:
                pushVarIntBuffer(data.length);
                buffers.push(Buffer.from(data, 'ascii'));
                break;
            case _protocolDataType.bool:
                pushBuffer(1).writeUInt8(data ? 0x1 : 0x0);
                break;
            case _protocolDataType.net_addr_notime:
                const split = data.addr.split(".");
                pushBuffer(8).writeBigUInt64LE(BigInt(data.services));
                pushBuffer(10).fill(0);
                pushBuffer(2).fill(0xFF);
                pushBuffer(1).writeInt8(parseInt(split[0]));
                pushBuffer(1).writeInt8(parseInt(split[1]));
                pushBuffer(1).writeInt8(parseInt(split[2]));
                pushBuffer(1).writeInt8(parseInt(split[3]));
                pushBuffer(2).writeInt16BE(data.port);
                break;
            default:
                break;
        }
    }

    return Buffer.concat(buffers);
}

export function Deserialize(messageType, messageBuffer) {
    for (const part of messageType) {
        switch (part.type) {
            case _protocolDataType.int32:
                //todo
                break;
            //...etc
            default:
                break;
        }
    }

    //return messageObj
}

export function SerializeMessage(command, payload) {
    const magic = Buffer.from('F9BEB4D9', 'hex'); //mainnet magic value
    const commandBuffer = Buffer.alloc(12);
    commandBuffer.write(command, 0, 'ascii');
    const lengthBuf = Buffer.alloc(4);
    lengthBuf.writeUInt32LE(payload.length, 0);

    const checksum = sha256d(payload).slice(0,4);
    const message = Buffer.concat([magic, commandBuffer, lengthBuf, checksum, payload]);
    return message;
}

function sha256d(payload) {
    return crypto.createHash('sha256').update(
        crypto.createHash('sha256').update(payload).digest()).digest();
}

export class ProtocolMessageDeserializationError extends Error {
    constructor(message) { super(message) }
}

export class ProtocolMessageSerializationError extends Error {
    constructor(message) { super(message) }
}