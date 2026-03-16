import sharp from 'sharp';
import fs from 'node:fs';
import path from 'node:path';

const [source, outputDir] = process.argv.slice(2);
if (!source || !outputDir) {
  console.error('Usage: tsx src/main.ts <source.png> <output-dir>');
  process.exit(1);
}

const PAI_WIDTH = 174;
const PAI_HEIGHT = 236;

const SERIES: Record<string, Record<string, { left: number; top: number }>> = {
  livelive: {
    muse: { left: 433, top: 2374 },
    otonokizaka: { left: 648, top: 2374 },
    honoka: { left: 863, top: 2374 },
    eli: { left: 1047, top: 2374 },
    kotori: { left: 1230, top: 2374 },
    umi: { left: 1414, top: 2374 },
    rin: { left: 1597, top: 2374 },
    maki: { left: 1780, top: 2374 },
    nozomi: { left: 1964, top: 2374 },
    hanayo: { left: 2147, top: 2374 },
    nico: { left: 2330, top: 2374 },
  },
  sunshine: {
    aqours: { left: 2837, top: 2374 },
    uranohoshi: { left: 3052, top: 2374 },
    chika: { left: 3267, top: 2374 },
    riko: { left: 3450, top: 2374 },
    kanan: { left: 3634, top: 2374 },
    dia: { left: 3817, top: 2374 },
    you: { left: 4000, top: 2374 },
    yoshiko: { left: 4183, top: 2374 },
    hanamaru: { left: 4367, top: 2374 },
    mari: { left: 4550, top: 2374 },
    ruby: { left: 4733, top: 2374 },
  },
  nijigaku: {
    doukoukai: { left: 436, top: 2966 },
    nijigasaki: { left: 651, top: 2966 },
    yu: { left: 867, top: 2966 },
    ayumu: { left: 1050, top: 2966 },
    kasumi: { left: 1234, top: 2966 },
    shizuku: { left: 1417, top: 2966 },
    karin: { left: 1600, top: 2966 },
    ai: { left: 1784, top: 2966 },
    kanata: { left: 1967, top: 2966 },
    setsuna: { left: 2150, top: 2966 },
    emma: { left: 2334, top: 2966 },
    rina: { left: 2517, top: 2966 },
    shioriko: { left: 2700, top: 2966 },
    mia: { left: 2884, top: 2966 },
    lanzhu: { left: 3067, top: 2966 },
  },
  superstar: {
    liella: { left: 435, top: 3561 },
    yuigaoka: { left: 650, top: 3561 },
    kanon: { left: 865, top: 3561 },
    kuku: { left: 1049, top: 3561 },
    chisato: { left: 1232, top: 3561 },
    sumire: { left: 1416, top: 3561 },
    ren: { left: 1599, top: 3561 },
    kinako: { left: 1782, top: 3561 },
    mei: { left: 1966, top: 3561 },
    shiki: { left: 2149, top: 3561 },
    natsumi: { left: 2332, top: 3561 },
    wien: { left: 2515, top: 3561 },
    tomari: { left: 2699, top: 3561 },
  },
  hasujo: {
    club: { left: 3097, top: 3561 },
    hasunosora: { left: 3312, top: 3561 },
    kaho: { left: 3527, top: 3561 },
    sayaka: { left: 3710, top: 3561 },
    rurino: { left: 3893, top: 3561 },
    ginko: { left: 4077, top: 3561 },
    kosuzu: { left: 4260, top: 3561 },
    hime: { left: 4443, top: 3561 },
    ceras: { left: 4627, top: 3561 },
    izumi: { left: 4810, top: 3561 },
  },
  musical: {
    musical: { left: 391, top: 4154 },
    takizakura_tsubakisakihana: { left: 606, top: 4154 },
    rurika: { left: 821, top: 4154 },
    yuzuha: { left: 1005, top: 4154 },
    yukino: { left: 1188, top: 4154 },
    hikaru: { left: 1371, top: 4154 },
    maya: { left: 1554, top: 4154 },
    anzu: { left: 1738, top: 4154 },
    misuzu: { left: 1921, top: 4154 },
    toa: { left: 2104, top: 4154 },
    rena: { left: 2288, top: 4154 },
    sayaka: { left: 2471, top: 4154 },
  },
  ikizu: {
    ikizuraibu: { left: 2794, top: 4154 },
    love_gakuin: { left: 3009, top: 4154 },
    poruka: { left: 3224, top: 4154 },
    mai: { left: 3408, top: 4154 },
    akira: { left: 3591, top: 4154 },
    hanabi: { left: 3774, top: 4154 },
    miracle: { left: 3958, top: 4154 },
    noriko: { left: 4141, top: 4154 },
    yukuri: { left: 4324, top: 4154 },
    aurora: { left: 4507, top: 4154 },
    midori: { left: 4691, top: 4154 },
    shion: { left: 4875, top: 4154 },
  },
};

async function main() {
  fs.mkdirSync(outputDir, { recursive: true });

  let globalIndex = 1;

  for (const [series, pais] of Object.entries(SERIES)) {
    for (const [name, pai] of Object.entries(pais)) {
      const idx = String(globalIndex).padStart(3, '0');
      const outputName = `${idx}_${series}_${name}.png`;

      await sharp(source)
        .extract({
          left: pai.left,
          top: pai.top,
          width: PAI_WIDTH,
          height: PAI_HEIGHT,
        })
        .png()
        .toFile(path.join(outputDir, outputName));

      console.log(outputName);
      globalIndex++;
    }
  }
}

main().catch(console.error);
