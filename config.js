import fs from 'fs'
import chalk from 'chalk'
import { watchFile, unwatchFile } from 'fs'
import { fileURLToPath } from 'url'

/* ======================== OWNER ======================== */
global.owner = [
  ['51981557640'],
  ['51970454739']
]

/* ======================== INFO BOT ======================== */
globalThis.info = {
  // Básico
  wm: 'MULTIJUEGOS',
  vs: '2.0.0 (beta)',

  // Stickers
  packname: '𝗦𝗧𝗜𝗖𝗞𝗘𝗥𝗦 ❤️‍🔥 - MULTIJUEGOS',
  author: 'Owner: @multijuego\n• Dueño: @abdiasmoreno',

  // APIs principales
  apis: 'https://api.delirius.store',
  apikey: 'GataDios',

  // APIs externas
  fgmods: {
    url: 'https://api.fgmods.xyz/api',
    key: 'elrebelde21'
  },
  neoxr: {
    url: 'https://api.neoxr.eu/api',
    key: 'russellxz'
  },

  // Imágenes
  imgMenuUrl: 'https://i.postimg.cc/pXpyMxwL/Menu2.jpg',
  imgMenuLocal: fs.existsSync('./media/Menu2.jpg')
    ? fs.readFileSync('./media/Menu2.jpg')
    : null
}

/* ======================== HOT RELOAD ======================== */
const file = fileURLToPath(import.meta.url)

watchFile(file, () => {
  unwatchFile(file)
  console.log(chalk.redBright("🔄 config.js actualizado"))
  import(`${file}?update=${Date.now()}`)
})