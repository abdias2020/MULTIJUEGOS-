import { createHash } from 'crypto';
import moment from 'moment-timezone';
import fetch from 'node-fetch';
import { db } from '../lib/postgres.js';

const Reg = /\|?(.*)([.|] *?)([0-9]*)$/i;

// Utilidad para formatear números de teléfono
const formatPhoneNumber = (jid) => {
  if (!jid) return null;
  const number = jid.replace('@s.whatsapp.net', '');
  return /^\d{8,15}$/.test(number) ? `+${number}` : null;
};

// Utilidad para formatear números grandes
const toNum = (number) => {
  const abs = Math.abs(number);
  if (abs >= 1000000) return (number / 1000000).toFixed(1) + 'M';
  if (abs >= 1000) return (number / 1000).toFixed(1) + 'k';
  return number.toString();
};

// Estado temporal de registros en curso
const estados = {};

// Función para obtener nacionalidad del usuario
const getUserNationality = async (who) => {
  try {
    const phone = formatPhoneNumber(who);
    if (!phone) return null;
    
    const response = await fetch(`${info.apis}/tools/country?text=${phone}`);
    const data = await response.json();
    return data.result ? `${data.result.name} ${data.result.emoji}` : null;
  } catch (err) {
    console.error('❌ Error obteniendo nacionalidad:', err.message);
    return null;
  }
};

// Crear mensaje de contacto fake
const createFakeContact = (sender) => ({
  key: {
    participants: '0@s.whatsapp.net',
    remoteJid: 'status@broadcast',
    fromMe: false,
    id: 'Halo'
  },
  message: {
    contactMessage: {
      vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:y\nitem1.TEL;waid=${sender.split('@')[0]}:${sender.split('@')[0]}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
    }
  },
  participant: '0@s.whatsapp.net'
});

