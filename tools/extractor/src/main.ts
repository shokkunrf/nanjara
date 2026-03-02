import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

// --- Tile extraction region ---
interface TileDef {
  left: number;
  top: number;
  width: number;
  height: number;
}

// --- Tile label: romaji key (used in filename) + Japanese display name ---
type TileLabel = [key: string, label: string];

// --- Group definition ---
interface GroupDef {
  group: string;
  file: string;
  tiles: TileDef[];
  labels: TileLabel[];
}

// Helper: generate character tile row from scan-derived left positions
function charTiles(lefts: number[], top: number): TileDef[] {
  return lefts.map((left) => ({ left, top, width: 106, height: 143 }));
}

// --- Tile labels per group ---
// Order: group-emblem, school-emblem, characters (left-to-right, top-to-bottom)
const TILE_LABELS: Record<string, TileLabel[]> = {
  muse: [
    ["muse", "μ's"],
    ["otonokizaka", "音ノ木坂学院"],
    ["honoka", "高坂穂乃果"],
    ["eli", "絢瀬絵里"],
    ["kotori", "南ことり"],
    ["umi", "園田海未"],
    ["rin", "星空凛"],
    ["maki", "西木野真姫"],
    ["nozomi", "東條希"],
    ["hanayo", "小泉花陽"],
    ["nico", "矢澤にこ"],
  ],
  aqours: [
    ["aqours", "Aqours"],
    ["uranohoshi", "浦の星女学院"],
    ["chika", "高海千歌"],
    ["riko", "桜内梨子"],
    ["kanan", "松浦果南"],
    ["dia", "黒澤ダイヤ"],
    ["you", "渡辺曜"],
    ["yoshiko", "津島善子"],
    ["hanamaru", "国木田花丸"],
    ["mari", "小原鞠莉"],
    ["ruby", "黒澤ルビィ"],
  ],
  nijigasaki: [
    ["doukoukai", "スクールアイドル同好会"],
    ["nijigaku", "虹ヶ咲学園"],
    ["yu", "高咲侑"],
    ["ayumu", "上原歩夢"],
    ["kasumi", "中須かすみ"],
    ["shizuku", "桜坂しずく"],
    ["karin", "朝香果林"],
    ["ai", "宮下愛"],
    ["kanata", "近江彼方"],
    ["setsuna", "優木せつ菜"],
    ["emma", "エマ・ヴェルデ"],
    ["rina", "天王寺璃奈"],
    ["shioriko", "三船栞子"],
    ["mia", "ミア・テイラー"],
    ["lanzhu", "鐘嵐珠"],
  ],
  liella: [
    ["liella", "Liella!"],
    ["yuigaoka", "結ヶ丘女子高等学校"],
    ["kanon", "澁谷かのん"],
    ["kuku", "唐可可"],
    ["chisato", "嵐千砂都"],
    ["sumire", "平安名すみれ"],
    ["ren", "葉月恋"],
    ["kinako", "桜小路きな子"],
    ["mei", "米女メイ"],
    ["shiki", "若菜四季"],
    ["natsumi", "鬼塚夏美"],
    ["wien", "ウィーン・マルガレーテ"],
    ["tomari", "鬼塚冬毬"],
  ],
  hasunosora: [
    ["hasunosora", "蓮ノ空女学院"],
    ["kosho", "蓮ノ空女学院校章"],
    ["kaho", "日野下花帆"],
    ["sayaka", "村野さやか"],
    ["kozue", "乙宗梢"],
    ["tsuzuri", "夕霧綴理"],
    ["rurino", "大沢瑠璃乃"],
    ["ginko", "百生吟子"],
    ["kosuzu", "徒町小鈴"],
    ["hime", "安養寺姫芽"],
  ],
  musical: [
    ["musical", "SCHOOL IDOL MUSICAL"],
    ["tsubakisakihana", "椿咲花女子高校"],
    ["rurika", "椿ルリカ"],
    ["yuzuha", "堂ユズハ"],
    ["yukino", "北条ユキノ"],
    ["hikaru", "天草ヒカル"],
    ["maya", "三笠マーヤ"],
    ["anzu", "滝沢アンズ"],
    ["misuzu", "若槻ミスズ"],
    ["toa", "米楠トア"],
    ["rena", "鈴員レナ"],
    ["sayaka", "晴風サヤカ"],
  ],
  bluebird: [
    ["ikizuraibu", "いきづらい部!"],
    ["love_gakuin", "Love学院高等学校"],
    ["poruka", "高橋ポルカ"],
    ["mai", "麻布麻衣"],
    ["rei", "五椚玲"],
    ["hanabi", "駒形花火"],
    ["kiseki", "金澤奇跡"],
    ["noriko", "調布のりこ"],
    ["yukuri", "春宮ゆくり"],
    ["kaguya", "此花輝夜"],
    ["maaya", "山田真綾"],
    ["rinne", "佐々木麟音"],
  ],
};

