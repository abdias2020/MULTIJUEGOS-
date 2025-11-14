const ro = 3000; // 💰 Máximo de XP que se puede robar

const handler = async (m, { conn, usedPrefix, command }) => {
  const now = Date.now();

  // 🧾 Obtener datos del ladrón
  const resRobber = await m.db.query('SELECT exp, lastrob FROM usuarios WHERE id = $1', [m.sender]);
  const robber = resRobber.rows[0] || { exp: 0, lastrob: 0 };

  // ⏱️ 10 minutos de cooldown
  const cooldown = 10 * 60 * 1000; // 600,000 ms = 10 min

  // 🔍 Ajuste automático si lastrob está guardado en segundos
  const lastRobMs = (robber.lastrob ?? 0) < 9999999999 ? (robber.lastrob ?? 0) * 1000 : (robber.lastrob ?? 0);
  const timeLeft = lastRobMs + cooldown - now;

  // 🚨 Si aún está en cooldown
  if (timeLeft > 0) 
    return m.reply(`🚓 La policía está vigilando, vuelve en: *${msToTime(timeLeft)}*`);

  // 🧍‍♂️ Determinar víctima
  let who;
  if (m.isGroup) {
    who = m.mentionedJid[0] ? m.mentionedJid[0] : m.quoted?.sender;
  } else {
    who = m.chat;
  }

  if (!who) return conn.reply(m.chat, `⚠️ *Etiqueta a un usuario para robarle XP*`, m);
  if (who === m.sender) return m.reply(`❌ No puedes robarte a ti mismo.`);

  // 🎯 Obtener datos de la víctima
  const resVictim = await m.db.query('SELECT exp FROM usuarios WHERE id = $1', [who]);
  const victim = resVictim.rows[0];
  if (!victim) return m.reply(`❌ El usuario no se encuentra en mi base de datos.`);

  // 💸 Calcular cantidad a robar
  const cantidad = Math.floor(Math.random() * ro);

  // 👎 Si la víctima no tiene suficiente XP
  if ((victim.exp ?? 0) < cantidad) 
    return conn.reply(m.chat, `@${who.split('@')[0]} tiene menos de ${ro} XP.\n> No robes a un pobre v:`, m, { mentions: [who] });

  // ✅ Actualizar datos
  await m.db.query('UPDATE usuarios SET exp = exp + $1, lastrob = $2 WHERE id = $3', [cantidad, now, m.sender]);
  await m.db.query('UPDATE usuarios SET exp = exp - $1 WHERE id = $2', [cantidad, who]);

  // 🎉 Mensaje final
  return conn.reply(m.chat, `💰 *Robaste ${cantidad} XP a @${who.split('@')[0]}*\n> Escapa antes de que te atrapen 😏`, m, { mentions: [who] });
};

// 🪪 Información del comando
handler.help = ['robar', 'rob'];
handler.tags = ['econ'];
handler.command = /^(robar|rob)$/i;
handler.register = true;

export default handler;

// 🕒 Convertir ms a formato legible
function msToTime(duration) {
  const seconds = Math.floor((duration / 1000) % 60);
  const minutes = Math.floor((duration / (1000 * 60)) % 60);
  const hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

  const hDisplay = hours > 0 ? `${hours} Hora(s) ` : '';
  const mDisplay = minutes > 0 ? `${minutes} Minuto(s) ` : '';
  const sDisplay = seconds > 0 ? `${seconds} Segundo(s)` : '';
  return hDisplay + mDisplay + sDisplay || '0 segundos';
}