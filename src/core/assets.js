/*
 * Provide css and js asset files for client
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';

import { ensureBadgeExistence } from '../data/sql/Badge.js';
import { assetWatcher } from './fsWatcher.js';
import { ASSET_DIR, IS_BUNDLE } from './config.js';

const assetDir = path.join(__dirname, 'public', ASSET_DIR);
/*
 * {
 *   js:
 *     client:
 *       en: "/assets/client.defult.134234.js",
 *       de: "/assets/client.de.32834234.js",
 *       [...]
 *     [...]
 *   css:
 *     default: "/assets/default.234234.css",
 *     [...]
 *   themes:
 *     dark-round: "/assets/theme-dark-round.234233324.css",
 *     [...]
 * }
 */
let assets;

/*
 * check files in asset folder and write insto assets object
 */
function checkAssets() {
  const parsedAssets = {
    js: {},
    css: {},
    themes: {},
  };
  const assetFiles = fs.readdirSync(assetDir);
  const mtimes = {};

  for (const filename of assetFiles) {
    const parts = filename.split('.');

    // File needs to have a timestamp in its name
    if (parts.length < 3) {
      continue;
    }
    // if multiple candidates exist, take most recent created file
    const mtime = fs.statSync(path.resolve(assetDir, filename))
      .mtime.getTime();
    const ident = parts.filter((a, ind) => ind !== parts.length - 2).join('.');
    if (mtimes[ident] && mtimes[ident] > mtime) {
      continue;
    }
    mtimes[ident] = mtime;

    const ext = parts[parts.length - 1];
    const relPath = `${ASSET_DIR}/${filename}`;

    switch (ext.toLowerCase()) {
      case 'js': {
        // Format: name.[lang].[timestamp].js
        if (parts.length === 4) {
          const [name, lang] = parts;
          let nameObj = parsedAssets.js[name];
          if (typeof nameObj !== 'object') {
            nameObj = {};
            parsedAssets.js[name] = nameObj;
          }
          nameObj[lang] = relPath;
        } else {
          const [name] = parts;
          parsedAssets.js[name] = relPath;
        }
        break;
      }
      case 'css': {
        const [name] = parts;
        if (name.startsWith('theme-')) {
          parsedAssets.themes[name.substring(6)] = relPath;
        } else {
          if (name === 'default') {
            parsedAssets.themes[name] = relPath;
          }
          // Format: [dark-]name.[timestamp].js
          parsedAssets.css[name] = relPath;
        }
        break;
      }
      default:
        // nothing
    }
  }
  return parsedAssets;
}

assets = checkAssets();
// reload on asset change
assetWatcher.onChange(() => {
  assets = checkAssets();
});

export function getLangsOfJsAsset(name) {
  const nameAssets = assets.js[name];
  if (!nameAssets) {
    return [];
  }
  return Object.keys(nameAssets);
}

export function getJsAssets(name, lang) {
  const jsAssets = [];

  switch (name) {
    case 'client':
      jsAssets.push(assets.js.vendor);
      break;
    case 'globe':
      jsAssets.push(assets.js.three);
      break;
    case 'popup':
      jsAssets.push(assets.js.pvendor);
      break;
    default:
      // nothing
  }

  const nameAssets = assets.js[name];
  let mainAsset;
  if (typeof nameAssets === 'object') {
    mainAsset = (lang && nameAssets[lang])
      || nameAssets.en
      || Object.values(nameAssets)[0];
  } else {
    mainAsset = nameAssets;
  }
  if (mainAsset) {
    jsAssets.push(mainAsset);
  }

  return jsAssets;
}

export function getCssAssets() {
  return assets.css;
}

export function getThemeCssAssets() {
  return assets.themes;
}

/*
 * Check badges file and ensure that those badges exist in the database,
 * idk why i put that here, it felt like it would fit here, since we process
 * a file in the public directory...
 */
(async () => {
  // const file =
  //   IS_BUNDLE
  //   ? path.join(__dirname, 'public', 'badges', 'badges.txt')
  //   : path.join(__dirname, '..', '..', 'public', 'badges', 'badges.txt');
  const file = path.join(__dirname, 'public', 'badges', 'badges.txt');
  if (!fs.existsSync(file)) {
    return;
  }

  const fileStream = fs.createReadStream(file);
  const lineReader = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (let l of lineReader) {
    l = l.trim();
    const seperator = l.indexOf('|');
    if (seperator <= 0 || seperator === l.length - 1) {
      return;
    }
    const name = l.substring(0, seperator).trim();
    const description = l.substring(seperator + 1).trim();
    if (name.length && description.length) {
      // eslint-disable-next-line no-await-in-loop
      await ensureBadgeExistence(name, description);
    }
  }
})();
