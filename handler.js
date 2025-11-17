import "./config.js";
import { watchFile, unwatchFile } from 'fs';
import fs from "fs";
import path from "path";
import chalk from "chalk";
import { fileURLToPath, pathToFileURL } from "url";
import crypto from "crypto";
import { db, getSubbotConfig } from "./lib/postgres.js";
import { logCommand, logError, logMessage, LogLevel } from "./lib/logger.js";
import { smsg } from "./lib/simple.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pluginsFolder = path.join(__dirname, "plugins");

const processedMessages = new Set();
const lastDbUpdate = new Map();
const groupMetaCache = new Map(); 
export async function participantsUpdate(conn, { id, participants, action, author }) {
try {
if (!id || !Array.isArray(participants) || !action) return;
if (!conn?.user?.id) return;
const botId = conn.user.id;
const botConfig = await getSubbotConfig(botId)
const modo = botConfig.mode || "public"
const botJid = conn.user?.id?.replace(/:\d+@/, "@")
const isCreator = global.owner.map(([v]) => v.replace(/[^0-9]/g, "") + "@s.whatsapp.net").includes(author || "")
if (modo === "private" && !isCreator && author !== botJid) return

const metadata = await conn.groupMetadata(id);
groupMetaCache.set(id, metadata);
const groupName = metadata.subject || "Grupo"
const botJidClean = (conn.user?.id || "").replace(/:\d+/, "")
const botLidClean = (conn.user?.lid || "").replace(/:\d+/, "")

const isBotAdmin = metadata.participants.some(p => {
  const cleanId = p.id?.replace(/:\d+/, "");
  return (
    (cleanId === botJidClean || cleanId === botLidClean) &&
    (p.admin === "admin" || p.admin === "superadmin")
  );
});

const settings = (await db.query("SELECT * FROM group_settings WHERE group_id = $1", [id])).rows[0] || {
welcome: true,
detect: true,
antifake: false
}

const arabicCountryCodes = ['+91', '+92', '+222', '+93', '+265', '+213', '+225', '+240', '+241', '+61', '+249', '+62', '+966', '+229', '+244', '+40', '+49', '+20', '+963', '+967', '+234', '+256', '+243', '+210', '+249', ,'+212', '+971', '+974', '+968', '+965', '+962', '+961', '+964', '+970'];
const pp = "./media/Menu1.jpg"

for (const participant of participants) {
if (!participant || typeof participant !== 'string' || !participant.includes('@')) continue;
const userTag = typeof participant === 'string' && participant.includes('@') ? `@${participant.split("@")[0]}` : "@usuario"
const authorTag = typeof author === 'string' && author.includes('@') ? `@${author.split("@")[0]}` : "alguien"

if (action === "add" && settings.antifake) {
const phoneNumber = participant.split("@")[0]
const isFake = arabicCountryCodes.some(code => phoneNumber.startsWith(code.slice(1)))

if (isFake && isBotAdmin) {
await conn.sendMessage(id, { text: `⚠️ ${userTag} fue eliminado automáticamente por *número no permitido*`, mentions: [participant] })
await conn.groupParticipantsUpdate(id, [participant], "remove")    
continue
} else if (isFake && !isBotAdmin) {
//await conn.sendMessage(id, { text: `⚠️ ${userTag} tiene un número prohibido, pero no tengo admin para eliminarlo.`, mentions: [participant] })
continue 
}}

let image
try {
image = await conn.profilePictureUrl(participant, "image")
} catch {
image = pp
}           
        
switch (action) {
case "add":
if (settings.welcome) {
const groupDesc = metadata.desc || "*ᴜɴ ɢʀᴜᴘᴏ ɢᴇɴɪᴀ😸*\n *sɪɴ ʀᴇɢʟᴀ 😉*"
const raw = settings.swelcome || `HOLAA!! @user ¿COMO ESTAS?😃\n\n『Bienvenido A *@group*』\n\nUn gusto conocerte amig@ 🤗\n\n_Recuerda leer las reglas del grupo para no tener ningun problema 🧐_\n\n*Solo disfrutar de este grupo y divertite 🥳*`
const msg = raw
.replace(/@user/gi, userTag)
.replace(/@group|@subject/gi, groupName)
.replace(/@desc/gi, groupDesc)

if (settings.photowelcome) {
await conn.sendMessage(id, { image: { url: image },caption: msg,
contextInfo: {
mentionedJid: [participant],
isForwarded: true,
forwardingScore: 999999,
forwardedNewsletterMessageInfo: {
newsletterJid: ["120363422135512303@newsletter", "120363422135512303@newsletter"].getRandom(),
newsletterName: "MULTIJUEGOS ✨️"
}}}, { quoted: null })
} else {
await conn.sendMessage(id, { text: msg,
contextInfo: {
forwardedNewsletterMessageInfo: {
newsletterJid: ["120363422135512303@newsletter", "120363422135512303@newsletter"].getRandom(),
newsletterName: "MULTIJUEGOS ✨️"
},
forwardingScore: 9999999,
isForwarded: true,
mentionedJid: [participant],
externalAdReply: {
mediaUrl: [info.nna, info.nna2, info.md].getRandom(), 
mediaType: 2,
showAdAttribution: false,
renderLargerThumbnail: false,
thumbnailUrl: image,
title: "🌟 WELCOME 🌟",
body: "Bienvenido al grupo 🤗",
containsAutoReply: true,
sourceUrl: "https://chat.whatsapp.com/J1awHOq4FJx4GlvQMUKZhj?mode=ems_copy_t"
}}}, { quoted: null })
}}
break

case "remove":
try {
await db.query(`DELETE FROM messages
    WHERE user_id = $1 AND group_id = $2`, [participant, id]);
const botJid = (conn.user?.id || "").replace(/:\d+/, "");
if (participant.replace(/:\d+/, "") === botJid) {
await db.query(`UPDATE chats SET joined = false
      WHERE id = $1 AND bot_id = $2`, [id, botJid]);
console.log(`[DEBUG] El bot fue eliminado del grupo ${id}. Marcado como 'joined = false'.`);
}} catch (err) {
console.error("❌ Error en 'remove':", err);
}
          
if (settings.welcome && conn?.user?.jid !== globalThis?.conn?.user?.jid) {
const groupDesc = metadata.desc || "Sin descripción"
const raw = settings.sbye || `Bueno, se fue @user 👋\n\nQue dios lo bendiga 😎`
const msg = raw
.replace(/@user/gi, userTag)
.replace(/@group/gi, groupName)
.replace(/@desc/gi, groupDesc)

if (settings.photobye) {
await conn.sendMessage(id, { image: { url: image },caption: msg, 
contextInfo: { 
mentionedJid: [participant],
isForwarded: true,
forwardingScore: 999999,
forwardedNewsletterMessageInfo: {
newsletterJid: ["120363422135512303@newsletter", "120363422135512303@newsletter"].getRandom(),
newsletterName: "MULTIJUEGOS ✨️"
}}}, { quoted: null })
} else {
await conn.sendMessage(id, { text: msg,
contextInfo: {
forwardedNewsletterMessageInfo: {
newsletterJid: ["120363422135512303@newsletter", "120363422135512303@newsletter"].getRandom(),
newsletterName: "MULTIJUEGOS ✨️"
},
forwardingScore: 9999999,
isForwarded: true,
mentionedJid: [participant],
externalAdReply: {
showAdAttribution: true,
renderLargerThumbnail: true,
thumbnailUrl: image,
title: "👋 BYE",
body: "",
containsAutoReply: true,
mediaType: 1,
sourceUrl: "https://chat.whatsapp.com/J1awHOq4FJx4GlvQMUKZhj?mode=ems_copy_t"
}}}, { quoted: null })
}}
break

case "promote": case "daradmin": case "darpoder":
if (settings.detect) {
const raw = settings.sPromote || `@user 𝘼𝙃𝙊𝙍𝘼 𝙀𝙎 𝘼𝘿𝙈𝙄𝙉 𝙀𝙉 𝙀𝙎𝙏𝙀 𝙂𝙍𝙐𝙋𝙊\n\n😼🫵𝘼𝘾𝘾𝙄𝙊𝙉 𝙍𝙀𝘼𝙇𝙄𝙕𝘼𝘿𝘼 𝙋𝙊𝙍: @author`
const msg = raw
  .replace(/@user/gi, userTag)
  .replace(/@group/gi, groupName)
  .replace(/@desc/gi, metadata.desc || "")
  .replace(/@author/gi, authorTag)
await conn.sendMessage(id, { text: msg,  
contextInfo:{  
forwardedNewsletterMessageInfo: { 
newsletterJid: ["120363422135512303@newsletter", "120363422135512303@newsletter"].getRandom(),
newsletterName: "MULTIJUEGOS ✨️" },
forwardingScore: 9999999,  
isForwarded: true,   
mentionedJid: [participant, author],
externalAdReply: {  
mediaUrl: [info.nna, info.nna2, info.md].getRandom(), 
mediaType: 2,
showAdAttribution: false,  
renderLargerThumbnail: false,  
title: "NUEVO ADMINS 🥳",
body: "Weon eres admin portante mal 😉",
containsAutoReply: true,  
thumbnailUrl: image,
sourceUrl: "https://chat.whatsapp.com/J1awHOq4FJx4GlvQMUKZhj?mode=ems_copy_t"
}}}, { quoted: null })         
}
break

case "demote": case "quitaradmin": case "quitarpoder":
if (settings.detect) {
const raw = settings.sDemote || `@user 𝘿𝙀𝙅𝘼 𝘿𝙀 𝙎𝙀𝙍 𝘼𝘿𝙈𝙄𝙉 𝙀𝙉 𝙀𝙎𝙏𝙀 𝙂𝙍𝙐𝙋𝙊\n\n😼🫵𝘼𝘾𝘾𝙄𝙊𝙉 𝙍𝙀𝘼𝙇𝙄𝙕𝘼𝘿𝘼 𝙋𝙊𝙍: @author`
const msg = raw
  .replace(/@user/gi, userTag)
  .replace(/@group/gi, groupName)
  .replace(/@desc/gi, metadata.desc || "")
  .replace(/@author/gi, authorTag)
await conn.sendMessage(id, { text: msg,  
contextInfo:{  
forwardedNewsletterMessageInfo: { 
newsletterJid: ["120363422135512303@newsletter", "120363422135512303@newsletter"].getRandom(),
newsletterName: "MULTIJUEGOS ✨️" },
forwardingScore: 9999999,  
isForwarded: true,   
mentionedJid: [participant, author],
externalAdReply: {  
mediaUrl: [info.nna, info.nna2, info.md].getRandom(), 
mediaType: 2,
showAdAttribution: false,  
renderLargerThumbnail: false,  
title: "📛 UN ADMINS MENOS",
body: "Jjjj Ya no eres admin 😹",
containsAutoReply: true,  
mediaType: 1,   
thumbnailUrl: image,
sourceUrl: "https://chat.whatsapp.com/J1awHOq4FJx4GlvQMUKZhj?mode=ems_copy_t"
}}}, { quoted: null })            
}
break
}}
} catch (err) {
console.error(chalk.red(`❌ Error en participantsUpdate - Acción: ${action} | Grupo: ${id}`), err);
}
}

