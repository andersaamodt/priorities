#!/usr/bin/env node
import crypto from "node:crypto";

const P = 0xfffffffffffffffffffffffffffffffffffffffffffffffffffffffefffffc2fn;
const N = 0xfffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141n;
const G = [
  0x79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798n,
  0x483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8n,
];
const BECH32 = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";

function fail(message) {
  printKv({ ok: "0", message: String(message || "Support zap failed.") });
}

function printKv(values) {
  for (const [key, value] of Object.entries(values)) {
    process.stdout.write(`${key}=${String(value ?? "").replace(/[\r\n]/g, " ").slice(0, 1200)}\n`);
  }
}

function bytesToHex(bytes) {
  return Buffer.from(bytes).toString("hex");
}

function hexToBytes(hex) {
  const value = String(hex || "").trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(value)) throw new Error("Expected a 32-byte hex value.");
  return Buffer.from(value, "hex");
}

function mod(value, modulo = P) {
  const result = value % modulo;
  return result >= 0n ? result : result + modulo;
}

function powMod(base, exponent, modulo = P) {
  let result = 1n;
  let value = mod(base, modulo);
  let exp = exponent;
  while (exp > 0n) {
    if (exp & 1n) result = mod(result * value, modulo);
    value = mod(value * value, modulo);
    exp >>= 1n;
  }
  return result;
}

function inverse(value, modulo = P) {
  return powMod(value, modulo - 2n, modulo);
}

function pointAdd(a, b) {
  if (!a) return b;
  if (!b) return a;
  const [x1, y1] = a;
  const [x2, y2] = b;
  if (x1 === x2 && mod(y1 + y2) === 0n) return null;
  const slope = x1 === x2 && y1 === y2
    ? mod(3n * x1 * x1 * inverse(2n * y1))
    : mod((y2 - y1) * inverse(x2 - x1));
  const x3 = mod(slope * slope - x1 - x2);
  return [x3, mod(slope * (x1 - x3) - y1)];
}

function pointMul(scalar, point = G) {
  let n = mod(scalar, N);
  let result = null;
  let addend = point;
  while (n > 0n) {
    if (n & 1n) result = pointAdd(result, addend);
    addend = pointAdd(addend, addend);
    n >>= 1n;
  }
  return result;
}

function liftX(hex) {
  const x = BigInt(`0x${hex}`);
  const y2 = mod(x ** 3n + 7n);
  let y = powMod(y2, (P + 1n) / 4n);
  if (mod(y * y) !== y2) throw new Error("Nostr pubkey does not lift to secp256k1.");
  if (y & 1n) y = P - y;
  return [x, y];
}

function int32(value) {
  return Buffer.from(value.toString(16).padStart(64, "0"), "hex");
}

function sha256(data) {
  return crypto.createHash("sha256").update(data).digest();
}

function taggedHash(tag, data) {
  const tagHash = sha256(Buffer.from(tag, "utf8"));
  return sha256(Buffer.concat([tagHash, tagHash, data]));
}

function secretToInt(secretHex) {
  const value = BigInt(`0x${bytesToHex(hexToBytes(secretHex))}`);
  if (value <= 0n || value >= N) throw new Error("NWC secret is out of range.");
  return value;
}

function pubkeyFromSecret(secretHex) {
  const point = pointMul(secretToInt(secretHex));
  if (!point) throw new Error("NWC secret produced an invalid pubkey.");
  return point[0].toString(16).padStart(64, "0");
}