// --- All tile positions (hard-coded from image analysis) ---
const GROUPS: GroupDef[] = [
  // ========== Image 1: mN6RFdSHSgIFhDLh.jpeg ==========
  {
    group: "muse",
    file: "input/mN6RFdSHSgIFhDLh.jpeg",
    labels: TILE_LABELS.muse,
    tiles: [
      // Emblems
      { left: 923, top: 371, width: 106, height: 143 },
      { left: 1038, top: 371, width: 106, height: 143 },
      // 9 character tiles
      ...charTiles([79, 193, 307, 422, 536, 650, 764, 878, 992], 525),
    ],
  },
  {
    group: "aqours",
    file: "input/mN6RFdSHSgIFhDLh.jpeg",
    labels: TILE_LABELS.aqours,
    tiles: [
      // Emblems
      { left: 923, top: 725, width: 106, height: 143 },
      { left: 1038, top: 725, width: 106, height: 143 },
      // 9 character tiles
      ...charTiles([79, 194, 308, 423, 537, 652, 766, 881, 996], 879),
    ],
  },

  // ========== Image 2: e0mM0yNYDItl3rTP.jpeg ==========
  {
    group: "nijigasaki",
    file: "input/e0mM0yNYDItl3rTP.jpeg",
    labels: TILE_LABELS.nijigasaki,
    tiles: [
      // Emblems
      { left: 928, top: 112, width: 106, height: 143 },
      { left: 1041, top: 112, width: 106, height: 143 },
      // Row 1: 7 character tiles
      ...charTiles([205, 320, 434, 549, 663, 778, 892], 264),
      // Row 2: 6 character tiles
      ...charTiles([259, 374, 489, 604, 719, 833], 424),
    ],
  },
  {
    group: "liella",
    file: "input/e0mM0yNYDItl3rTP.jpeg",
    labels: TILE_LABELS.liella,
    tiles: [
      // Emblems
      { left: 926, top: 627, width: 106, height: 143 },
      { left: 1041, top: 627, width: 106, height: 143 },
      // Row 1: 6 character tiles
      ...charTiles([262, 377, 490, 606, 721, 835], 783),
      // Row 2: 5 character tiles
      ...charTiles([309, 428, 547, 666, 785], 940),
    ],
  },

  // ========== Image 3: dGRi5nEeGWK4PsvV.jpeg ==========
  {
    group: "hasunosora",
    file: "input/dGRi5nEeGWK4PsvV.jpeg",
    labels: TILE_LABELS.hasunosora,
    tiles: [
      // Emblems
      { left: 922, top: 89, width: 106, height: 143 },
      { left: 1038, top: 89, width: 106, height: 143 },
      // 8 character tiles
      ...charTiles([141, 257, 372, 488, 603, 719, 835, 953], 243),
    ],
  },
  {
    group: "musical",
    file: "input/dGRi5nEeGWK4PsvV.jpeg",
    labels: TILE_LABELS.musical,
    tiles: [
      // Emblems
      { left: 921, top: 440, width: 106, height: 143 },
      { left: 1038, top: 440, width: 106, height: 143 },
      // 10 character tiles
      ...charTiles([37, 149, 262, 373, 485, 597, 709, 822, 933, 1045], 599),
    ],
  },
  {
    group: "bluebird",
    file: "input/dGRi5nEeGWK4PsvV.jpeg",
    labels: TILE_LABELS.bluebird,
    tiles: [
      // Emblems
      { left: 923, top: 796, width: 106, height: 143 },
      { left: 1038, top: 796, width: 106, height: 143 },
      // 10 character tiles
      ...charTiles([34, 147, 259, 372, 485, 597, 710, 822, 935, 1048], 952),
    ],
  },
];

// --- Main ---
async function main() {
  const outputDir = path.resolve("output");
  fs.mkdirSync(outputDir, { recursive: true });

  // Validate label counts
  for (const group of GROUPS) {
    if (group.tiles.length !== group.labels.length) {
      console.error(
        `Label count mismatch for ${group.group}: ${group.tiles.length} tiles vs ${group.labels.length} labels`,
      );
      return;
    }
  }

  // Compute unified height (max across all tiles)
  const maxHeight = Math.max(
    ...GROUPS.flatMap((g) => g.tiles.map((t) => t.height)),
  );

  let globalIndex = 1;
  const totalTiles = GROUPS.reduce((sum, g) => sum + g.tiles.length, 0);
  const tilesJson: Record<string, string> = {};

  console.log(
    `Extracting ${totalTiles} tiles (unified height: ${maxHeight}px)\n`,
  );

  for (const group of GROUPS) {
    console.log(`${group.group} (${group.tiles.length} tiles):`);

    for (let i = 0; i < group.tiles.length; i++) {
      const tile = group.tiles[i];
      const [key, label] = group.labels[i];
      const idx = String(globalIndex).padStart(3, "0");
      const outputName = `${idx}_${group.group}_${key}.png`;

      await sharp(group.file)
        .extract({
          left: tile.left,
          top: tile.top,
          width: tile.width,
          height: tile.height,
        })
        .resize({
          height: maxHeight,
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png()
        .toFile(path.join(outputDir, outputName));

      tilesJson[outputName] = label;
      console.log(`  ${outputName}`);
      globalIndex++;
    }
  }

  // Write tiles.json mapping (filename -> Japanese display name)
  fs.writeFileSync(
    path.join(outputDir, "tiles.json"),
    JSON.stringify(tilesJson, null, 2) + "\n",
  );
  console.log(`\n  -> tiles.json written`);

  console.log(`\nDone! Extracted ${totalTiles} tiles to ${outputDir}/`);
}

main().catch(console.error);
