import moment from 'moment-timezone'
import { xpRange } from '../lib/levelling.js'
import { db } from '../lib/postgres.js'
import fs from "fs";

const tags = {
  main: 'ℹ️ INFOBOT',
  jadibot: '✨ SER SUB BOT',
  downloader: '🚀 DESCARGAS',
  game: '👾 JUEGOS',
  gacha: '✨️ NEW - RPG GACHA',
  rg: '🟢 REGISTRO',
  group: '⚙️ GRUPO',
  nable: '🕹 ENABLE/DISABLE',
 
  buscadores: '🔍 BUSCADORES',
  sticker: '🧧 STICKER',
  econ: '🛠 RPG',
  convertidor: '🎈 CONVERTIDORES',
  logo: '🎀 LOGOS',
  tools: '🔧 HERRAMIENTA',
  randow: '🪄 RANDOW',
  efec: '🎙 EFECTO NOTA DE VOZ',
  owner: '👑 OWNER'
}

// Lista de zonas horarias y banderas para mostrar hora de cada país
const timezones = [
  { zone: 'America/Argentina/Buenos_Aires', flag: '🇦🇷', name: 'Argentina' },
  { zone: 'America/Mexico_City', flag: '🇲🇽', name: 'México' },
  { zone: 'Europe/Spain', flag: '🇪🇸', name: 'España' },
  { zone: 'America/Los_Angeles', flag: '🇺🇸', name: 'EE. UU. (LA)' },
  { zone: 'Asia/Tokyo', flag: '🇯🇵', name: 'Japón' },
  { zone: 'Europe/France', flag: '🇫🇷', name: 'Francia' },
  { zone: 'Europe/Germany', flag: '🇩🇪', name: 'Alemania' },
  { zone: 'Asia/Kolkata', flag: '🇮🇳', name: 'India' },
  { zone: 'Asia/Shanghai', flag: '🇨🇳', name: 'China' }
];

const defaultMenu = {
  before: `「 %wm 」

Hola 👋🏻 *%name*

*• Fecha:* %fecha
*• Hora:* %hora
%timezones

*• Usuario:* %totalreg
*• Tiempo activos:* %muptime
*• Tu limite:* %limit
%botOfc

*• Usuario registrados:* %toUserReg de %toUsers

Unirte a nuestro canal de WhatsApp y enterarte de todas las novedades/actualizaciones del bot
%nna2

*Puede hablar con bot de esta forma ej:*
@%BoTag ¿Que es una api?
`.trimStart(),
  header: '`<[ %category ]>`',
  body: ' %cmd %islimit %isPremium',
  footer: `\n`,
  after: ''
}

