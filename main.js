import * as baileys from "@whiskeysockets/baileys";
import fs from "fs";
import path from "path";
import chalk from "chalk";
import readlineSync from "readline-sync";
import pino from "pino";
import NodeCache from "node-cache";
import qrcode from "qrcode-terminal";
import { startSubBot } from "./lib/subbot.js";
import "./config.js";
import { handler, callUpdate, participantsUpdate, groupsUpdate } from "./handler.js";
import { loadPlugins } from "./lib/plugins.js";

await loadPlugins();

const BOT_SESSION_FOLDER = "./BotSession";
const BOT_CREDS_PATH = path.join(BOT_SESSION_FOLDER, "creds.json");
if (!fs.existsSync(BOT_SESSION_FOLDER)) fs.mkdirSync(BOT_SESSION_FOLDER);

if (!globalThis.conns || !(globalThis.conns instanceof Array)) globalThis.conns = [];
const reconectando = new Set();
let usarCodigo = false;
let numero = "";

/* ===================== CONTROL DE ERRORES ===================== */
let spamCount = 0;
setInterval(() => (spamCount = 0), 60 * 1000);

const origError = console.error;
console.error = (...args) => {
  if (args[0]?.toString().includes("Closing stale open session")) {
    spamCount++;
    if (spamCount > 50) {
      console.log("⚠️ Loop detectado, ignorando para evitar crash");
      return;
    }
  }
  origError(...args);
};

main();

/* ===================== MAIN ===================== */
async function main() {
  const hayCredencialesPrincipal = fs.existsSync(BOT_CREDS_PATH);
  const subbotsFolder = "./jadibot";
  const haySubbotsActivos =
    fs.existsSync(subbotsFolder) &&
    fs.readdirSync(subbotsFolder).some(f =>
      fs.existsSync(path.join(subbotsFolder, f, "creds.json"))
    );

  if (!hayCredencialesPrincipal && !haySubbotsActivos) {
    const opcion = readlineSync.question(
      "1 = QR | 2 = Código de emparejamiento\n> "
    );
    usarCodigo = opcion === "2";
    if (usarCodigo) {
      numero = readlineSync.question("Número con país: ").replace(/\D/g, "");
      if (numero.startsWith("52") && !numero.startsWith("521")) {
        numero = "521" + numero.slice(2);
      }
    }
  }

  await cargarSubbots();

  if (hayCredencialesPrincipal || !haySubbotsActivos) {
    await startBot();
  }
}

/* ===================== SUBBOTS ===================== */
async function cargarSubbots() {
  const folder = "./jadibot";
  if (!fs.existsSync(folder)) return;

  for (const userId of fs.readdirSync(folder)) {
    const credsPath = path.join(folder, userId, "creds.json");
    if (!fs.existsSync(credsPath)) continue;
    if (reconectando.has(userId)) continue;

    try {
      reconectando.add(userId);
      await startSubBot(null, null, "Auto reconexión", false, userId);
    } catch (e) {
      console.log(`❌ Error subbot ${userId}:`, e.message);
    } finally {
      reconectando.delete(userId);
    }

    await new Promise(r => setTimeout(r, 2000));
  }

  setTimeout(cargarSubbots, 60 * 1000);
}

/* ===================== BOT PRINCIPAL ===================== */
async function startBot() {
  const { state, saveCreds } = await baileys.useMultiFileAuthState(BOT_SESSION_FOLDER);
  const { version } = await baileys.fetchLatestBaileysVersion();

  const sock = baileys.makeWASocket({
    logger: pino({ level: "silent" }),
    auth: {
      creds: state.creds,
      keys: baileys.makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
    },
    browser: ["Windows", "Chrome"],
    markOnlineOnConnect: false,
    version,
    keepAliveIntervalMs: 55000
  });

  globalThis.conn = sock;
  sock.ev.on("creds.update", saveCreds);

  /* ===================== CONEXIÓN ===================== */
  sock.ev.on("connection.update", async ({ connection, qr }) => {
    if (qr && !usarCodigo) qrcode.generate(qr, { small: true });

    if (connection === "open") {
      console.log("✅ Conectado correctamente a WhatsApp");
    }
  });

  if (usarCodigo && !state.creds.registered) {
    setTimeout(async () => {
      const code = await sock.requestPairingCode(numero);
      console.log("Código:", code);
    }, 2000);
  }

  /* ===================== MENSAJES ===================== */
  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const msg of messages) {
      if (!msg.message) continue;
      try {
        await handler(sock, msg);
      } catch (e) {
        console.error("Handler error:", e);
      }
    }
  });

  /* ===================== LLAMADAS ===================== */
  sock.ev.on("call", async calls => {
    for (const call of calls) {
      try {
        await callUpdate(sock, call);
      } catch {}
    }
  });

  setupGroupEvents(sock);

  /* ===================== LIMPIEZA TMP ===================== */
  setInterval(() => {
    const tmp = "./tmp";
    if (!fs.existsSync(tmp)) return;
    for (const f of fs.readdirSync(tmp)) {
      const p = path.join(tmp, f);
      if (Date.now() - fs.statSync(p).mtimeMs > 3 * 60 * 1000) {
        fs.unlinkSync(p);
      }
    }
  }, 30 * 1000);

  /* ===================== LIMPIEZA SESIONES ===================== */
  setInterval(() => {
    const bases = ["./jadibot", "./BotSession"];
    for (const base of bases) {
      if (!fs.existsSync(base)) continue;
      for (const folder of fs.readdirSync(base)) {
        const dir = path.join(base, folder);
        if (!fs.statSync(dir).isDirectory()) continue;

        for (const file of fs.readdirSync(dir)) {
          if (file === "creds.json") continue;
          const p = path.join(dir, file);
          if (Date.now() - fs.statSync(p).mtimeMs > 30 * 60 * 1000) {
            fs.unlinkSync(p);
          }
        }
      }
    }
  }, 10 * 60 * 1000);
}

/* ===================== GRUPOS ===================== */
function setupGroupEvents(sock) {
  sock.ev.on("group-participants.update", async update => {
    try {
      await participantsUpdate(sock, update);
    } catch {}
  });

  sock.ev.on("groups.update", async updates => {
    for (const update of updates) {
      try {
        await groupsUpdate(sock, update);
      } catch {}
    }
  });
}