import fetch from 'node-fetch'
const userRequests = {};

const handler = async (m, { conn, args, usedPrefix, command }) => {
if (!args[0]) return m.reply(`*⚠️ ¿Qué estás buscando? Ingresa el link de algún video de Threads!!*\n*• Ejemplo:*\n${usedPrefix + command} https://www.threads.net/@adri_leclerc_/post/C_dSNIOOlpy?xmt=AQGzxbmyveDB91QgFo_KQWzqL6PT2yCy2eg8BkhPTO-6Kw`)

if (userRequests[m.sender]) return await conn.reply(m.chat, `⏳ Hey @${m.sender.split('@')[0]} pendejo, ya hay una solicitud en proceso. Por favor, espera a que termine antes de hacer otra`, userRequests[m.sender].message || m)   
const { key } = await conn.sendMessage(m.chat, {text: `⌛ 𝙀𝙨𝙥𝙚𝙧𝙚 ✋\n▰▰▰▱▱▱▱▱▱`}, {quoted: m}); 
userRequests[m.sender] = { active: true, message: { key, chat: m.chat, fromMe: true } };
await delay(1000);
await conn.sendMessage(m.chat, {text: `⌛ 𝙀𝙨𝙥𝙚𝙧𝙚 ✋ \n▰▰▰▰▰▱▱▱▱`, edit: key});
await delay(1000);
await conn.sendMessage(m.chat, {text: `⌛ 𝙔𝙖 𝙘𝙖𝙨𝙞 🏃‍♂️💨\n▰▰▰▰▰▰▰▱▱`, edit: key});
m.react(`⌛`) 

try {
// Primera API (original)
const res = await fetch(`https://api.agatz.xyz/api/threads?url=${args[0]}`);
const data = await res.json()
const downloadUrl = data.data.image_urls[0] || data.data.video_urls[0];
const fileType = downloadUrl.includes('.webp') || downloadUrl.includes('.jpg') || downloadUrl.includes('.png') ? 'image' : 'video';
if (fileType === 'image') {
await conn.sendFile(m.chat, downloadUrl, 'threads_image.jpg', '_*Aquí tienes la imagen de Threads*_', m);
m.react('✅');
} else if (fileType === 'video') {
await conn.sendFile(m.chat, downloadUrl, 'threads_video.mp4', '_*Aquí tienes el video de Threads*_', m);
m.react('✅');
}
await conn.sendMessage(m.chat, {text: `✅ 𝘾𝙤𝙢𝙥𝙡𝙚𝙩𝙖𝙙𝙤\n▰▰▰▰▰▰▰▰▰`, edit: key})   
} catch {   
try {
// Segunda API (original)
const res2 = await fetch(`${info.apis}/download/threads?url=${args[0]}`);
const data2 = await res2.json();
if (data2.status === true && data2.data.length > 0) {
const downloadUrl = data2.data[0].url; 
const fileType = data2.data[0].type; 
if (fileType === 'image') {
await conn.sendFile(m.chat, downloadUrl, 'threads_image.jpg', '_*Aquí tienes la imagen de Threads*_', m);
m.react('✅');
} else if (fileType === 'video') {
await conn.sendFile(m.chat, downloadUrl, 'threads_video.mp4', '_*Aquí tienes el video de Threads*_', m);
m.react('✅');
}}
await conn.sendMessage(m.chat, {text: `✅ 𝘾𝙤𝙢𝙥𝙡𝙚𝙩𝙖𝙙𝙤\n▰▰▰▰▰▰▰▰▰`, edit: key})   
} catch {
try {
// Tercera API (nueva - del segundo código)
const apiUrl = `${apis}/download/threads?url=${encodeURIComponent(args[0])}`
const response = await fetch(apiUrl)
const jsonData = await response.json()
const threadTitle = jsonData.data.description
const threadMedia = jsonData.data.media[0]
const threadVideoUrl = threadMedia.url
const shortUrl1 = await (await fetch(`https://tinyurl.com/api-create.php?url=${args[0]}`)).text()
const threadTitleWithoutUrl = threadTitle
const txt1 = `🖤 ${threadTitleWithoutUrl}\n\n🔗 *URL:*\n• _${shortUrl1}_`.trim()

// Detectar tipo de archivo
const fileType = threadVideoUrl.includes('.jpg') || threadVideoUrl.includes('.png') || threadVideoUrl.includes('.webp') ? 'image' : 'video'

if (fileType === 'image') {
await conn.sendFile(m.chat, threadVideoUrl, 'threads_image.jpg', txt1, m)
m.react('✅')
} else {
await conn.sendFile(m.chat, threadVideoUrl, 'threads_video.mp4', txt1, m)
m.react('✅')
}
await conn.sendMessage(m.chat, {text: `✅ 𝘾𝙤𝙢𝙥𝙡𝙚𝙩𝙖𝙙𝙤\n▰▰▰▰▰▰▰▰▰`, edit: key})   
} catch (e) {
m.react(`❌`) 
await conn.sendMessage(m.chat, {text: `\`\`\`⚠️ OCURRIO UN ERROR ⚠️\`\`\`\n\n> *Reporta el siguiente error a mi creador con el comando:* #report\n\n>>> ${e} <<<<`, edit: key})   
console.log(e) 
}}} finally {
delete userRequests[m.sender];
}}

handler.help = ['thread']
handler.tags = ['downloader']
handler.command = /^(thread|threads|threaddl)$/i;
handler.register = true;
handler.limit = 1

export default handler

const delay = time => new Promise(res => setTimeout(res, time))