const handler = async (m, { conn, usedPrefix: _p, args }) => {
  const chatId = m.key?.remoteJid;

  // Datos del usuario
  const name = m.pushName || 'sin name';
  const _uptime = process.uptime() * 1000;
  const muptime = clockString(_uptime);

  // Formato de fecha y hora
  const fecha = moment().format('DD/MM/YYYY');  // Fecha en formato dd/MM/yyyy
  const hora = moment().format('hh:mm:ss A');  // Hora en formato hh:mm:ss AM/PM

  let user;
  try {
    const userRes = await db.query(`SELECT * FROM usuarios WHERE id = $1`, [m.sender]);
    user = userRes.rows[0] || { limite: 0, level: 0, exp: 0, role: '-' };
  } catch (err) {
    user = { limite: 0, level: 0, exp: 0, role: '-' };
  }

  // Total de usuarios registrados
  let totalreg = 0;
  let rtotalreg = 0;
  try {
    const userCountRes = await db.query(`
      SELECT COUNT(*)::int AS total,
             COUNT(*) FILTER (WHERE registered = true)::int AS registrados
      FROM usuarios
    `);
    totalreg = userCountRes.rows[0].total;
    rtotalreg = userCountRes.rows[0].registrados;
  } catch (err) {}

  const toUsers = toNum(totalreg);
  const toUserReg = toNum(rtotalreg);

  const nombreBot = conn.user?.name || 'Bot';
  const isPrincipal = conn === global.conn;
  const tipo = isPrincipal ? 'Bot Oficial' : 'Sub Bot';
  let botOfc = '';
  let BoTag = "";
  if (conn.user?.id && global.conn?.user?.id) {
    const jidNum = conn.user.id.replace(/:\d+/, '').split('@')[0];
    botOfc = (conn.user.id === global.conn.user.id) ? `*• Bot Ofc:* wa.me/${jidNum}` : `*• Soy un sub bot del:* wa.me/${global.conn.user.id.replace(/:\d+/, '').split('@')[0]}`;
    BoTag = jidNum;
  }

  const multiplier = 750;
  const { min, xp, max } = xpRange(user.level || 0, multiplier);

  const help = Object.values(global.plugins).filter(p => !p.disabled).map(plugin => ({
    help: Array.isArray(plugin.help) ? plugin.help : [plugin.help],
    tags: Array.isArray(plugin.tags) ? plugin.tags : [plugin.tags],
    prefix: 'customPrefix' in plugin,
    limit: plugin.limit,
    premium: plugin.premium
  }));

  const categoryRequested = args[0]?.toLowerCase();
  const validTags = categoryRequested && tags[categoryRequested] ? [categoryRequested] : Object.keys(tags);

  // Construcción de texto de menú
  let text = defaultMenu.before;

  // Construir hora y bandera de cada país
  const timezonesText = timezones.map(tz => `*• ${tz.flag} ${tz.name}:* ${moment().tz(tz.zone).format('hh:mm:ss A')}`).join('\n');
  text = text.replace('%timezones', timezonesText);

  // Agregar fecha y hora en formato AM/PM
  text = text.replace('%fecha', fecha).replace('%hora', hora);

  for (const tag of validTags) {
    const comandos = help.filter(menu => menu.tags && menu.tags.includes(tag) && menu.help);
    if (!comandos.length) continue;

    text += '\n' + defaultMenu.header.replace(/%category/g, tags[tag]) + '\n';
    for (const plugin of comandos) {
      for (const helpCmd of plugin.help) {
        text += defaultMenu.body
          .replace(/%cmd/g, plugin.prefix ? helpCmd : _p + helpCmd)
          .replace(/%islimit/g, plugin.limit ? '(💎)' : '')
          .replace(/%isPremium/g, plugin.premium ? '(💵)' : '') + '\n';
      }
    }
    text += defaultMenu.footer;
  }
  text += defaultMenu.after;

  const replace = {
    '%': '%', p: _p, name,
    limit: user.limite || 0,
    level: user.level || 0,
    role: user.role || '-',
    totalreg, rtotalreg, toUsers, toUserReg,
    exp: (user.exp || 0) - min,
    maxexp: xp,
    totalexp: user.exp || 0,
    xp4levelup: max - (user.exp || 0),
    muptime,
    wm: info.wm,
    botOfc: botOfc,
    BoTag: BoTag,
    nna2: info.nna2
  };

  text = String(text).replace(new RegExp(`%(${Object.keys(replace).join('|')})`, 'g'), (_, key) => replace[key] ?? '');

  try {
    let pp = fs.readFileSync('./media/Menu2.jpg');
    await conn.sendMessage(chatId, {
      text: text,
      contextInfo: {
        forwardedNewsletterMessageInfo: { newsletterJid: "120363305025805187@newsletter", newsletterName: "LoliBot ✨️" },
        forwardingScore: 999,
        isForwarded: true,
        mentionedJid: await conn.parseMention(text),
        externalAdReply: {
          mediaUrl: [info.nna, info.nna2, info.md].getRandom(),
          mediaType: 2,
          showAdAttribution: false,
          renderLargerThumbnail: false,
          title: "✨️ MENU ✨️",
          body: `${nombreBot} (${tipo})`,
          thumbnailUrl: info.img2,
          sourceUrl: "https://chat.whatsapp.com/J1awHOq4FJx4GlvQMUKZhj?mode=wwc"
        }
      }
    }, { quoted: m });
  } catch (err) {
    console.error(err);
  }
}
handler.help = ['menu']
handler.tags = ['main']
handler.command = /^(menu|help|allmenu|menú)$/i
export default handler

// Funciones auxiliares
const clockString = ms => {
  const h = isNaN(ms) ? '--' : Math.floor(ms / 3600000)
  const m = isNaN(ms) ? '--' : Math.floor(ms / 60000) % 60
  const s = isNaN(ms) ? '--' : Math.floor(ms / 1000) % 60
  return [h, m, s].map(v => v.toString().padStart(2, 0)).join(':')
}

const toNum = n => (n >= 1_000_000) ? (n / 1_000_000).toFixed(1) + 'M'
  : (n >= 1_000) ? (n / 1_000).toFixed(1) + 'k'
  : n.toString()