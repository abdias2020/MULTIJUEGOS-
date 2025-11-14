//Código elaborado por: https://github.com/elrebelde21 

import { webp2png } from '../lib/webp2mp4.js';
import uploadFile from '../lib/uploadFile.js';
import uploadImage from '../lib/uploadImage.js';
import axios from 'axios';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OWNER1 = "51970454739@s.whatsapp.net"; // 👈 cambia este número si es otro tuyo
const ACTIVE_CONVERSATIONS = {};
const MAX_VIDEO_SIZE_MB = 60; // Límite de 60MB para videos

let handler = async (m, { conn, text, args, command, usedPrefix }) => {
let media = false;
let q = m.quoted ? m.quoted : m;
let mime = (q.msg || q).mimetype || '';
let url = '';

if (/image|video|audio/.test(mime)) {
media = await q.download();

if (/video/.test(mime)) {
let videoPath = join(__dirname, `./temp_video_${new Date().getTime()}.mp4`);
fs.writeFileSync(videoPath, media);

let videoStats = fs.statSync(videoPath);
let videoSizeMB = videoStats.size / (1024 * 1024);
if (videoSizeMB > MAX_VIDEO_SIZE_MB) {
fs.unlinkSync(videoPath);
return m.reply(`⚠️ El video excede el tamaño permitido (máx. 60 MB). Por favor, recórtalo o comprímelo.`);
}
url = videoPath;
} else {
url = await uploadImage(media);
}} else if (/webp/.test(mime)) {
media = await q.download();
url = await webp2png(media);
}

let activeConversation = Object.entries(ACTIVE_CONVERSATIONS)
.find(([id, convo]) => convo.active && convo.userId === m.sender && convo.chatId === m.chat);

if (activeConversation) {
let [reportId] = activeConversation;
let message = `📩 *Mensaje del usuario @${m.sender.split("@")[0]} (ID: ${reportId}):*\n${text || ''}`;

if (url) {
if (/image/.test(mime)) {
await conn.sendMessage(OWNER1, { image: { url }, caption: message, mentions: [m.sender] }, { quoted: m });
} else if (/video/.test(mime)) {
await conn.sendMessage(OWNER1, { video: { url }, caption: message, mentions: [m.sender] }, { quoted: m });
} else if (/audio/.test(mime)) {
await conn.sendMessage(OWNER1, { audio: { url }, mimetype: mime, caption: message, mentions: [m.sender] }, { quoted: m });
}} else if (m.msg && m.msg.sticker) {
await conn.sendMessage(OWNER1, { sticker: media, mentions: [m.sender] }, { quoted: m });
} else {
await conn.sendMessage(OWNER1, { text: message, mentions: [m.sender] }, { quoted: m });
}
return;
}

if (command === 'report' || command === 'reporte') {
if (!text && !m.quoted)
return m.reply(`⚠️ Escriba el error o comando con falla\n\nEjemplo:\n${usedPrefix + command} los sticker no funka`);
if (text.length < 8) throw `✨ Mínimo 10 caracteres para hacer el reporte.`;
if (text.length > 1000) throw `⚠️ Máximo 1000 caracteres para el reporte.`;

let reportId = Math.floor(Math.random() * 901);
ACTIVE_CONVERSATIONS[reportId] = {
userId: m.sender,
userName: m.pushName || 'Usuario desconocido',
active: true,
chatId: m.chat,
url: url,
mime: mime,
};

let reportText = text || (m.quoted && m.quoted.text) || 'Sin mensaje';
let teks = `┏━━⧼ ＲＥＰＯＲＴＥ ⧽━━┓
╏• *Número:* wa.me/${m.sender.split("@")[0]}
╏• *Mensaje:* ${reportText}
┗━━━━━━━━━━━━━━━━━━━━━━━┛

Responde al mensaje con:
*responder ${reportId} [mensaje]* para interactuar.
Usa *.fin ${reportId}* para cerrar la conversación.`;

await conn.sendMessage(OWNER1, { text: teks, mentions: [m.sender] }, { quoted: m });
await delay(1000);
await conn.reply(m.chat, `✅ El reporte fue enviado a mi creador. Recibirás una respuesta pronto.`);
return;
}};