function schnorrSign(secretHex, msgHash) {
  let d = secretToInt(secretHex);
  let point = pointMul(d);
  if (!point) throw new Error("Invalid signing key.");
  if (point[1] & 1n) {
    d = N - d;
    point = pointMul(d);
  }
  const px = point[0];
  const aux = crypto.randomBytes(32);
  const t = d ^ BigInt(`0x${bytesToHex(taggedHash("BIP0340/aux", aux))}`);
  let k = BigInt(`0x${bytesToHex(taggedHash("BIP0340/nonce", Buffer.concat([int32(t), int32(px), msgHash])))}`) % N;
  if (k === 0n) throw new Error("Generated zero nonce.");
  let rPoint = pointMul(k);
  if (!rPoint) throw new Error("Invalid nonce point.");
  if (rPoint[1] & 1n) {
    k = N - k;
    rPoint = pointMul(k);
  }
  const r = rPoint[0];
  const e = BigInt(`0x${bytesToHex(taggedHash("BIP0340/challenge", Buffer.concat([int32(r), int32(px), msgHash])))}`) % N;
  const s = mod(k + e * d, N);
  return Buffer.concat([int32(r), int32(s)]).toString("hex");
}

function finalizeEvent(kind, secretHex, tags, content) {
  const pubkey = pubkeyFromSecret(secretHex);
  const createdAt = Math.floor(Date.now() / 1000);
  const body = JSON.stringify([0, pubkey, createdAt, kind, tags, content]);
  const id = sha256(Buffer.from(body, "utf8")).toString("hex");
  return {
    id,
    pubkey,
    created_at: createdAt,
    kind,
    tags,
    content,
    sig: schnorrSign(secretHex, Buffer.from(id, "hex")),
  };
}

function sharedX(secretHex, pubkeyHex) {
  const point = pointMul(secretToInt(secretHex), liftX(pubkeyHex));
  if (!point) throw new Error("Could not derive shared Nostr secret.");
  return int32(point[0]);
}

function encryptNip04(secretHex, pubkeyHex, plaintext) {
  const key = sharedX(secretHex, pubkeyHex);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  return `${ciphertext.toString("base64")}?iv=${encodeURIComponent(iv.toString("base64"))}`;
}

function decryptNip04(secretHex, pubkeyHex, payload) {
  const [cipherText, params] = String(payload || "").split("?iv=");
  const iv = Buffer.from(decodeURIComponent(params || ""), "base64");
  const decipher = crypto.createDecipheriv("aes-256-cbc", sharedX(secretHex, pubkeyHex), iv);
  return Buffer.concat([decipher.update(Buffer.from(cipherText || "", "base64")), decipher.final()]).toString("utf8");
}

function hkdfExtract(ikm, salt) {
  return crypto.createHmac("sha256", salt).update(ikm).digest();
}

function hkdfExpand(prk, info, length) {
  const blocks = [];
  let previous = Buffer.alloc(0);
  for (let counter = 1; Buffer.concat(blocks).length < length; counter += 1) {
    previous = crypto.createHmac("sha256", prk).update(Buffer.concat([previous, info, Buffer.from([counter])])).digest();
    blocks.push(previous);
  }
  return Buffer.concat(blocks).subarray(0, length);
}

function paddedLength(length) {
  if (length <= 32) return 32;
  const nextPower = 1 << (Math.floor(Math.log2(length - 1)) + 1);
  const chunk = nextPower <= 256 ? 32 : nextPower / 8;
  return chunk * (Math.floor((length - 1) / chunk) + 1);
}

function padPlaintext(plaintext) {
  const body = Buffer.from(String(plaintext), "utf8");
  if (body.length < 1 || body.length > 65535) throw new Error("NIP44 plaintext length is invalid.");
  const prefix = Buffer.alloc(2);
  prefix.writeUInt16BE(body.length, 0);
  return Buffer.concat([prefix, body, Buffer.alloc(paddedLength(body.length) - body.length)]);
}

function unpadPlaintext(padded) {
  const length = padded.readUInt16BE(0);
  if (length < 1 || padded.length !== 2 + paddedLength(length)) throw new Error("NIP44 padding is invalid.");
  return padded.subarray(2, 2 + length).toString("utf8");
}

