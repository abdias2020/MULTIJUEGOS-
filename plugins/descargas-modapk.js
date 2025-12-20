import axios from 'axios';
import { search, download } from 'aptoide-scraper';

const userMessages = new Map();
const userRequests = {};

const handler = async (m, { conn, usedPrefix, command, text }) => {
  const apkpureApi = 'https://apkpure.com/api/v2/search?q=';
  const apkpureDownloadApi = 'https://apkpure.com/api/v2/download?id=';

  if (!text) return m.reply(`⚠️ *𝙀𝙨𝙘𝙧𝙞𝙗𝙖 𝙚𝙡 𝙣𝙤𝙢𝙗𝙧𝙚 𝙙𝙚𝙡 𝘼𝙋𝙆*\n\n*Ejemplo:*\n${usedPrefix + command} WhatsApp`);

  if (userRequests[m.sender]) {
    return await conn.reply(
      m.chat,
      `⚠️ Hey @${m.sender.split('@')[0]} pendejo, ya estás descargando un APK 🙄\nEspera a que termine tu descarga actual antes de pedir otra. 👆`,
      userMessages.get(m.sender) || m
    );
  }

  userRequests[m.sender] = true;
  m.react("⌛");

  try {
    const downloadAttempts = [
      // API 1: Dorratz
      async () => {
        const res = await fetch(`https://api.dorratz.com/v2/apk-dl?text=${encodeURIComponent(text)}`);
        const data = await res.json();
        if (!data.name) throw new Error('No data from dorratz API');
        return {
          name: data.name,
          package: data.package,
          developer: null,
          lastUpdate: data.lastUpdate,
          publish: null,
          size: data.size,
          icon: data.icon,
          dllink: data.dllink
        };
      },
      // API 2: Custom API (info.apis)
      async () => {
        const res = await fetch(`${info.apis}/download/apk?query=${encodeURIComponent(text)}`);
        const data = await res.json();
        if (!data.status || !data.data) throw new Error('Error en custom API');
        const apkData = data.data;
        return {
          name: apkData.name,
          package: null,
          developer: apkData.developer,
          lastUpdate: null,
          publish: apkData.publish,
          size: apkData.size,
          icon: apkData.image,
          dllink: apkData.download
        };
      },
      // API 3: Aptoide Scraper
      async () => {
        const searchA = await search(text);
        if (!searchA || searchA.length === 0) throw new Error('No results from Aptoide');
        const data5 = await download(searchA[0].id);
        return {
          name: data5.name,
          package: data5.package,
          developer: null,
          lastUpdate: data5.lastup,
          publish: null,
          size: data5.size,
          icon: data5.icon,
          dllink: data5.dllink
        };
      },
      // API 4: APKPure
      async () => {
        const searchResponse = await axios.get(`${apkpureApi}${encodeURIComponent(text)}`);
        const searchResults = searchResponse.data.results;
        if (!searchResults || searchResults.length === 0) throw new Error('No results from APKPure');
        
        const downloadResponse = await axios.get(`${apkpureDownloadApi}${searchResults[0].id}`);
        const apkData = downloadResponse.data;
        return {
          name: apkData.name,
          package: apkData.package,
          developer: null,
          lastUpdate: apkData.lastup,
          publish: null,
          size: apkData.size,
          icon: apkData.icon,
          dllink: apkData.dllink
        };
      }
    ];

    let apkData = null;
    for (const attempt of downloadAttempts) {
      try {
        apkData = await attempt();
        if (apkData && apkData.dllink) break;
      } catch (err) {
        console.error(`Error in attempt: ${err.message}`);
        continue;
      }
    }

    if (!apkData || !apkData.dllink) throw new Error('No se pudo descargar el APK desde ninguna API');

    // Construir respuesta con información disponible
    const response = `≪ＤＥＳＣＡＲＧＡＤＯ ＡＰＫＳ🚀≫

┏━━━━━━━━━━━━━━━━━━━━━━• 
┃💫 𝙉𝙊𝙈𝘽𝙍𝙀: ${apkData.name}
${apkData.developer ? `┃👤 𝘿𝙀𝙎𝘼𝙍𝙍𝙊𝙇𝙇𝙊: ${apkData.developer}` : apkData.package ? `┃📦 𝙋𝘼𝘾𝙆𝘼𝙂𝙀: ${apkData.package}` : ''}
┃🕒 𝙐𝙇𝙏𝙄𝙈𝘼 𝘼𝘾𝙏𝙐𝘼𝙇𝙄𝙕𝘼𝘾𝙄𝙊𝙉: ${apkData.publish || apkData.lastUpdate || 'Desconocida'}
┃💪 𝙋𝙀𝙎𝙊: ${apkData.size}
┗━━━━━━━━━━━━━━━━━━━━━━━•

> *⏳ ᴱˢᵖᵉʳᵉ ᵘⁿ ᵐᵒᵐᵉⁿᵗᵒ ˢᵘˢ ᵃᵖᵏ ˢᵉ ᵉˢᵗᵃ ᵉⁿᵛᶦᵃⁿᵈᵒ...*`;

    const responseMessage = await conn.sendFile(m.chat, apkData.icon, 'apk.jpg', response, m);
    userMessages.set(m.sender, responseMessage);

    // Verificar tamaño del APK
    const apkSize = apkData.size.toLowerCase();
    const sizeInMB = parseFloat(apkSize.replace(/[^0-9.]/g, ''));
    
    if (apkSize.includes('gb') || (apkSize.includes('mb') && sizeInMB > 999)) {
      await m.reply('*⚠️ 𝙀𝙡 𝙖𝙥𝙠 𝙚𝙨 𝙢𝙪𝙮 𝙥𝙚𝙨𝙖𝙙𝙤.*\n\n_No se puede enviar por WhatsApp debido a su tamaño._');
      m.react("❌");
      return;
    }

    // Enviar APK como documento
    await conn.sendMessage(
      m.chat,
      {
        document: { url: apkData.dllink },
        mimetype: 'application/vnd.android.package-archive',
        fileName: `${apkData.name}.apk`,
        caption: null
      },
      { quoted: m }
    );
    
    m.react("✅");
  } catch (e) {
    m.react('❌');
    await conn.reply(
      m.chat,
      `*⚠️ OCURRIÓ UN ERROR*\n\n_No se pudo descargar el APK._\n\n*Error:* ${e.message}\n\n_Intenta con otro nombre o verifica la ortografía._`,
      m
    );
    console.error('Error en comando APK:', e);
    handler.limit = false;
  } finally {
    delete userRequests[m.sender];
  }
};

handler.help = ['apk', 'apkmod', 'aptoide', 'apkpure'];
handler.tags = ['downloader'];
handler.command = /^(apkmod|apk|modapk|dapk2|aptoide|aptoidedl|apkp|apkpure|apkdl)$/i;
handler.register = true;
handler.limit = 2;

export default handler;

// Funciones auxiliares (ya no son necesarias en el código principal pero las mantengo por compatibilidad)
async function searchApk(text, apkpureApi) {
  const response = await axios.get(`${apkpureApi}${encodeURIComponent(text)}`);
  const data = response.data;
  return data.results;
}

async function downloadApk(id, apkpureDownloadApi) {
  const response = await axios.get(`${apkpureDownloadApi}${id}`);
  const data = response.data;
  return data;
}