handler.before = async (m, { conn }) => {
let activeConversation = Object.entries(ACTIVE_CONVERSATIONS)
.find(([id, convo]) => convo.active && convo.userId === m.sender && convo.chatId === m.chat);

if (activeConversation) {
let [reportId] = activeConversation;
let message2 = `📩 Nueva respuesta del usuario @${m.sender.split("@")[0]} (ID: ${reportId}):\n${m.text || ''}`;

if (m.mtype === 'stickerMessage') {
let sticker = await m.download();
if (sticker) await conn.sendMessage(OWNER1, { sticker }, { quoted: m });
} else if (/imageMessage|videoMessage|audioMessage/.test(m.mtype)) {
let media = await m.download();
let url = await uploadImage(media);
if (url) {
await conn.sendMessage(OWNER1, {
[m.mtype === 'videoMessage' ? 'video' : m.mtype === 'audioMessage' ? 'audio' : 'image']: { url },
caption: message2,
mentions: [m.sender]
}, { quoted: m });
}
} else {
await conn.sendMessage(OWNER1, { text: message2, mentions: [m.sender] }, { quoted: m });
}}

let matchResponder = m.text.match(/^responder (\S+) (.+)/i);
if (matchResponder) {
let [_, reportId, ownerMessage] = matchResponder;
if (!ACTIVE_CONVERSATIONS[reportId] || !ACTIVE_CONVERSATIONS[reportId].active) return;
let { userId } = ACTIVE_CONVERSATIONS[reportId];
await conn.sendMessage(userId, { text: `💬 *Propietario:* ${ownerMessage}` });
return;
}

let matchFin = m.text.match(/^\.fin (\S+)/i);
if (matchFin) {
let [_, reportId] = matchFin;
if (!ACTIVE_CONVERSATIONS[reportId]) return await conn.reply(m.chat, `⚠️ No se encontró una conversación activa con ese ID.`, m);
let { userId } = ACTIVE_CONVERSATIONS[reportId];
ACTIVE_CONVERSATIONS[reportId].active = false;
await conn.reply(userId, `🔒 La conversación ha sido cerrada por el propietario.`);
await delay(1000);
await conn.reply(m.chat, `✔️ Conversación ${reportId} cerrada.`);
return;
}};
handler.help = ['reporte <texto>'];
handler.tags = ['main'];
handler.exp = 3500;
handler.command = /^(report|request|reporte|bugs|bug|report-owner|reportes|reportar)$/i;
handler.register = true;
handler.private = true;
export default handler;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
/*
import { db } from "../lib/postgres.js";

const handler = async (m, { conn, text, usedPrefix, command }) => {
if (!text) return m.reply(`⚠️ Escriba ${command === "suggestion" ? "sugerencias" : "el error/comando con falla"}\n\n*𝐄𝐣:* ${usedPrefix + command} ${command === "suggestion" ? "Agregue un comando de ..." : "los sticker no funka"}`)
if (text.length < 8) return m.reply(`✨ *𝑴𝒊́𝒏𝒊𝒎𝒐 10 𝒄𝒂𝒓𝒂𝒄𝒕𝒆𝒓𝒆𝒔 𝒑𝒂𝒓𝒂 𝒉𝒂𝒄𝒆𝒓 𝒆𝒍 𝒓𝒆𝒑𝒐𝒓𝒕𝒆...*`)
if (text.length > 1000) return m.reply(`⚠️ *𝑴𝒂́𝒙𝒊𝒎𝒐 1000 𝑪𝒂𝒓𝒂𝒄𝒕𝒆𝒓𝒆𝒔 𝒑𝒂𝒓𝒂 𝒉𝒂𝒄𝒆𝒓 𝒆𝒍 𝒓𝒆𝒑𝒐𝒓𝒕𝒆.*`)
const nombre = m.pushName || "sin nombre";
const tipo = /sugge|suggestion/i.test(command) ? "sugerencia" : "reporte";

await db.query(`INSERT INTO reportes (sender_id, sender_name, mensaje, tipo) VALUES ($1, $2, $3, $4)`, [m.sender, nombre, text, tipo]);
return m.reply(tipo === "sugerencia" ? "✅ ¡Gracias! Tu sugerencia ha sido enviada a nuestro equipo de moderación y será tomada en cuenta." : "✅ Tu reporte ha sido enviado a nuestro equipo de moderación y será revisado pronto.");
};
handler.help = ["report <texto>", "sugge <sugerencia>"];
handler.tags = ["main"];
handler.command = /^(report|request|suggestion|sugge|reporte|bugs?|report-owner|reportes|reportar)$/i;
handler.register = true;

export default handler;
*/