function chacha20(key, nonce12, data) {
  const cipher = crypto.createCipheriv("chacha20", key, Buffer.concat([Buffer.alloc(4), nonce12]));
  return Buffer.concat([cipher.update(data), cipher.final()]);
}

function conversationKey(secretHex, pubkeyHex) {
  return hkdfExtract(sharedX(secretHex, pubkeyHex), Buffer.from("nip44-v2", "utf8"));
}

function encryptNip44(secretHex, pubkeyHex, plaintext) {
  const nonce = crypto.randomBytes(32);
  const keys = hkdfExpand(conversationKey(secretHex, pubkeyHex), nonce, 76);
  const ciphertext = chacha20(keys.subarray(0, 32), keys.subarray(32, 44), padPlaintext(plaintext));
  const mac = crypto.createHmac("sha256", keys.subarray(44, 76)).update(Buffer.concat([nonce, ciphertext])).digest();
  return Buffer.concat([Buffer.from([2]), nonce, ciphertext, mac]).toString("base64");
}

function decryptNip44(secretHex, pubkeyHex, payload) {
  const raw = Buffer.from(String(payload || ""), "base64");
  if (raw[0] !== 2 || raw.length < 99) throw new Error("Unsupported NIP44 payload.");
  const nonce = raw.subarray(1, 33);
  const ciphertext = raw.subarray(33, -32);
  const mac = raw.subarray(-32);
  const keys = hkdfExpand(conversationKey(secretHex, pubkeyHex), nonce, 76);
  const expected = crypto.createHmac("sha256", keys.subarray(44, 76)).update(Buffer.concat([nonce, ciphertext])).digest();
  if (!crypto.timingSafeEqual(mac, expected)) throw new Error("NIP44 MAC check failed.");
  return unpadPlaintext(chacha20(keys.subarray(0, 32), keys.subarray(32, 44), ciphertext));
}

function decodeLnurl(value) {
  const input = String(value || "").trim().toLowerCase();
  const split = input.lastIndexOf("1");
  if (split <= 0) throw new Error("LNURL is malformed.");
  const data = Array.from(input.slice(split + 1, -6), (char) => {
    const found = BECH32.indexOf(char);
    if (found < 0) throw new Error("LNURL contains invalid characters.");
    return found;
  });
  let bits = 0;
  let buffer = 0;
  const out = [];
  for (const value5 of data) {
    buffer = (buffer << 5) | value5;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((buffer >> bits) & 255);
    }
  }
  return Buffer.from(out).toString("utf8").replace(/\0+$/g, "");
}

function lnurlPayUrl(target) {
  const raw = String(target || "").trim();
  if (/^lnurl1/i.test(raw)) return decodeLnurl(raw);
  if (/^https?:\/\//i.test(raw)) return raw;
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(raw)) {
    const [name, domain] = raw.toLowerCase().split("@");
    return `https://${domain}/.well-known/lnurlp/${encodeURIComponent(name)}`;
  }
  throw new Error("Support destination must be a Lightning address, LNURL, or HTTPS LNURL endpoint.");
}

async function resolveInvoice(target, amountMsats, note) {
  const metadataResponse = await fetch(lnurlPayUrl(target), { cache: "no-store" });
  if (!metadataResponse.ok) throw new Error(`LNURL metadata request failed with HTTP ${metadataResponse.status}.`);
  const metadata = await metadataResponse.json();
  if (String(metadata.status || "").toUpperCase() === "ERROR") throw new Error(metadata.reason || "LNURL endpoint rejected the request.");
  if (!metadata.callback) throw new Error("LNURL endpoint did not provide an invoice callback.");
  const min = Number(metadata.minSendable || 0);
  const max = Number(metadata.maxSendable || 0);
  if ((min && amountMsats < min) || (max && amountMsats > max)) {
    throw new Error(`Amount is outside the destination range (${Math.ceil(min / 1000)}-${Math.floor(max / 1000)} sats).`);
  }
  const callback = new URL(metadata.callback);
  callback.searchParams.set("amount", String(amountMsats));
  if (Number(metadata.commentAllowed || 0) > 0 && note) {
    callback.searchParams.set("comment", String(note).slice(0, Number(metadata.commentAllowed)));
  }
  const invoiceResponse = await fetch(callback, { cache: "no-store" });
  if (!invoiceResponse.ok) throw new Error(`Invoice request failed with HTTP ${invoiceResponse.status}.`);
  const invoice = await invoiceResponse.json();
  if (String(invoice.status || "").toUpperCase() === "ERROR") throw new Error(invoice.reason || "LNURL endpoint could not create an invoice.");
  const pr = String(invoice.pr || invoice.payment_request || "").trim();
  if (!/^ln/i.test(pr)) throw new Error("LNURL endpoint did not return a BOLT11 invoice.");
  return { invoice: pr };
}

