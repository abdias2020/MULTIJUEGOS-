let handler = async (m, { conn, command }) => {

  const advertencia = `*🚫 ESTA FUNCIÓN ESTÁ TOTALMENTE PROHIBIDA 🚫*\n\n` +
`El uso de comandos para generar sub bots como:\n\n` +
`→ *code*\n` +
`→ *jadibot*\n` +
`→ *serbot*\n` +
`→ *qr*\n\n` +
`*HA SIDO BLOQUEADO POR SEGURIDAD YA QUE COMPROMETE NUESTRO SERVIDOR.*\n\n` +
`📌 Si deseas tu propio bot totalmente funcional y sin límites:\n` +
`🌐 *Compra tu BOT VIP en:* https://naufrabot.com/\n\n` +
`❗ *No solicites códigos de vinculación ni sub bots, ya no están permitidos.*`;

  await conn.reply(m.chat, advertencia, m);
};

handler.help = ['code', 'jadibot', 'serbot', 'qr'];
handler.tags = ['jadibot'];
handler.command = /^(code|jadibot|serbot|qr)$/i;
handler.register = false;

export default handler;