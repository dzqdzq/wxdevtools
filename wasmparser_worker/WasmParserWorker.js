import * as WasmDis from "../third_party/wasmparser/package/dist/esm/WasmDis.js";
import * as WasmParser from "../third_party/wasmparser/package/dist/esm/WasmParser.js";
class BinaryReaderWithProgress extends WasmParser.BinaryReader {
  constructor(e) {
    super();
    this._percentage = 0;
    this._progressCallback = e;
  }
  read() {
    if (!super.read()) {
      return false;
    }
    const e = Math.floor((this.position / this.length) * 100);

    if (this._percentage !== e) {
      this._progressCallback.call(undefined, e);
      this._percentage = e;
    }

    return true;
  }
}

const BASE64_CHARS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const BASE64_CODES = new Uint8Array(123);
for (let e = 0; e < BASE64_CHARS.length; ++e) {
  BASE64_CODES[BASE64_CHARS.charCodeAt(e)] = e;
}
function base64Decode(e) {
  let s = ((3 * e.length) / 4) >>> 0;

  if (e.charCodeAt(e.length - 2) === 61) {
    s -= 2;
  } else if (e.charCodeAt(e.length - 1) === 61) {
    s -= 1;
  }

  const t = new Uint8Array(s);
  for (let s = 0, r = 0; s < e.length; s += 4) {
    const a = BASE64_CODES[e.charCodeAt(s + 0)];
    const o = BASE64_CODES[e.charCodeAt(s + 1)];
    const n = BASE64_CODES[e.charCodeAt(s + 2)];
    const i = BASE64_CODES[e.charCodeAt(s + 3)];
    t[r++] = (a << 2) | (o >> 4);
    t[r++] = ((15 & o) << 4) | (n >> 2);
    t[r++] = ((3 & n) << 6) | (63 & i);
  }
  return t.buffer;
}

self.onmessage = async function (e) {
  const s = e.data.method;
  const t = e.data.params;
  if (!s || s !== "disassemble") {
    return;
  }
  const r = base64Decode(t.content);
  let a = new BinaryReaderWithProgress((e) => {
    this.postMessage({ event: "progress", params: { percentage: 0.3 * e } });
  });
  a.setData(r, 0, r.byteLength);
  const o = new WasmDis.DevToolsNameGenerator();
  o.read(a);
  const n = new WasmDis.WasmDisassembler();
  n.addOffsets = true;
  n.exportMetadata = o.getExportMetadata();
  n.nameResolver = o.getNameResolver();

  a = new BinaryReaderWithProgress((e) => {
    this.postMessage({
      event: "progress",
      params: { percentage: 30 + 0.69 * e },
    });
  });

  a.setData(r, 0, r.byteLength);
  n.disassembleChunk(a);
  const { lines, offsets, functionBodyOffsets } = n.getResult();

  // 移除行数限制，显示全部内容
  // if (lines.length > 1000000 /* 1e6 */) {
  //   lines[1000000 /* 1e6 */] = ";; .... text is truncated due to size";
  //   lines.splice(1000001);
  //   offsets && offsets.splice(1000001);
  // }

  this.postMessage({ event: "progress", params: { percentage: 99 } });
  const d = lines.join("\n");
  this.postMessage({ event: "progress", params: { percentage: 100 } });

  // 打印最后三行内容到控制台，帮助确认是否有完整的解析结果
  if (lines.length > 0) {
    const lastThreeLines = lines.slice(-30);
    console.log("WASM解析结果的最后三行内容:", lines.length);
    console.log(JSON.stringify(lastThreeLines, null, 2)); 
  }

  this.postMessage({
    method: "disassemble",
    result: {
      source: d,
      offsets: offsets,
      functionBodyOffsets: functionBodyOffsets,
    },
  });
};

self.WasmParserWorker = self.WasmParserWorker || {};
WasmParserWorker = WasmParserWorker || {};
