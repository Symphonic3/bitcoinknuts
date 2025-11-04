import { Buffer } from 'buffer';
import { sha256d, hexDump } from '../utils.js';

//https://en.bitcoin.it/wiki/Protocol_documentation
export const PROTOCOL_DATA_TYPE = Object.freeze({
    int32: "int32",
    int64: "int34",
    uint8: "uint8",
    uint64: "uint64",
    net_addr_notime: "net_addr_notime",
    net_addr: "net_addr",
    var_int: "var_int",
    var_str: "var_str",
    bool: "bool",
    dump: "dump",
    char_array_32: "char_array_32",
    array_with_varint_count: "array_with_varint_count",
    inv_vect: "inv_vect"
    //...etc
});

function writeAsBuffer(part, data) {
    const buffers = [];

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
        case PROTOCOL_DATA_TYPE.array_with_varint_count:
            pushVarIntBuffer(data.length);
            for (let i = 0; i < data.length; i++) {
                buffers.push(writeAsBuffer({ type: part.item }, data[i]));
            }
            break;
        case PROTOCOL_DATA_TYPE.inv_vect:
            pushBuffer(4).writeUInt32LE(data.type);
            buffers.push(Buffer.from(data.hash, 'hex').reverse());
            break;
        case PROTOCOL_DATA_TYPE.bool:
            pushBuffer(1).writeUInt8(data ? 0x1 : 0x0);
            break;
        case PROTOCOL_DATA_TYPE.net_addr:
        case PROTOCOL_DATA_TYPE.net_addr_notime:
            if (part.type === PROTOCOL_DATA_TYPE.net_addr) {
                pushBuffer(4).writeUInt32LE(data.time);
            }
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

    return Buffer.concat(buffers);
}

function readFromBuffer(part, buffer) {
    let data;

    function readVarInt() {
        const data = buffer.readUInt8();
        buffer = buffer.slice(1);
        if (data < 0xFD) {
            return data;
        } else if (data == 253) {
            const out = buffer.readUInt16LE();
            buffer = buffer.slice(2);
            return out;
        } else if (data == 254) {
            const out = buffer.readUInt32LE();
            buffer = buffer.slice(4);
            return out;
        } else {
            const out = buffer.readBigUInt64LE();
            buffer = buffer.slice(8);
            return out;
        }
    }

    switch (part.type) {
        case PROTOCOL_DATA_TYPE.int32:
            data = buffer.readInt32LE();
            buffer = buffer.slice(4);
            break;
        case PROTOCOL_DATA_TYPE.int64:
            data = buffer.readBigInt64LE();
            buffer = buffer.slice(8);
            break;
        case PROTOCOL_DATA_TYPE.uint64:
            data = buffer.readBigUInt64LE();
            buffer = buffer.slice(8);
            break;
        case PROTOCOL_DATA_TYPE.var_int:
            data = readVarInt();
            break;
        case PROTOCOL_DATA_TYPE.var_str:
            const strlen = readVarInt();
            data = buffer.slice(0, strlen).toString('ascii');
            buffer = buffer.slice(strlen);
            break;
        case PROTOCOL_DATA_TYPE.char_array_32:
            data = Buffer.from(buffer.slice(0, 32)).reverse().toString('hex');
            buffer = buffer.slice(32);
            break;
        case PROTOCOL_DATA_TYPE.array_with_varint_count:
            const count = readVarInt();
            const array = [];
            for (let i = 0; i < count; i++) {
                const { buffer: newBuffer, data: newData } = readFromBuffer(part.item, buffer);
                buffer = newBuffer;
                array.push(newData);
            }
            data = array;
            break;
        case PROTOCOL_DATA_TYPE.inv_vect:
            const type = buffer.readUInt32LE();
            buffer = buffer.slice(4);
            const hash = Buffer.from(buffer.slice(0, 32)).reverse().toString('hex');
            buffer = buffer.slice(32);
            data = { type, hash };
            break;
        case PROTOCOL_DATA_TYPE.bool:
            data = buffer.readUInt8() === 0x0 ? false : true;
            buffer = buffer.slice(1);
            break;
        case PROTOCOL_DATA_TYPE.net_addr:
        case PROTOCOL_DATA_TYPE.net_addr_notime:
            if (part.type === PROTOCOL_DATA_TYPE.net_addr) {
                addrObj.time = buffer.readUInt32LE();
                buffer = buffer.slice(4);
            }
            const addrObj = {};
            addrObj.services = buffer.readBigUInt64LE();
            buffer = buffer.slice(8);
            for (let i = 0; i < 10; i++) {
                const val = buffer.readUInt8();
                buffer = buffer.slice(1);
                if (val !== 0)
                    throw new Error();
            }
            for (let i = 0; i < 2; i++) {
                //if (payload.readUInt8() != 0xFF) throw new Error();
                buffer = buffer.slice(1);
            }
            const split = [];
            for (let i = 0; i < 4; i++) {
                split.push(buffer.readUInt8());
                buffer = buffer.slice(1);
            }
            addrObj.addr = split.join(".");
            addrObj.port = buffer.readInt16BE();
            buffer = buffer.slice(2);
            data = addrObj;
            break;
        case PROTOCOL_DATA_TYPE.dump:
            data = hexDump(buffer);
            buffer = Buffer.alloc(0);
            break;
        default:
            throw new Error();
    }

    return { buffer, data };
}

export function Serialize(messageType, messageObj) {
    const buffers = [];

    for (const part of messageType) {
        const data = messageObj[part.name];
        buffers.push(writeAsBuffer(part, data));
    }

    return Buffer.concat(buffers);
}

export function Deserialize(messageType, payload) {
    const obj = {};

    for (const part of messageType) {
        const { buffer, data } = readFromBuffer(part, payload);
        payload = buffer;
        obj[part.name] = data;
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