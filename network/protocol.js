import { Buffer } from 'buffer';
import { sha256d, hexDump } from '../utils.js';

export const PROTOCOL_DATA_TYPE = Object.freeze({
    int32: "int32",
    int64: "int34",
    uint8: "uint8",
    uint64: "uint64",
    net_addr_notime: "net_addr_notime",
    var_int: "var_int",
    var_str: "var_str",
    bool: "bool",
    dump: "dump",
    char_array_32: "char_array_32",
    inv_vect_array_with_count: "inv_vect_array_with_count"
    //...etc
});

//https://en.bitcoin.it/wiki/Protocol_documentation

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
            buffer.writeBigUInt64LE(data, buffer.writeUInt8(255));
        }
    }

    for (const part of messageType) {
        const data = messageObj[part.name];
        if (data === undefined)
            throw new ProtocolMessageSerializationError(part.name);

        switch (part.type) {
            case PROTOCOL_DATA_TYPE.int32:
                pushBuffer(4).writeInt32LE(data);
                break;
            case PROTOCOL_DATA_TYPE.int64:
                pushBuffer(8).writeBigInt64LE(data);
                break;
            case PROTOCOL_DATA_TYPE.uint64:
                pushBuffer(8).writeBigUInt64LE(data);
                break;
            case PROTOCOL_DATA_TYPE.var_int:
                pushVarIntBuffer(data);
                break;
            case PROTOCOL_DATA_TYPE.var_str:
                pushVarIntBuffer(data.length);
                buffers.push(Buffer.from(data, 'ascii'));
                break;
            case PROTOCOL_DATA_TYPE.char_array_32:
                if (data.length != 64)
                    throw new Error();
                buffers.push(Buffer.from(data, 'hex').reverse());
                break;
            case PROTOCOL_DATA_TYPE.inv_vect_array_with_count:
                pushVarIntBuffer(data.length);
                for (let i = 0; i < data.length; i++) {
                    pushBuffer(4).writeUInt32LE(data[i].type);
                    buffers.push(Buffer.from(data[i].hash, 'hex').reverse());
                }
                break;
            case PROTOCOL_DATA_TYPE.bool:
                pushBuffer(1).writeUInt8(data ? 0x1 : 0x0);
                break;
            case PROTOCOL_DATA_TYPE.net_addr_notime:
                const split = data.addr.split(".");
                pushBuffer(8).writeBigUInt64LE(data.services);
                pushBuffer(10).fill(0);
                pushBuffer(2).fill(0xFF);
                pushBuffer(1).writeInt8(parseInt(split[0]));
                pushBuffer(1).writeInt8(parseInt(split[1]));
                pushBuffer(1).writeInt8(parseInt(split[2]));
                pushBuffer(1).writeInt8(parseInt(split[3]));
                pushBuffer(2).writeInt16BE(data.port);
                break;
            default:
                throw new Error();
        }
    }

    return Buffer.concat(buffers);
}

export function Deserialize(messageType, payload) {
    let index = 0;
    const obj = {};

    function readVarInt() {
        const data = payload.readUInt8(index);
        index++;
        if (data < 0xFD) {
            return data;
        } else if (data == 253) {
            const out = payload.readUInt16LE(index);
            index += 2;
            return out;
        } else if (data == 254) {
            const out = payload.readUInt32LE(index);
            index += 4;
            return out;
        } else {
            const out = payload.readBigUInt64LE(index);
            index += 8;
            return out;
        }
    }

    for (const part of messageType) {
        switch (part.type) {
            case PROTOCOL_DATA_TYPE.int32:
                obj[part.name] = payload.readInt32LE(index);
                index += 4;
                break;
            case PROTOCOL_DATA_TYPE.int64:
                obj[part.name] = payload.readBigInt64LE(index);
                index += 8;
                break;
            case PROTOCOL_DATA_TYPE.uint64:
                obj[part.name] = payload.readBigUInt64LE(index);
                index += 8;
                break;
            case PROTOCOL_DATA_TYPE.var_int:
                obj[part.name] = readVarInt();
                break;
            case PROTOCOL_DATA_TYPE.var_str:
                const strlen = readVarInt();
                obj[part.name] = payload.slice(index, index + strlen).toString('ascii');
                index += strlen;
                break;
            case PROTOCOL_DATA_TYPE.char_array_32:
                obj[part.name] = Buffer.from(payload.slice(index, index + 32)).reverse().toString('hex');
                index += 32;
                break;
            case PROTOCOL_DATA_TYPE.inv_vect_array_with_count:
                const count = readVarInt();
                const invVectArray = [];
                for (let i = 0; i < count; i++) {
                    const type = payload.readUInt32LE(index);
                    index += 4;
                    const hash = Buffer.from(payload.slice(index, index + 32)).reverse().toString('hex');
                    index += 32;
                    invVectArray.push({ type, hash });
                }
                obj[part.name] = invVectArray;
                break;
            case PROTOCOL_DATA_TYPE.bool:
                obj[part.name] = payload.readUInt8(index) === 0x0 ? false : true;
                index += 1;
                break;
            case PROTOCOL_DATA_TYPE.net_addr_notime:
                const addrObj = {};
                addrObj.services = payload.readBigUInt64LE(index);
                index += 8;
                for (let i = 0; i < 10; i++) {
                    if (payload.readUInt8(index++) != 0) throw new Error();
                }
                for (let i = 0; i < 2; i++) {
                    index++;
                    //if (payload.readUInt8(index++) != 0xFF) throw new Error();
                }
                const split = [];
                for (let i = 0; i < 4; i++) {
                    split.push(payload.readUInt8(index++));
                }
                addrObj.addr = split.join(".");
                addrObj.port = payload.readInt16BE(index);
                index += 2;
                obj[part.name] = addrObj;
                break;
            case PROTOCOL_DATA_TYPE.dump:
                obj[part.name] = hexDump(payload);
                index += payload.length;
                break;
            default:
                throw new Error();
        }
    }

    return obj;
}

const MAGIC = 0xF9BEB4D9; //mainnet magic value

export function SerializeMessage(command, payload) {
    const magic = Buffer.alloc(4);
    magic.writeUInt32BE(MAGIC);
    const commandBuffer = Buffer.alloc(12);
    commandBuffer.write(command, 0, 'ascii');
    const lengthBuf = Buffer.alloc(4);
    lengthBuf.writeUInt32LE(payload.length, 0);

    const checksum = sha256d(payload).slice(0,4);
    const message = Buffer.concat([magic, commandBuffer, lengthBuf, checksum, payload]);
    return message;
}

export function DeserializeMessage(buffer) {
    const magic = buffer.slice(0, 4);
    if (magic.readUInt32BE() != MAGIC) {
        console.log('Invalid magic, skipping.');
        buffer = buffer.slice(1);
        return { buffer };
    }

    const command = buffer.slice(4, 16).toString('ascii').replace(/\0+$/, '');
    const length = buffer.readUInt32LE(16);
    const checksum = buffer.slice(20, 24);

    if (buffer.length < 24 + length) 
        return { buffer }; //wait for full payload

    const payload = buffer.slice(24, 24 + length);
    const validChecksum = sha256d(payload).slice(0, 4);
    if (!checksum.equals(validChecksum)) {
        console.log('Checksum mismatch.');
        buffer = buffer.slice(24 + length);
        return { buffer };
    }

    buffer = buffer.slice(24 + length);

    return { buffer, command, payload };
}

export class ProtocolMessageDeserializationError extends Error {
    constructor(message) { super(message) }
}

export class ProtocolMessageSerializationError extends Error {
    constructor(message) { super(message) }
}