let handler = async (m, { conn, text, args, usedPrefix, command }) => {
  const fkontak = createFakeContact(m.sender);
  const who = m.mentionedJid?.[0] || (m.fromMe ? conn.user.jid : m.sender);
  const date = moment.tz('America/Bogota').format('DD/MM/YYYY');
  const time = moment.tz('America/Argentina/Buenos_Aires').format('LT');
  
  // Obtener datos del usuario
  const userResult = await db.query(`SELECT * FROM usuarios WHERE id = $1`, [who]);
  const user = userResult.rows[0] || { registered: false };
  const input = text.trim();
  const name2 = m.pushName || 'Usuario';

  // ======= COMANDO: reg / verify / verificar =======
  if (['reg', 'verify', 'verificar', 'register'].includes(command)) {
    if (user.registered) {
      return m.reply(`✅ *Ya estás registrado*\n\n📌 Nombre: ${user.nombre}\n📌 Edad: ${user.edad} años`);
    }

    if (estados[who]?.step) {
      return m.reply('⚠️ Ya tienes un registro en curso. Completa el paso anterior.');
    }

    if (!Reg.test(text)) {
      return m.reply(
        `*⚠️ Formato incorrecto*\n\n` +
        `📌 Uso correcto:\n` +
        `*${usedPrefix + command} nombre.edad*\n\n` +
        `💡 Ejemplo:\n` +
        `*${usedPrefix + command} ${name2}.18*`
      );
    }

    let [_, name, splitter, age] = text.match(Reg);
    
    if (!name) return m.reply('⚠️ *El nombre no puede estar vacío*');
    if (!age) return m.reply('⚠️ *La edad no puede estar vacía*');
    if (name.length >= 45) return m.reply('⚠️ *El nombre es demasiado largo (máx. 45 caracteres)*');
    
    age = parseInt(age);
    if (age > 100) return m.reply('👴🏻 *Edad demasiado alta (máx. 100 años)*');
    if (age < 5) return m.reply('🚼 *Edad demasiado baja (mín. 5 años)*');

    const userNationality = await getUserNationality(who);
    
    estados[who] = { 
      step: 1, 
      nombre: name, 
      edad: age, 
      usedPrefix, 
      userNationality 
    };

    console.log(`🔔 Registro iniciado por: ${who.split('@')[0]} | Nombre: ${name} | Edad: ${age}`);

    return m.reply(
      `👤 *Registro - Paso 2/3*\n\n` +
      `¿Cuál es tu género?\n\n` +
      `1️⃣ Hombre ♂️\n` +
      `2️⃣ Mujer ♀️\n` +
      `3️⃣ Otro 🧬\n\n` +
      `📝 Responde con el número correspondiente`
    );
  }

  // ======= COMANDO: nserie / myns / sn =======
  if (['nserie', 'myns', 'sn'].includes(command)) {
    if (!user.registered) {
      return m.reply(
        `⚠️ *No estás registrado*\n\n` +
        `Para registrarte usa:\n` +
        `*${usedPrefix}reg nombre.edad*`
      );
    }

    const sn = user.serial_number || createHash('md5').update(m.sender).digest('hex');
    await conn.fakeReply(
      m.chat, 
      sn, 
      '0@s.whatsapp.net', 
      `🔑 Este es tu número de serie`, 
      'status@broadcast'
    );
  }

  // ======= COMANDO: unreg =======
  if (command === 'unreg') {
    if (!user.registered) {
      return m.reply(
        `⚠️ *No estás registrado*\n\n` +
        `Para registrarte usa:\n` +
        `*${usedPrefix}reg nombre.edad*`
      );
    }

    if (!args[0]) {
      return m.reply(
        `⚠️ *Ingresa tu número de serie*\n\n` +
        `Verifica tu número de serie con:\n` +
        `*${usedPrefix}nserie*`
      );
    }

    const sn = user.serial_number || createHash('md5').update(m.sender).digest('hex');
    
    if (args[0] !== sn) {
      return m.reply('❌ *Número de serie incorrecto*');
    }

    await db.query(
      `UPDATE usuarios
       SET registered = false,
           nombre = NULL,
           edad = NULL,
           gender = NULL,
           birthday = NULL,
           money = GREATEST(money - 400, 0),
           limite = GREATEST(limite - 2, 0),
           exp = GREATEST(exp - 150, 0),
           reg_time = NULL,
           serial_number = NULL
       WHERE id = $1`,
      [m.sender]
    );

    console.log(`🗑️ Usuario eliminado: ${who.split('@')[0]} | Nombre: ${user.nombre}`);

    await conn.fakeReply(
      m.chat, 
      `✅ Registro eliminado exitosamente`, 
      '0@s.whatsapp.net', 
      `Registro eliminado`, 
      'status@broadcast'
    );
  }

  // ======= COMANDO: setgenero =======
  if (command === 'setgenero') {
    if (!user.registered) {
      return m.reply('⚠️ *Debes estar registrado para usar este comando*');
    }

    const genero = (args[0] || '').toLowerCase();
    
    if (!['hombre', 'mujer', 'otro'].includes(genero)) {
      return m.reply(
        `⚠️ *Género inválido*\n\n` +
        `Uso: *${usedPrefix}setgenero <hombre|mujer|otro>*\n\n` +
        `💡 Ejemplo: *${usedPrefix}setgenero hombre*`
      );
    }

    await db.query('UPDATE usuarios SET gender = $1 WHERE id = $2', [genero, who]);
    
    console.log(`🔄 Género actualizado: ${who.split('@')[0]} → ${genero}`);
    
    return m.reply(`✅ *Género actualizado:* ${genero}`);
  }

  // ======= COMANDO: setbirthday =======
  if (command === 'setbirthday') {
    if (!user.registered) {
      return m.reply('⚠️ *Debes estar registrado para usar este comando*');
    }

    const birthday = args.join(' ').trim();
    
    if (!birthday) {
      return m.reply(
        `⚠️ *Formato incorrecto*\n\n` +
        `Uso: *${usedPrefix}setbirthday <fecha>*\n\n` +
        `💡 Ejemplo: *${usedPrefix}setbirthday 30/10/2000*\n` +
        `📌 Para borrar: *${usedPrefix}setbirthday borrar*`
      );
    }

    if (birthday.toLowerCase() === 'borrar') {
      await db.query('UPDATE usuarios SET birthday = NULL WHERE id = $1', [who]);
      console.log(`🎂 Cumpleaños eliminado: ${who.split('@')[0]}`);
      return m.reply('✅ *Cumpleaños eliminado correctamente*');
    }

    try {
      const fecha = moment(birthday, ['DD/MM/YYYY', 'D [de] MMMM [de] YYYY'], true);
      
      if (!fecha.isValid()) {
        throw new Error('Formato inválido');
      }

      await db.query('UPDATE usuarios SET birthday = $1 WHERE id = $2', [fecha.format('YYYY-MM-DD'), who]);
      
      console.log(`🎂 Cumpleaños actualizado: ${who.split('@')[0]} → ${birthday}`);
      
      return m.reply(`✅ *Cumpleaños guardado:* ${birthday}`);
    } catch (err) {
      return m.reply(
        `❌ *Formato de fecha inválido*\n\n` +
        `💡 Ejemplo correcto: *25/07/2009*`
      );
    }
  }
};