function parseNwcUri(uri) {
  const parsed = new URL(String(uri || "").trim());
  if (parsed.protocol !== "nostr+walletconnect:") throw new Error("NWC URI must start with nostr+walletconnect://.");
  const walletPubkey = (parsed.hostname || parsed.pathname.replace(/^\//, "")).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(walletPubkey)) throw new Error("NWC URI is missing the wallet pubkey.");
  const secret = String(parsed.searchParams.get("secret") || "").toLowerCase();
  hexToBytes(secret);
  const relays = parsed.searchParams.getAll("relay").filter(Boolean);
  if (!relays.length) throw new Error("NWC URI is missing a relay parameter.");
  return { walletPubkey, secret, relays };
}

async function queryWalletInfo(relay, walletPubkey) {
  const sub = `support-info-${crypto.randomBytes(4).toString("hex")}`;
  return relayRoundTrip(relay, (ws) => {
    ws.send(JSON.stringify(["REQ", sub, { kinds: [13194], authors: [walletPubkey], limit: 1 }]));
  }, (payload) => Array.isArray(payload) && payload[0] === "EVENT" && payload[1] === sub ? payload[2] : null, 2500).catch(() => null);
}

function relayRoundTrip(relay, onOpen, select, timeoutMs) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(relay);
    const timer = setTimeout(() => finish(reject, new Error(`Timed out waiting for ${relay}.`)), timeoutMs);
    function finish(done, value) {
      clearTimeout(timer);
      try { ws.close(); } catch {}
      done(value);
    }
    ws.onopen = () => onOpen(ws);
    ws.onerror = () => finish(reject, new Error(`Could not connect to ${relay}.`));
    ws.onmessage = (message) => {
      let payload;
      try { payload = JSON.parse(String(message.data || "")); } catch { return; }
      const selected = select(payload, ws);
      if (selected) finish(resolve, selected);
    };
  });
}

async function chooseEncryption(connection) {
  for (const relay of connection.relays) {
    const info = await queryWalletInfo(relay, connection.walletPubkey);
    if (!info) continue;
    if (!String(info.content || "").split(/\s+/).includes("pay_invoice")) throw new Error("Wallet does not advertise pay_invoice support.");
    const encryptionTag = (info.tags || []).find((tag) => Array.isArray(tag) && tag[0] === "encryption");
    const modes = encryptionTag ? String(encryptionTag[1] || "").split(/\s+/) : ["nip04"];
    if (modes.includes("nip44_v2")) return "nip44_v2";
    if (modes.includes("nip04")) return "nip04";
  }
  return "nip04";
}