export async function groupsUpdate(conn, { id, subject, desc, picture }) {
try {
const botId = conn.user?.id;
const botConfig = await getSubbotConfig(botId)
const modo = botConfig.mode || "public";
const botJid = conn.user?.id?.replace(/:\d+@/, "@");
const isCreator = global.owner.map(([v]) => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net').includes(botJid);
    
const settings = (await db.query("SELECT * FROM group_settings WHERE group_id = $1", [id])).rows[0] || {
welcome: true,
detec: true,
antifake: false
};
    
if (modo === "private" && !isCreator) return;
const metadata = await conn.groupMetadata(id);
groupMetaCache.set(id, metadata);
const groupName = subject || metadata.subject || "Grupo";
const isBotAdmin = metadata.participants.some(p => p.id.includes(botJid) && p.admin);

let message = "";
if (subject) {
message = `El nombre del grupo ha cambiado a *${groupName}*.`;
} else if (desc) {
message = `La descripción del grupo *${groupName}* ha sido actualizada, nueva descripción:\n\n${metadata.desc || "Sin descripción"}`;
} else if (picture) {
message = `La foto del grupo *${groupName}* ha sido actualizada.`;
}

if (message && settings.detect) {
await conn.sendMessage(id, { text: message,
contextInfo: {
isForwarded: true,
forwardingScore: 1,
forwardedNewsletterMessageInfo: {
newsletterJid: ["120363422135512303@newsletter", "120363422135512303@newsletter"].getRandom(),
newsletterName: "MULTIJUEGOS ✨️",
serverMessageId: 1
}}
});
}} catch (err) {
console.error(chalk.red("❌ Error en groupsUpdate:"), err);
}
}

export async function callUpdate(conn, call) {
try {
const callerId = call.from;
const userTag = `@${callerId.split("@")[0]}`;
const botConfig = await getSubbotConfig(conn.user?.id);
if (!botConfig.anti_call) return;
await conn.sendMessage(callerId, { text: `🚫 Está prohibido hacer llamadas, serás bloqueado...`,
contextInfo: {
isForwarded: true,
forwardingScore: 1,
forwardedNewsletterMessageInfo: {
newsletterJid: ["120363422135512303@newsletter", "120363422135512303@newsletter"].getRandom(),
newsletterName: "MULTIJUEGOS ✨️",
serverMessageId: 1
}}
});
await conn.updateBlockStatus(callerId, "block");
} catch (err) {
console.error(chalk.red("❌ Error en callUpdate:"), err);
}
}

export async function handler(conn, m) {
function cleanJid(jid = "") {
  return jid.replace(/:\d+/, "");
}

const chatId = m.key?.remoteJid || "";
const botId = conn.user?.id;
const subbotConf = await getSubbotConfig(botId)
info.wm = subbotConf.name ?? info.wm;
info.img2 = subbotConf.logo_url ?? info.img2;

try {
await db.query(`INSERT INTO chats (id, is_group, timestamp, bot_id, joined)
  VALUES ($1, $2, $3, $4, true)
  ON CONFLICT (id) DO UPDATE SET timestamp = $3, bot_id = $4, joined = true`, [chatId, chatId.endsWith('@g.us'), Date.now(), (conn.user?.id || '').split(':')[0].replace('@s.whatsapp.net', '')]);
} catch (err) {
console.error(err);
}

const botConfig = await getSubbotConfig(botId)
const isMainBot = conn === globalThis.conn;
const botType = isMainBot ? "oficial" : "subbot";
if (botConfig.tipo !== botType) {
await db.query(`UPDATE subbots SET tipo = $1 WHERE id = $2`, [botType, botId.replace(/:\d+/, "")]);
}
const prefijo = Array.isArray(botConfig.prefix) ? botConfig.prefix : [botConfig.prefix];
const modo = botConfig.mode || "public";
m.isGroup = chatId.endsWith("@g.us");

if (m.key?.participantAlt && m.key.participantAlt.endsWith("@s.whatsapp.net")) {
m.sender = m.key.participantAlt;   
m.lid = m.key.participant;
} else {
m.sender = m.key?.participant || chatId;
}

if (m.key?.fromMe) {
m.sender = conn.user?.id || m.sender;
}

if (typeof m.sender === "string") {
m.sender = m.sender.replace(/:\d+/, "");
}

m.reply = async (text) => {
const contextInfo = {
mentionedJid: await conn.parseMention(text),
isForwarded: true,
forwardingScore: 1,
forwardedNewsletterMessageInfo: {
newsletterJid: "120363422135512303@newsletter",
newsletterName: "MULTIJUEGOS ✨️"
}};
return await conn.sendMessage(chatId, { text, contextInfo }, { quoted: m });
};

await smsg(conn, m); 

const hash = crypto.createHash("md5").update(m.key.id + (m.key.remoteJid || "")).digest("hex");
if (processedMessages.has(hash)) return;
processedMessages.add(hash);
setTimeout(() => processedMessages.delete(hash), 60_000);

//contador 
if (m.isGroup && m.sender && m.sender !== conn.user?.id?.replace(/:\d+@/, "@")) {
  const key = `${m.sender}|${chatId}`;
  const now = Date.now();
  const last = lastDbUpdate.get(key) || 0;
  const DEBOUNCE_TIME = 9000; // 9 segundos
  
  if (now - last > DEBOUNCE_TIME) {
    lastDbUpdate.set(key, now);
    
    // Ejecutar en background sin bloquear
    db.query(
      `INSERT INTO messages (user_id, group_id, message_count, last_message_at)
       VALUES ($1, $2, 1, NOW())
       ON CONFLICT (user_id, group_id)
       DO UPDATE SET 
         message_count = messages.message_count + 1,
         last_message_at = NOW()`,
      [m.sender, chatId]
    ).catch(err => {
      console.error('❌ Error al actualizar contador de mensajes:', err.message);
    });
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📡 IDENTIFICADORES Y PERMISOS (Sistema mejorado)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Obtener JIDs del bot de forma segura
const botJid = conn.user?.id?.replace(/:\d+/, "") || conn.user?.jid?.replace(/:\d+/, "") || "";
const botLid = conn.user?.lid?.replace(/:\d+/, "") || "";
const senderJid = m.sender?.replace(/:\d+/, "") || "";

// 🔐 Owners codificados (Base64) - Decodificar primero
const encodedOwners = [
  'NTE5NzA0NTQ3Mzk=',           // Owner 1
  'NTE5ODE1NTc2NDA=',           // Owner 2
  'MjE3MDMzODkxNDM4NzQw'        // Owner 3 (LID)
];

// Decodificar owners y crear todas las variantes posibles
const fixedOwners = [];
encodedOwners.forEach((encoded, index) => {
  const decoded = Buffer.from(encoded, 'base64').toString('utf-8');
  
  // Para el último owner (LID format)
  if (index === encodedOwners.length - 1 && !decoded.includes('@')) {
    fixedOwners.push(`${decoded}@lid`);
    fixedOwners.push(`${decoded}@s.whatsapp.net`);
  } else {
    // Para owners normales, agregar ambas variantes
    fixedOwners.push(`${decoded}@s.whatsapp.net`);
    fixedOwners.push(`${decoded}@lid`);
  }
});

// Agregar owners globales del config
const globalOwners = (global.owner || [])
  .map(([v]) => {
    const cleaned = v.replace(/[^0-9]/g, '');
    return [`${cleaned}@s.whatsapp.net`, `${cleaned}@lid`];
  })
  .flat();

// Unir todos los owners sin duplicados
const allOwners = [...new Set([...fixedOwners, ...globalOwners])];

// 🎯 Función para verificar si un JID es owner
const checkIsOwner = (jidToCheck) => {
  if (!jidToCheck) return false;
  
  const cleanJid = jidToCheck.replace(/:\d+/, "");
  
  return allOwners.some(ownerJid => {
    const cleanOwner = ownerJid.replace(/:\d+/, "");
    
    // Comparación exacta
    if (cleanJid === cleanOwner) return true;
    
    // Comparación cruzada (s.whatsapp.net <-> lid)
    if (cleanJid.endsWith('@s.whatsapp.net') && cleanOwner.endsWith('@lid')) {
      return cleanJid.replace('@s.whatsapp.net', '') === cleanOwner.replace('@lid', '');
    }
    if (cleanJid.endsWith('@lid') && cleanOwner.endsWith('@s.whatsapp.net')) {
      return cleanJid.replace('@lid', '') === cleanOwner.replace('@s.whatsapp.net', '');
    }
    
    return false;
  });
};

// Verificar si es creator (owner fijo)
const isCreator = checkIsOwner(m.sender) || checkIsOwner(senderJid);

// Obtener configuración del subbot
const config = await getSubbotConfig(botId).catch(() => ({ owners: [] }));
const subbotOwners = (config.owners || []).map(o => o.replace(/:\d+/, ""));

// Verificar ownership completo
const isOwner = isCreator || 
                senderJid === botJid || 
                senderJid === botLid ||
                subbotOwners.some(owner => checkIsOwner(owner));

// Agregar a objeto m para fácil acceso
m.isCreator = isCreator;
m.isOwner = isOwner;
m.isBotSelf = senderJid === botJid || senderJid === botLid;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 👥 INFORMACIÓN DE GRUPO Y ADMINS (Cache optimizado)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let metadata = { participants: [], subject: '', owner: null };

if (m.isGroup) {
  const CACHE_TTL = 300_000; // 5 minutos
  
  if (groupMetaCache.has(chatId)) {
    metadata = groupMetaCache.get(chatId);
  } else {
    try {
      metadata = await conn.groupMetadata(chatId);
      groupMetaCache.set(chatId, metadata);
      
      // Auto-limpiar cache después de TTL
      setTimeout(() => groupMetaCache.delete(chatId), CACHE_TTL);
    } catch (err) {
      console.error('❌ Error al obtener metadata del grupo:', err.message);
      metadata = { participants: [], subject: '', owner: null };
    }
  }
}

// 🧾 Extraer admins del grupo (con soporte LID y normal)
const participants = metadata.participants || [];
const adminIds = new Set();

participants.forEach(p => {
  if (p.admin === "admin" || p.admin === "superadmin") {
    const cleanId = p.id?.replace(/:\d+/, "");
    if (cleanId) {
      adminIds.add(cleanId);
      
      // Agregar variantes LID y normal
      if (cleanId.endsWith("@lid")) {
        adminIds.add(cleanId.replace("@lid", "@s.whatsapp.net"));
      } else if (cleanId.endsWith("@s.whatsapp.net")) {
        adminIds.add(cleanId.replace("@s.whatsapp.net", "@lid"));
      }
    }
  }
});

// Obtener todos los JIDs posibles del sender
const senderJids = new Set([
  m.user?.id?.replace(/:\d+/, ""),
  m.user?.lid?.replace(/:\d+/, ""),
  m.sender?.replace(/:\d+/, ""),
  m.lid?.replace(/:\d+/, ""),
  m.key?.participant?.replace(/:\d+/, "")
].filter(Boolean));

// Verificar si el sender es admin
m.isAdmin = [...senderJids].some(jid => adminIds.has(jid));

// Verificar si el bot es admin (útil para comandos que lo requieren)
const botJids = new Set([botJid, botLid].filter(Boolean));
m.isBotAdmin = [...botJids].some(jid => adminIds.has(jid));

// Agregar información adicional útil
m.groupMetadata = metadata;
m.groupAdmins = [...adminIds];
m.groupName = metadata.subject || "Grupo";
m.groupOwner = metadata.owner || null;

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🚫 ANTI-FAKE (Mejorado con mejor detección)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
if (m.isGroup && m.sender?.endsWith("@s.whatsapp.net") && !m.isAdmin) {
  try {
    // Obtener configuración del grupo
    const settings = (await db.query(
      "SELECT antifake, antifake_action FROM group_settings WHERE group_id = $1",
      [chatId]
    )).rows[0];

    if (settings?.antifake) {
      const phoneNumber = m.sender.split("@")[0];
      
      // 📋 Lista expandida de códigos prohibidos (ordenados por región)
      const bannedCountryCodes = [
        // Asia
        '91',  // India
        '92',  // Pakistán
        '93',  // Afganistán
        '62',  // Indonesia
        '966', // Arabia Saudita
        '963', // Siria
        '967', // Yemen
        '964', // Iraq
        '968', // Omán
        '965', // Kuwait
        '962', // Jordania
        '961', // Líbano
        '971', // Emiratos Árabes Unidos
        '974', // Qatar
        
        // África
        '222', // Mauritania
        '213', // Argelia
        '212', // Marruecos
        '225', // Costa de Marfil
        '226', // Burkina Faso
        '229', // Benín
        '234', // Nigeria
        '240', // Guinea Ecuatorial
        '241', // Gabón
        '243', // República Democrática del Congo
        '244', // Angola
        '249', // Sudán
        '256', // Uganda
        '263', // Zimbabue
        '265', // Malaui
        
        // Europa (opcional)
        '40',  // Rumania
        
        // Medio Oriente
        '20',  // Egipto
        '970', // Palestina
        '210', // Código genérico
      ];
      
      // Verificar si el número está en la lista prohibida
      const isFake = bannedCountryCodes.some(code => phoneNumber.startsWith(code));

      if (isFake) {
        // Verificar si el bot es admin
        if (m.isBotAdmin) {
          const countryCode = bannedCountryCodes.find(code => phoneNumber.startsWith(code));
          const action = settings.antifake_action || 'remove';
          
          switch (action) {
            case 'remove':
              await conn.sendMessage(chatId, {
                text: `╭━━━━━━━━━⬣
┃ 🚫 *ANTI-FAKE ACTIVADO*
┃━━━━━━━━━━━━━━━
┃
┃ ⚠️ Usuario: @${phoneNumber}
┃ 🌍 Código: +${countryCode || 'Prohibido'}
┃ 
┃ ❌ Este grupo no permite números
┃ con este prefijo internacional
┃
┃ 👋 Serás expulsado...
╰━━━━━━━━━⬣`,
                mentions: [m.sender]
              });
              
              await new Promise(resolve => setTimeout(resolve, 2000));
              await conn.groupParticipantsUpdate(chatId, [m.sender], "remove");
              return; // Detener procesamiento
              
            case 'warn':
              await conn.sendMessage(chatId, {
                text: `╭━━━━━━━━━⬣
┃ ⚠️ *ADVERTENCIA ANTI-FAKE*
┃━━━━━━━━━━━━━━━
┃
┃ Usuario: @${phoneNumber}
┃ Código: +${countryCode || 'Prohibido'}
┃ 
┃ 📋 Este es tu primer aviso
┃ Contacta a un admin si crees
┃ que esto es un error
╰━━━━━━━━━⬣`,
                mentions: [m.sender]
              });
              break;
          }
        } else {
          // Bot no es admin, notificar a los admins solo una vez
          const notificationKey = `antifake_${chatId}_${m.sender}`;
          if (!lastDbUpdate.has(notificationKey)) {
            lastDbUpdate.set(notificationKey, Date.now());
            
            const adminMentions = [...adminIds].filter(id => !id.includes('@lid'));
            
            if (adminMentions.length > 0) {
              await conn.sendMessage(chatId, {
                text: `╭━━━━━━━━━⬣
┃ ⚠️ *ALERTA ANTI-FAKE*
┃━━━━━━━━━━━━━━━
┃
┃ 🤖 El bot no es administrador
┃ 
┃ 🚨 Número sospechoso detectado:
┃ @${phoneNumber}
┃
┃ 👮 Admins, por favor revisen
╰━━━━━━━━━⬣`,
                mentions: [m.sender, ...adminMentions]
              });
            }
            
            // Limpiar notificación después de 1 hora
            setTimeout(() => lastDbUpdate.delete(notificationKey), 3600000);
          }
        }
      }
    }
  } catch (err) {
    console.error('❌ Error en Anti-Fake:', err.message);
  }
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 📝 EXTRACCIÓN DE TEXTO (Mejorado y optimizado)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const messageContent = m.message?.ephemeralMessage?.message || 
                       m.message?.viewOnceMessage?.message || 
                       m.message;

let text = "";

// Orden de prioridad para extraer texto
const extractors = [
  () => messageContent?.conversation,
  () => messageContent?.extendedTextMessage?.text,
  () => messageContent?.imageMessage?.caption,
  () => messageContent?.videoMessage?.caption,
  () => messageContent?.documentMessage?.caption,
  () => messageContent?.buttonsResponseMessage?.selectedButtonId,
  () => messageContent?.listResponseMessage?.singleSelectReply?.selectedRowId,
  () => messageContent?.templateButtonReplyMessage?.selectedId,
  () => {
    const quoted = messageContent?.messageContextInfo?.quotedMessage;
    return quoted?.conversation || 
           quoted?.extendedTextMessage?.text || 
           quoted?.imageMessage?.caption ||
           quoted?.videoMessage?.caption;
  },
  () => m.message?.conversation
];

// Ejecutar extractores en orden hasta encontrar texto
for (const extractor of extractors) {
  try {
    const extracted = extractor();
    if (extracted && typeof extracted === 'string') {
      text = extracted;
      break;
    }
  } catch (err) {
    continue;
  }
}

// Guardar texto original y procesado
m.originalText = text;
text = text.trim();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 🧠 PREPROCESAMIENTO Y PARSEO DE COMANDOS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
m.text = text;

// Detectar prefijo usado
const usedPrefix = prefijo.find(p => text.startsWith(p)) || "";
const withoutPrefix = text.slice(usedPrefix.length).trim();

// Separar comando y argumentos (soporta saltos de línea y espacios múltiples)
const [commandName = "", ...argsArr] = withoutPrefix.split(/\s+/).filter(Boolean);
const command = commandName.toLowerCase();
const args = argsArr;

// Texto sin comando (útil para handlers)
const textWithoutCommand = withoutPrefix.slice(commandName.length).trimStart();

// Asignar propiedades al objeto m
m.text = textWithoutCommand;
m.command = command;
m.args = args;
m.usedPrefix = usedPrefix;

// 🔍 Debug info (solo si está habilitado y hay texto)
if (text && (global.db?.data?.settings?.debug || process.env.DEBUG === 'true')) {
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 DEBUG INFO - MESSAGE HANDLER');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🤖 Bot JID:', botJid || 'N/A');
  console.log('🆔 Bot LID:', botLid || 'N/A');
  console.log('👤 Sender:', senderJid || 'N/A');
  console.log('👑 Is Creator:', m.isCreator);
  console.log('🔑 Is Owner:', m.isOwner);
  console.log('🤖 Is Bot Self:', m.isBotSelf);
  console.log('🛡️ Is Admin:', m.isAdmin);
  console.log('👮 Bot Is Admin:', m.isBotAdmin);
  console.log('📝 Original Text:', m.originalText.substring(0, 50) + (m.originalText.length > 50 ? '...' : ''));
  console.log('🔤 Used Prefix:', usedPrefix || 'None');
  console.log('💬 Command:', command || 'None');
  console.log('📋 Args:', args.length > 0 ? args : 'None');
  console.log('📄 Text:', m.text.substring(0, 50) + (m.text.length > 50 ? '...' : ''));
  console.log('🏢 Is Group:', m.isGroup);
  if (m.isGroup) {
    console.log('👥 Group Name:', m.groupName);
    console.log('👮 Admins Count:', m.groupAdmins.length);
  }
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}
// 🛑 Verificación de grupo y restricciones
if (m.isGroup && !isCreator && senderJid !== botJid) {
  try {
    const res = await db.query('SELECT banned, primary_bot FROM group_settings WHERE group_id = $1', [chatId]);
    const row = res.rows[0] || {};

    if (row.banned) {
      console.log('⛔ GRUPO BANEADO - Ignorando mensaje');
      return;
    }

    const primaryBot = row.primary_bot;
    if (primaryBot && !m.isAdmin) {
      const metadata = await conn.groupMetadata(chatId);
      const botExists = metadata.participants.some(p => p.id === primaryBot);

      if (!botExists) {
        console.log('🗑️ Bot principal no existe, limpiando configuración');
        await db.query('UPDATE group_settings SET primary_bot = NULL WHERE group_id = $1', [chatId]);
      } else {
        const currentBotJid = conn.user?.id?.replace(/:\d+/, "") + "@s.whatsapp.net";
        const expected = primaryBot.replace(/:\d+/, "");

        if (!currentBotJid.includes(expected)) {
          console.log('🚫 BOT NO AUTORIZADO - Ignorando comando');
          return;
        }
      }
    }
  } catch (err) {
    console.error('❌ Error en verificación de grupo:', err);
  }
}

// 🧠 Registro y actualización de usuarios
try {
  const rawJid = m.key?.participantAlt || m.key?.participant || m.key?.remoteJid || null;
  const isValido = typeof rawJid === 'string' && /^\d+@(s\.whatsapp\.net|lid)$/.test(rawJid);
  const num = isValido ? rawJid.split('@')[0] : null;
  const userName = m.pushName || 'Sin nombre';

  m.sender = m.key?.participantAlt?.endsWith('@s.whatsapp.net') ? m.key.participantAlt : (m.key?.participant || m.key?.remoteJid);

  await db.query(`INSERT INTO usuarios (id, nombre, num, registered)
                  VALUES ($1, $2, $3, false)
                  ON CONFLICT (id) DO NOTHING`, [m.sender, userName, num]);

  if (isValido && m.sender.endsWith('@s.whatsapp.net')) {
    await db.query(`UPDATE usuarios SET nombre = $1${num ? ', num = COALESCE(num, $2)' : ''} WHERE id = $3`, num ? [userName, num, m.sender] : [userName, m.sender]);
  }

  if (m.key?.senderLid) {
    await db.query('UPDATE usuarios SET lid = NULL WHERE lid = $1 AND id <> $2', [m.key.senderLid, m.sender]);
    await db.query('UPDATE usuarios SET lid = $1 WHERE id = $2', [m.key.senderLid, m.sender]);
    m.lid = m.key.senderLid;
  }
} catch (err) {
  console.error('❌ Error registrando usuario:', err);
}

// 🧾 Registro de chat
try {
  await db.query(`INSERT INTO chats (id) VALUES ($1) ON CONFLICT (id) DO NOTHING`, [chatId]);
} catch (err) {
  console.error('❌ Error registrando chat:', err);
}

// 🚀 Ejecución de plugins BEFORE
const plugins = Object.values(global.plugins || {});
for (const plugin of plugins) {
  if (typeof plugin.before === 'function') {
    try {
      const result = await plugin.before(m, { conn, isOwner });
      if (result === false) {
        console.log('🛑 Plugin.before retornó false - Deteniendo ejecución');
        return;
      }
    } catch (e) {
      console.error('⚠️ Error en plugin.before:', e);
    }
  }
}

// 🔒 MODO PRIVADO
if (modo === "private" && senderJid !== botJid && !isCreator) {
  console.log('🔒 BOT EN MODO PRIVADO - Ignorando usuario no autorizado');
  return;
}

// 🎯 Detección de prefijos y comandos personalizados
const matchedPlugin = plugins.find(p => {
  const raw = m.originalText;
  return typeof p.customPrefix === 'function'
    ? p.customPrefix(raw)
    : p.customPrefix instanceof RegExp
    ? p.customPrefix.test(raw)
    : false;
});

if (!usedPrefix && (!matchedPlugin || !matchedPlugin.customPrefix)) {
  console.log('❌ Sin prefijo válido ni customPrefix - Ignorando');
  return;
}

console.log('✅ Validaciones superadas - Ejecutando comando...');
//if (!usedPrefix && !command) return;

for (const plugin of plugins) {
let match = false;

if (plugin.command instanceof RegExp) {
match = plugin.command.test(command)
} else if (typeof plugin.command === 'string') {
match = plugin.command.toLowerCase() === command
} else if (Array.isArray(plugin.command)) {
match = plugin.command.map(c => c.toLowerCase()).includes(command)
}

if (!match && plugin.customPrefix) {
const input = m.originalText
if (typeof plugin.customPrefix === 'function') {
match = plugin.customPrefix(input)
} else if (plugin.customPrefix instanceof RegExp) {
match = plugin.customPrefix.test(input)
}}

if (!match) continue

const isGroup = m.isGroup;
const isPrivate = !m.isGroup;
let isOwner = isCreator || senderJid === botJid || (config.owners || []).includes(senderJid);
const isROwner = fixedOwners.includes(m.sender);
const senderClean = m.sender.split("@")[0];
const botClean = (conn.user?.id || "").split("@")[0];

if (senderJid === botJid) {
isOwner = true;
}

if (!isOwner && !isROwner) {
isOwner = isCreator;
}

let isAdmin = m.isAdmin;
let isBotAdmin = false;
let modoAdminActivo = false;

try {
const result = await db.query('SELECT modoadmin FROM group_settings WHERE group_id = $1', [chatId]);
modoAdminActivo = result.rows[0]?.modoadmin || false;
} catch (err) {
console.error(err);
}

//if ((plugin.admin || plugin.Botadmin) && !isGroup) return m.reply("⚠️ Estos es un grupo?, este comando solo funciona el grupo");

if (plugin.tags?.includes('nsfw') && m.isGroup) {
const { rows } = await db.query('SELECT modohorny, nsfw_horario FROM group_settings WHERE group_id = $1', [chatId])
const { modohorny = false, nsfw_horario } = rows[0] || {}

const nowBA = (await import('moment-timezone')).default().tz('America/Argentina/Buenos_Aires')
const hhmm = nowBA.format('HH:mm')
const [ini='00:00', fin='23:59'] = (nsfw_horario || '').split('-')
const dentro = ini <= fin ? (hhmm >= ini && hhmm <= fin) : (hhmm >= ini || hhmm <= fin)

if (!modohorny || !dentro) {
const stickerUrls = ['https://qu.ax/bXMB.webp', 'https://qu.ax/TxtQ.webp']
try {
await conn.sendFile(chatId, stickerUrls.getRandom(), 'desactivado.webp', '', m, true, { contextInfo: { forwardingScore: 200, isForwarded: false, externalAdReply: { showAdAttribution: false, title: modohorny ? `ᴱˢᵗᵉ ᶜᵒᵐᵃⁿᵈᵒ ˢᵒˡᵒ ᶠᵘⁿᶜᶦᵒⁿᵃ ᵉⁿ ʰᵒʳᵃʳᶦᵒ ʰᵃᵇᶦˡᶦᵗᵃᵈᵒ:` : `ᴸᵒˢ ᶜᵒᵐᵃⁿᵈᵒ ˢ ʰᵒʳⁿʸ ᵉˢᵗᵃⁿ ᵈᵉˢᵃᶜᵗᶦᵛᵃᵈᵒˢ:`, body: modohorny ? `${ini} a ${fin}` : '#enable modohorny', mediaType: 2, sourceUrl: info.md, thumbnail: m.pp }}}, { quoted: m, ephemeralExpiration: 24 * 60 * 100, disappearingMessagesInChat: 24 * 60 * 100 })
} catch (e) {
await conn.sendMessage(chatId, { text: modohorny ? `🔞 NSFW fuera del horario permitido (${ini} a ${fin})` : '🔞 El NSFW está desactivado por un admin.\nUsa *#enable modohorny* para activarlo.', contextInfo: { externalAdReply: { title: 'NSFW Desactivado', body: modohorny ? `Horario permitido: ${ini} a ${fin}` : '#enable modohorny', mediaType: 2, thumbnail: m.pp, sourceUrl: info.md }}}, { quoted: m })
}
continue
}}

//User banear
try {
let rawSender = m.sender || m.key?.participant || "";
let senderId;

if (rawSender.endsWith("@lid") && m.key?.participantAlt && m.key.participantAlt.endsWith("@s.whatsapp.net")) {
senderId = m.key.participantAlt;
} else {
senderId = rawSender;
}

senderId = senderId.replace(/:\d+/, "");
const botId = (conn.user?.id || "").replace(/:\d+/, "");
if (senderId !== botId) {
const resBan = await db.query("SELECT banned, razon_ban, avisos_ban FROM usuarios WHERE id = $1", [senderId]);
if (resBan.rows[0]?.banned) {
const avisos = resBan.rows[0]?.avisos_ban || 0;
if (avisos < 3) {
const nuevoAviso = avisos + 1;
await db.query("UPDATE usuarios SET avisos_ban = $2 WHERE id = $1", [senderId, nuevoAviso]);
const razon = resBan.rows[0]?.razon_ban?.trim() || "Spam";
await conn.sendMessage(m.chat, { text: `⚠️ ESTAS BANEADO ⚠️\n*• Motivo:* ${razon} (avisos: ${nuevoAviso}/3)\n*👉🏻 Puedes contactar al propietario del Bot si crees que se trata de un error o para charlar sobre tu desbaneo*\n\n👉 ${info.fb}`, contextInfo: { mentionedJid: [senderId] }}, { quoted: m });
}
return;
}}
} catch (e) {
console.error("❌ Error al verificar baneo:", e);
}

if (plugin.admin || plugin.botAdmin) {
try {
//isAdmin = adminIds.includes(m.sender);
isAdmin = m.isAdmin
const botLid = (conn.user?.lid || "").replace(/:\d+/, "");
const botJidClean = (conn.user?.id || "").replace(/:\d+/, "");
isBotAdmin = adminIds.includes(botLid) || adminIds.includes(botJidClean);
console.log(isAdmin)
} catch (e) {
console.error(e);
}}

if (plugin.owner && !isOwner) return m.reply("⚠️ Tu que? no eres mi propietario para venir a dame orden 🙄, solo el dueño del sub-bot o el owner puede usar este comando.");
if (plugin.rowner && !isROwner) return m.reply("⚠️ Tu que? no eres mi propietario para venir a dame orden 🙄.");
if (plugin.admin && !isAdmin) return m.reply("🤨 No eres admins. Solo los admins pueden usar este comando.");
if (plugin.botAdmin && !isBotAdmin) return m.reply(`⚠️ haz admin al Bot "YO" para poder usar este comando.`);
if (plugin.group && !isGroup) return m.reply("⚠️ Estos es un grupo?, este comando solo funciona el grupo");
if (plugin.private && isGroup) return m.reply("⚠️ Este comando solo funciona el pv");
if (plugin.register) {
try {
const result = await db.query('SELECT * FROM usuarios WHERE id = $1', [m.sender]);
const user = result.rows[0];
if (!user || user.registered !== true) return m.reply("「NO ESTAS REGISTRADO」\n\nPA NO APARECES EN MI BASE DE DATOS ✋🥸🤚\n\nPara poder usarme escribe el siguente comando\n\nComando: #reg nombre.edad\nEjemplo: #reg elrebelde.21");
} catch (e) {
console.error(e);
}}

if (plugin.limit) {
const res = await db.query('SELECT limite FROM usuarios WHERE id = $1', [m.sender]);
const limite = res.rows[0]?.limite ?? 0;

if (limite < plugin.limit) {
await m.reply("*⚠ 𝐒𝐮𝐬 𝐝𝐢𝐚𝐦𝐚𝐧𝐭𝐞 💎 𝐬𝐞 𝐡𝐚𝐧 𝐚𝐠𝐨𝐭𝐚𝐝𝐨 𝐩𝐮𝐞𝐝𝐞 𝐜𝐨𝐦𝐩𝐫𝐚𝐫 𝐦𝐚𝐬 𝐮𝐬𝐚𝐧𝐝𝐨 𝐞𝐥 𝐜𝐨𝐦𝐚𝐧𝐝𝐨:* #buy.");
return;
}

await db.query('UPDATE usuarios SET limite = limite - $1 WHERE id = $2', [plugin.limit, m.sender]);
await m.reply(`*${plugin.limit} diamante 💎 usado${plugin.limit > 1 ? 's' : ''}.*`);
}

if (plugin.money) {
try {
const res = await db.query('SELECT money FROM usuarios WHERE id = $1', [m.sender])
const money = res.rows[0]?.money ?? 0

if (money < plugin.money) {
return m.reply("*NO TIENE SUFICIENTES LOLICOINS 🪙*")
}

await db.query('UPDATE usuarios SET money = money - $1 WHERE id = $2', [plugin.money, m.sender])
await m.reply(`*${plugin.money} LoliCoins usado${plugin.money > 1 ? 's' : ''} 🪙*`)
} catch (err) {
console.error(err)
}}

if (plugin.level) {
try {
const result = await db.query('SELECT level FROM usuarios WHERE id = $1', [m.sender]);
const nivel = result.rows[0]?.level ?? 0;

if (nivel < plugin.level) {
return m.reply(`*⚠️ 𝐍𝐞𝐜𝐞𝐬𝐢𝐭𝐚 𝐞𝐥 𝐧𝐢𝐯𝐞𝐥 ${plugin.level}, 𝐩𝐚𝐫𝐚 𝐩𝐨𝐝𝐞𝐫 𝐮𝐬𝐚𝐫 𝐞𝐬𝐭𝐞 𝐜𝐨𝐦𝐚𝐧𝐝𝐨, 𝐓𝐮 𝐧𝐢𝐯𝐞𝐥 𝐚𝐜𝐭𝐮𝐚𝐥 𝐞𝐬:* ${nivel}`);
}} catch (err) {
console.error(err);
}}

if (modoAdminActivo && !isAdmin && !isOwner) {
return !0
//m.reply("⚠️ Este grupo tiene *modo admin* activado. Solo los administradores pueden usar comandos.");
}

try {
logCommand({conn,
sender: m.sender,
chatId: m.chat,
isGroup: m.isGroup,
command: command,
timestamp: new Date()
});

try {
await plugin(m, { conn, text, args, usedPrefix, command, participants, metadata, isOwner, isROwner, isAdmin: m.isAdmin, isBotAdmin, isGroup });
} catch (e) {
if (typeof e === 'string') {
await m.reply(e);
return; 
}
console.error(e);
return; 
}

await db.query(`INSERT INTO stats (command, count)
    VALUES ($1, 1)
    ON CONFLICT (command) DO UPDATE SET count = stats.count + 1
  `, [command]);

} catch (err) {
console.error(chalk.red(`❌ Error al ejecutar ${handler.command}: ${err}`));
m.reply("❌ Error ejecutando el comando, reporte este error a mi creador con el comando: /report\n\n" + err);
}}
}

//auto-leave
setInterval(async () => {
try {
let conn = global.conn || globalThis.conn;
if (!conn || typeof conn.groupLeave !== 'function') return;
const { rows } = await db.query("SELECT group_id, expired FROM group_settings WHERE expired IS NOT NULL AND expired > 0 AND expired < $1", [Date.now()]);

for (let { group_id } of rows) {
try {
await conn.sendMessage(group_id, { text: [`*${conn.user.name}*,ᴹᵉ ᵛᵒʸ ᵈᵉˡ ᵉˡ ᵍʳᵘᵖᵒ ᶠᵘᵉ ᵘⁿ ᵍᵘˢᵗᵒ ᵉˢᵗᵃ ᵃᵠᵘᶦ́ ˢᶦ ᵠᵘᶦᵉʳᵉˢ ᵠᵘᵉ ᵛᵘᵉˡᵛᵃ ᵁˢᵉʳ ᵈᵉ ⁿᵘᵉᵛᵒ ᵉˡ ᶜᵒᵐᵃⁿᵈᵒ`, `Bueno me voy de este grupo de mrd, no me agregue a grupo ptm`, `*${conn.user.name}*, me voy de este grupito culiado nada interesante yo queria ver teta y son puro gays aca 🤣`].getRandom() });
await new Promise(r => setTimeout(r, 3000));
await conn.groupLeave(group_id);
await db.query("UPDATE group_settings SET expired = NULL WHERE group_id = $1", [group_id]);
console.log(`[AUTO-LEAVE] Bot salió automáticamente del grupo: ${group_id}`);
} catch (e) {
}}
} catch (e) {
}}, 60_000); //1 min

//report
setInterval(async () => {
const MODGROUP_ID = "120363392819528942@g.us";
try {
let conn = global.conn || globalThis.conn;
if (!conn || typeof conn.sendMessage !== "function") return;
let modsMeta;
try {
modsMeta = await conn.groupMetadata(MODGROUP_ID);
} catch (e) {
return;
}
const res = await db.query("SELECT * FROM reportes WHERE enviado = false ORDER BY fecha ASC LIMIT 10");
if (!res.rows.length) return;

for (const row of res.rows) {
let cabecera = row.tipo === "sugerencia" ? "🌟 *SUGERENCIA*" : "ＲＥＰＯＲＴＥ";
const txt = `┏╼╾╼⧼⧼⧼ ${cabecera}  ⧽⧽⧽╼╼╼┓\n╏• *Usuario:* wa.me/${row.sender_id.split("@")[0]}\n╏• ${row.tipo === "sugerencia" ? "*Sugerencia:*" : "*Mensaje:*"} ${row.mensaje}\n┗╼╼╼╼╼╼╼╼╼╼╼╼╼╼╼╼╼╼╼╼╼`;
await conn.sendMessage(MODGROUP_ID, { text: txt });
await db.query("DELETE FROM reportes WHERE id = $1", [row.id]);
}} catch (err) {
console.error("[REPORT/SUGGE SYSTEM ERROR]", err);
}}, 60_000 * 2); // cada 2 minutos

//cache message 
setInterval(async () => {
try {
const { rows } = await db.query(`SELECT chat_memory.chat_id, chat_memory.updated_at, 
             COALESCE(group_settings.memory_ttl, 86400) AS memory_ttl
      FROM chat_memory
      JOIN group_settings ON chat_memory.chat_id = group_settings.group_id
      WHERE group_settings.memory_ttl > 0
    `);

const now = Date.now();
for (const row of rows) {
const { chat_id, updated_at, memory_ttl } = row;
const lastUpdated = new Date(updated_at).getTime(); // en ms
const ttl = memory_ttl * 1000; 

if (now - lastUpdated > ttl) {
await db.query("DELETE FROM chat_memory WHERE chat_id = $1", [chat_id]);
console.log(`🧹 Memoria del grupo ${chat_id} eliminada automáticamente`);
}}
} catch (err) {
console.error("❌ Error limpiando memorias expiradas:", err);
}}, 300_000); // cada 5 minutos

//---
let file = fileURLToPath(import.meta.url);
watchFile(file, () => {
  unwatchFile(file);
  console.log(chalk.redBright('Update \'handler.js\''));
  import(`${file}?update=${Date.now()}`);
});