// ======= SECCIÓN BEFORE (Manejo de pasos de registro) =======
handler.before = async (m, { conn, usedPrefix }) => {
  const fkontak = createFakeContact(m.sender);
  const who = m.sender;
  const step = estados[who]?.step;
  const input = (m.originalText || m.text || '').trim();

  if (!step || m.text.startsWith(usedPrefix)) return;

  // ======= PASO 2: Seleccionar género =======
  if (step === 1) {
    const lower = input.toLowerCase();
    let genero = null;

    if (['1', 'hombre'].includes(lower)) genero = 'hombre';
    else if (['2', 'mujer'].includes(lower)) genero = 'mujer';
    else if (['3', 'otro'].includes(lower)) genero = 'otro';

    if (!genero) {
      return m.reply('⚠️ Responde con *1*, *2*, *3* o escribe *hombre*, *mujer* u *otro*');
    }

    estados[who].genero = genero;
    estados[who].step = 2;

    return m.reply(
      `🎂 *Registro - Paso 3/3*\n\n` +
      `¿Cuál es tu fecha de cumpleaños?\n\n` +
      `📅 Formato: DD/MM/AAAA\n` +
      `💡 Ejemplo: 30/10/2000\n\n` +
      `⏭️ Escribe "omitir" para saltarlo`
    );
  }

  // ======= PASO 3: Fecha de cumpleaños =======
  if (step === 2) {
    let cumple = null;
    let cumpleTexto = null;

    if (input.toLowerCase() !== 'omitir') {
      try {
        const fecha = moment(input, ['DD/MM/YYYY', 'D [de] MMMM [de] YYYY'], true);
        
        if (!fecha.isValid()) {
          throw new Error('Formato inválido');
        }

        cumple = fecha.format('YYYY-MM-DD');
        cumpleTexto = input;
      } catch {
        return m.reply(
          `❌ *Formato de fecha inválido*\n\n` +
          `💡 Ejemplo correcto: *27/05/2009*\n` +
          `⏭️ O escribe "omitir" para saltarlo`
        );
      }
    }

    // Obtener datos del registro
    const { nombre, edad, genero, usedPrefix: pref, userNationality } = estados[who];
    const serial = createHash('md5').update(who).digest('hex');
    const reg_time = new Date();

    try {
      // Insertar o actualizar usuario
      await db.query(
        `INSERT INTO usuarios (id, nombre, edad, gender, birthday, money, limite, exp, reg_time, registered, serial_number)
         VALUES ($1, $2, $3, $4, $5, 400, 2, 150, $6, true, $7)
         ON CONFLICT (id) DO UPDATE
         SET nombre = $2, 
             edad = $3, 
             gender = $4, 
             birthday = $5,
             money = usuarios.money + 400,
             limite = usuarios.limite + 2,
             exp = usuarios.exp + 150,
             reg_time = $6,
             registered = true,
             serial_number = $7`,
        [who, nombre + ' ✓', edad, genero, cumple, reg_time, serial]
      );

      // Obtener total de usuarios registrados
      const totalRegResult = await db.query(`SELECT COUNT(*) AS total FROM usuarios WHERE registered = true`);
      const rtotalreg = parseInt(totalRegResult.rows[0].total);

      const date = moment.tz('America/Bogota').format('DD/MM/YYYY');
      const time = moment.tz('America/Argentina/Buenos_Aires').format('LT');

      // Log en consola
      console.log(`✅ Usuario registrado exitosamente:`);
      console.log(`   📱 ID: ${who.split('@')[0]}`);
      console.log(`   👤 Nombre: ${nombre}`);
      console.log(`   🎂 Edad: ${edad} años`);
      console.log(`   ⚧️ Género: ${genero}`);
      if (cumpleTexto) console.log(`   🎉 Cumpleaños: ${cumpleTexto}`);
      console.log(`   🔑 Serial: ${serial}`);
      console.log(`   📊 Total registrados: ${rtotalreg}`);

      // Limpiar estado
      delete estados[who];

      // Enviar mensaje de confirmación
      return await conn.sendMessage(
        m.chat,
        {
          text: 
            `✅ *REGISTRO COMPLETADO*\n\n` +
            `👤 *Nombre:* ${nombre}\n` +
            `🎂 *Edad:* ${edad} años\n` +
            `⚧️ *Género:* ${genero}\n` +
            (cumpleTexto ? `🎉 *Cumpleaños:* ${cumpleTexto}\n` : '') +
            `🕐 *Hora:* ${time}\n` +
            `📅 *Fecha:* ${date}\n` +
            (userNationality ? `🌎 *País:* ${userNationality}\n` : '') +
            `📱 *Número:* wa.me/${who.split('@')[0]}\n` +
            `🔑 *Número de serie:*\n${serial}\n\n` +
            `🎁 *Recompensas:*\n` +
            `   💎 2 Diamantes\n` +
            `   🪙 400 Coins\n` +
            `   ⭐ 150 EXP\n\n` +
            `📌 *Ver comandos:* ${pref}menu\n` +
            `📊 *Total usuarios:* ${toNum(rtotalreg)}`,
          contextInfo: {
            forwardedNewsletterMessageInfo: {
              newsletterJid: '120363305025805187@newsletter',
              serverMessageId: '',
              newsletterName: 'LoliBot ✨️'
            },
            forwardingScore: 9999999,
            isForwarded: true,
            externalAdReply: {
              mediaUrl: info.md,
              mediaType: 2,
              showAdAttribution: false,
              renderLargerThumbnail: false,
              title: '𝐑𝐄𝐆𝐈𝐒𝐓𝐑𝐎 𝐂𝐎𝐌𝐏𝐋𝐄𝐓𝐀𝐃𝐎',
              body: 'LoliBot',
              previewType: 'PHOTO',
              thumbnailUrl: 'https://i.postimg.cc/pXpyMxwL/Menu2.jpg',
              sourceUrl: info.md
            }
          }
        },
        { 
          quoted: fkontak, 
          ephemeralExpiration: 24 * 60 * 1000, 
          disappearingMessagesInChat: 24 * 60 * 1000 
        }
      );
    } catch (err) {
      console.error('❌ Error al completar registro:', err);
      delete estados[who];
      return m.reply('❌ *Error al completar el registro. Intenta nuevamente.*');
    }
  }
};

handler.help = ['reg <nombre.edad>', 'verificar <nombre.edad>', 'nserie', 'unreg <serial>', 'setgenero', 'setbirthday'];
handler.tags = ['rg'];
handler.command = /^(setbirthday|setgenero|nserie|unreg|sn|myns|verify|verificar|registrar|reg(ister)?)$/i;

export default handler;