async function payInvoice(connection, invoice, amountMsats, note, app, action) {
  const encryption = await chooseEncryption(connection);
  const request = JSON.stringify({
    method: "pay_invoice",
    params: { invoice, amount: amountMsats, metadata: { app, action, note } },
  });
  const content = encryption === "nip44_v2"
    ? encryptNip44(connection.secret, connection.walletPubkey, request)
    : encryptNip04(connection.secret, connection.walletPubkey, request);
  const tags = [["p", connection.walletPubkey], ["expiration", String(Math.floor(Date.now() / 1000) + 120)], ["encryption", encryption]];
  const event = finalizeEvent(23194, connection.secret, tags, content);
  const clientPubkey = pubkeyFromSecret(connection.secret);
  const response = await waitForNwcResponse(connection.relays, event, clientPubkey);
  const plaintext = encryption === "nip44_v2"
    ? decryptNip44(connection.secret, connection.walletPubkey, response.content)
    : decryptNip04(connection.secret, connection.walletPubkey, response.content);
  const payload = JSON.parse(plaintext);
  if (payload.error) throw new Error(payload.error.message || payload.error.code || "Wallet rejected the payment.");
  return { preimage: payload.result?.preimage || "", feesPaid: payload.result?.fees_paid || "", encryption };
}

async function waitForNwcResponse(relays, event, clientPubkey) {
  const sub = `support-pay-${crypto.randomBytes(4).toString("hex")}`;
  return Promise.any(relays.map((relay) => relayRoundTrip(relay, (ws) => {
    ws.send(JSON.stringify(["REQ", sub, { kinds: [23195], "#e": [event.id], "#p": [clientPubkey], since: Math.floor(Date.now() / 1000) - 60 }]));
    ws.send(JSON.stringify(["EVENT", event]));
  }, (payload) => {
    if (Array.isArray(payload) && payload[0] === "EVENT" && payload[1] === sub) return payload[2];
    return null;
  }, 45000))).catch(() => {
    throw new Error("Timed out waiting for the wallet response.");
  });
}

async function main() {
  if (process.argv[2] === "--self-test") {
    const pub2 = pubkeyFromSecret("0000000000000000000000000000000000000000000000000000000000000002");
    const key = conversationKey("0000000000000000000000000000000000000000000000000000000000000001", pub2).toString("hex");
    if (key !== "c41c775356fd92eadc63ff5a0dc1da211b268cbea22316767095b2871ea1412d") {
      throw new Error("NIP44 conversation key vector failed.");
    }
    const plain = JSON.stringify({ method: "pay_invoice", params: { invoice: "lnbc1..." } });
    const encrypted04 = encryptNip04("0000000000000000000000000000000000000000000000000000000000000001", pub2, plain);
    if (decryptNip04("0000000000000000000000000000000000000000000000000000000000000001", pub2, encrypted04) !== plain) {
      throw new Error("NIP04 round trip failed.");
    }
    const encrypted44 = encryptNip44("0000000000000000000000000000000000000000000000000000000000000001", pub2, plain);
    if (decryptNip44("0000000000000000000000000000000000000000000000000000000000000001", pub2, encrypted44) !== plain) {
      throw new Error("NIP44 round trip failed.");
    }
    printKv({ ok: "1", message: "support-dev-zap self-test passed" });
    return;
  }
  const payload = JSON.parse(Buffer.from(process.argv[2] || "", "base64").toString("utf8") || "{}");
  const amountSats = Math.max(1, Number(payload.amountSats || payload.amount_sats || 0) || 0);
  const amountMsats = amountSats * 1000;
  const note = String(payload.note || "Support development with a zap.").trim();
  const connection = parseNwcUri(payload.nwcUri || payload.nwc_uri || "");
  const { invoice } = await resolveInvoice(payload.target || "zap@andersaamodt.com", amountMsats, note);
  const paid = await payInvoice(connection, invoice, amountMsats, note, payload.app || "Wizardry app", payload.action || "support_dev");
  printKv({
    ok: "1",
    message: `Sent ${amountSats} sat Support Dev zap.`,
    amount_sats: String(amountSats),
    preimage: paid.preimage,
    fees_paid_msats: paid.feesPaid,
    encryption: paid.encryption,
  });
}

main().catch((error) => fail(error instanceof Error ? error.message : String(error)));
