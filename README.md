# Kostra člověka · Human Skeleton

Interaktivní 3D atlas lidské kostry (CZ / EN, latinské názvy).

### 👉 Otevřít web: **https://uc0tf.github.io/bones/**

Běží přímo v prohlížeči (počítač, tablet i mobil), nic se neinstaluje.

- **Prozkoumat:** najeď myší na kost a zobrazí se její název česky, anglicky a latinsky. Oblasti: celá kostra, lebka, páteř, hrudník, horní končetina, ruka, pánev, dolní končetina, noha.
- **Test – psaní:** zvýrazní se kost a napíšeš její název. Obtížnosti: lehká (název je předepsaný v políčkách), střední (část písmen je vyplněná, zbytek doplníš do políček), těžká (bez nápovědy). Odpovídat lze česky, anglicky nebo latinsky.
- **Test – kartičky:** bez psaní, kartičky se otáčejí a sám hodnotíš „Znám / Neznám“. Směr kost → název nebo název → kost.
- **Vnitřní kosti:** průhledné okolí, řez modelem a skrývání kostí (klávesa H, ikona oka, na tabletu tlačítko „Skrýt“ v kartě kosti).

## Vývoj

```bash
npm install
npm run dev          # vývojový server
npm run build        # produkční build do dist/
npm run build:model  # znovu stáhne a zpracuje 3D modely -> public/models/skeleton.glb
```

Vygenerovaný model `public/models/skeleton.glb` je součástí repozitáře, takže `build:model` je potřeba jen při změně katalogu kostí (`src/data/catalog.js`).

## Nasazení

```bash
npm run deploy   # sestaví web a nahraje dist/ do větve gh-pages
```

GitHub Pages servíruje větev `gh-pages` (Settings → Pages → Deploy from a branch → `gh-pages` / root).
Složku `dist/` lze nahrát i na jakýkoli statický hosting (Netlify, Vercel…).

## Zdroje a licence

- 3D modely: [BodyParts3D](https://dbarchive.biosciencedbc.jp/en/bodyparts3d/), © The Database Center for Life Science, licence [CC BY-SA 2.1 Japan](https://creativecommons.org/licenses/by-sa/2.1/jp/deed.en). Modely jsou převzaty přes [mirror na GitHubu](https://github.com/Kevin-Mattheus-Moerman/BodyParts3D) a zjednodušeny pro web. Odvozený soubor `public/models/skeleton.glb` je šířen pod stejnou licencí (CC BY-SA).
- Písma Inter a Fraunces (SIL Open Font License) jsou součástí webu přes Fontsource – web nevolá žádné externí služby.
- Názvosloví: latinsky podle Terminologia Anatomica, česky podle běžné české anatomické terminologie.
- Sluchové kůstky a kostrč (v BodyParts3D chybí): [Z-Anatomy](https://github.com/LluisV/Z-Anatomy), CC BY-SA 4.0. Build skript je zarovná do souřadnic BodyParts3D (podobnostní transformace podle společných kostí) a kostrč odřízne od kosti křížové, která ji v BodyParts3D obsahuje.
