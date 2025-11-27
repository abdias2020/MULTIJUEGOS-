import { watchFile, unwatchFile } from 'fs'
import chalk from 'chalk'
import { fileURLToPath } from 'url'
import fs from 'fs'

//owner
global.owner = [
['51981557640'],
['51970454739'],
[''],
[''],
[''],
[''],
['']
]

//Información 
globalThis.info = {
wm: "MULTIJUEGOS",
vs: "2.0.0 (beta)",
packname: "𝗦𝗧𝗜𝗖𝗞𝗘𝗥𝗦❤️‍🔥 - MULTIJUEGOS\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n",
author: "Owner: @multijuego\n• Dueña: @abdiasmoreno",
apis: "https://api.delirius.store",
apikey: "GataDios",
fgmods: { url: 'https://api.fgmods.xyz/api', key: 'elrebelde21' },
neoxr: { url: 'https://api.neoxr.eu/api', key: 'russellxz' },
img2: "https://i.postimg.cc/pXpyMxwL/Menu2.jpg",
img4: fs.readFileSync('./media/Menu2.jpg'),
yt: "",
tiktok: "",
md: "",
fb: "",
ig: "",
nn: "", //Grupo ofc1
nn2: "", //Grupo ofc2
nn3: "", //Colab Loli & Gata
nn4: "", //Enlace LoliBot
nn5: "", //A.T.M.M
nn6: "", //Dev support 
nna: "",
nna2: ""
}

//----------------------------------------------------

let file = fileURLToPath(import.meta.url)
watchFile(file, () => {
  unwatchFile(file)
  console.log(chalk.redBright("Update 'config.js'"))
  import(`${file}?update=${Date.now()}`)
})