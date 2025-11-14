// 🎧 Comando /play — LoliBot-MD (integrado con ULTRAPLUS API)
import axios from "axios";

const userRequests = {};
const API_KEY = "RrSyVm056GfAhjuM";
const API_BASE = "https://api-nv.ultraplus.click/api";

// ========================== FUNCIÓN PRINCIPAL ==========================

const handler = async (m, { conn, command, text, usedPrefix }) => {
  if (!text?.trim()) {
    return m.reply(
      `🎧 *¿Qué deseas buscar?*\n\n` +
        `💡 Ejemplos:\n` +
        `• ${usedPrefix + command} Bad Bunny - Tití Me Preguntó\n` +
        `• ${usedPrefix + command} https://youtu.be/Cr8K88UcO0s\n\n` +
        `_Ingresa el nombre de la canción o un enlace de YouTube_`
    );
  }

  if (userRequests[m.sender]) {
    return conn.reply(
      m.chat,
      `⏳ *Espera un momento* @${m.sender.split("@")[0]}\nYa tienes una descarga en curso.`,
      m,
      { mentions: [m.sender] }
    );
  }

  userRequests[m.sender] = true;

  try {
    const query = text.trim();
    let video;

    // 🎯 Detectar si es enlace o texto
    const isLink = query.startsWith("http");
    if (isLink) {
      const infoUrl = `${API_BASE}/youtube/info?url=${encodeURIComponent(query)}&key=${API_KEY}`;
      const { data } = await axios.get(infoUrl);
      if (!data.status || !data.Result) throw new Error("No se pudo obtener información del video.");

      video = data.Result;
    } else {
      const searchUrl = `${API_BASE}/youtube/search?q=${encodeURIComponent(query)}&key=${API_KEY}`;
      const { data } = await axios.get(searchUrl);
      if (!data.status || !data.Result?.length) throw new Error("No se encontraron resultados.");

      video = data.Result[0]; // 🔹 Primer resultado
    }

    // 🧾 Mostrar información del video
    await conn.sendMessage(
      m.chat,
      {
        text:
          `🎵 *${video.titulo}*\n` +
          `📺 Canal: ${video.canal}\n` +
          `⏱️ Duración: ${video.duracion}\n` +
          `👁️ Vistas: ${video.vistas.toLocaleString("es-ES")}\n` +
          `📅 Publicado: ${video.fecha}\n\n` +
          `🎚️ *Elige el formato de descarga:*`,
        contextInfo: {
          externalAdReply: {
            title: video.titulo,
            body: video.canal,
            thumbnailUrl: video.miniatura,
            sourceUrl: video.url,
            mediaType: 1,
            renderLargerThumbnail: true
          }
        }
      },
      { quoted: m }
    );

    // 🎛️ Botones de descarga
    const buttons = [
      { buttonId: `${usedPrefix}playaudio ${video.url}`, buttonText: { displayText: "🎧 Audio (MP3)" }, type: 1 },
      { buttonId: `${usedPrefix}playvideo ${video.url}`, buttonText: { displayText: "🎥 Video (720p)" }, type: 1 }
    ];

    await conn.sendMessage(
      m.chat,
      {
        text: "¿Qué formato deseas descargar?",
        footer: "🎶 ULTRAPLUS Downloader",
        buttons,
        headerType: 1
      },
      { quoted: m }
    );
  } catch (err) {
    console.error("❌ Error crítico:", err.message);
    await m.reply(`🚫 *Error:* ${err.message}`);
    m.react("❌");
  } finally {
    delete userRequests[m.sender];
  }
};

// ========================== DESCARGA DE AUDIO ==========================

const handlerAudio = async (m, { conn, text }) => {
  try {
    await m.reply("🎧 *Descargando audio (MP3)...*");

    const dlUrl = `${API_BASE}/dl/yt-direct?url=${encodeURIComponent(text)}&type=audio&key=${API_KEY}`;
    const { data } = await axios.get(dlUrl);

    if (!data.status || !data.result?.link) throw new Error("No se pudo generar el enlace de audio.");

    await conn.sendMessage(
      m.chat,
      {
        audio: { url: data.result.link },
        mimetype: "audio/mpeg",
        fileName: `${sanitizeFilename(data.result.title || "audio")}.mp3`
      },
      { quoted: m }
    );

    m.react("✅");
  } catch (err) {
    await m.reply(`❌ Error al descargar audio: ${err.message}`);
    m.react("❌");
  }
};

// ========================== DESCARGA DE VIDEO ==========================

const handlerVideo = async (m, { conn, text }) => {
  try {
    await m.reply("🎥 *Descargando video (MP4 720p)...*");

    const dlUrl = `${API_BASE}/dl/yt-direct?url=${encodeURIComponent(text)}&type=video&key=${API_KEY}`;
    const { data } = await axios.get(dlUrl);

    if (!data.status || !data.result?.link) throw new Error("No se pudo generar el enlace de video.");

    await conn.sendMessage(
      m.chat,
      {
        video: { url: data.result.link },
        mimetype: "video/mp4",
        fileName: `${sanitizeFilename(data.result.title || "video")}.mp4`
      },
      { quoted: m }
    );

    m.react("✅");
  } catch (err) {
    await m.reply(`❌ Error al descargar video: ${err.message}`);
    m.react("❌");
  }
};

// ========================== UTILIDADES ==========================

function sanitizeFilename(name) {
  return name.replace(/[\/\\?%*:|"<>]/g, "-").substring(0, 180);
}

// ========================== REGISTRO ==========================

handler.command = ["play"];
handler.help = ["play <canción>"];
handler.tags = ["downloader"];

handlerAudio.command = ["playaudio"];
handlerVideo.command = ["playvideo"];

export default [handler, handlerAudio, handlerVideo];