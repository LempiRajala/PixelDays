/*
 * post-process production bundle to resolve translations
 */
import fs from 'fs';
import path from 'path';
import gettextParser from 'gettext-parser';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { default as LZ } from 'lz-string';

const publicdir = path.resolve(
  import.meta.dirname, '..', 'dist', 'public',
);
const assetdir = path.resolve(publicdir, 'assets');
const podir = path.resolve(
  import.meta.dirname, '..', 'i18n',
);
const assetSourceCache = new Map();
const assetAstCache = new Map();

// console.log('__dirname:', import.meta.dirname);
// console.log('Asset dir exists:', fs.existsSync(assetdir));
// console.log('Public dir exists:', fs.existsSync(publicdir));
// console.log('PO dir exists:', fs.existsSync(podir));

export async function buildLanguage(lang = 'en') {
  const jsFiles = fs.readdirSync(assetdir).filter(e => e.endsWith('.js') && e.includes('.WPLANGCODE.'));
  const clientJsFile = jsFiles.filter(e => e.startsWith('client.'))[0];
  
  if (lang === 'en') {
    const assetPath = path.join(assetdir, clientJsFile);
    const code = fs.readFileSync(assetPath, 'utf8');
    
    const finalCode = [
      `window._LANG_CODE = "en";`,
      code.replace(/WPLANGCODE/g, 'en'),
    ].join('\n');
    
    const clientJsWithTranslationPath = path.join(assetdir, clientJsFile.replace('.WPLANGCODE.', '.en.'));
    fs.writeFileSync(clientJsWithTranslationPath, finalCode);
    // console.log('buildLanguageBundles.js write', clientJsWithTranslationPath);
    return;
  }

  const translationsPath = path.join(podir, lang + '.po');
  if (!fs.existsSync(translationsPath)) {
    console.warn(`Language ${lang} has no translation`);
    return;
  }

  const poContent = fs.readFileSync(translationsPath);
  const parsed = gettextParser.po.parse(poContent);
  
  // console.log('buildLanguageBundles.js jsFiles', jsFiles);

  let code = assetSourceCache.get(clientJsFile);
  if (!code) {
    const assetPath = path.join(assetdir, clientJsFile);
    code = fs.readFileSync(assetPath, 'utf8');
    assetSourceCache.set(clientJsFile, code);
  }

  const output = [
    `// Auto-generated language bundle for ${lang}`,
    '',
    '// Translation',
    `window._LANG_CODE = "${lang}";`,
    `window._LANG_TRANSLATION = \`${LZ.compressToBase64(JSON.stringify(parsed))}\`;`,
    '',
    '// Original code:',
    code,
  ].join('\n');

  const clientJsWithTranslationPath = path.join(assetdir, clientJsFile.replace('.WPLANGCODE.', '.' + lang + '.'));
  const finalCode = output.replace(/WPLANGCODE/g, lang);
  fs.writeFileSync(clientJsWithTranslationPath, finalCode);
  // console.log('buildLanguageBundles.js write', clientJsWithTranslationPath);
}

async function buildLanguageAssets(langs, callback) {
  try {
    for (let i = 0; i < langs.length; i += 1) {
      const lang = langs[i].trim();
      await buildLanguage(lang);
      callback(null, lang);
    }
  } catch (error) {
    callback(error);
  }
}

async function buildLanguageAssetsInProcess(langs, callback) {
  if (!langs.length) {
    return;
  }
  const minifyProcess = spawn('bun', [import.meta.filename, ...langs], {
    shell: process.platform === 'win32',
  });
  minifyProcess.stdout.on('data', (data) => {
    callback(null, data.toString());
  });
  minifyProcess.stderr.on('data', (data) => {
    console.error(data.toString());
  });
  minifyProcess.on('close', (code) => {
    if (code) {
      callback(new Error(`Minifying assets failed with code ${code}!`));
    }
  });
}

function buildLanguages(langs, finish = true, parallel = false) {
  const ts = Date.now();
  process.stdout.write(`\x1b[33mTranslating\x1b[0m\n`);

  const amountOfLangs = langs.length;

  if (amountOfLangs === 0) {
    process.stdout.write('Finish en bundle\n');
    return buildLanguage();
  }

  return new Promise(async (resolve, reject) => {
    let i = 0;
    let cursorPosition = 0;
    const callback = async (error, finishedLang) => {
      if (error) {
        reject(error);
        return;
      }
      finishedLang = finishedLang.trim();

      if (i > 0) {
        /* move back 9 columns and clean till EOL */
        process.stdout.write('\x1b[11D\x1b[0K');
      }

      /* calculate the current cursor position, because querying for it is hard */
      if (cursorPosition + finishedLang.length + 1 >= process.stdout.columns) {
        cursorPosition = 0;
        process.stdout.write('\n');
      }
      cursorPosition += finishedLang.length + 1;
      process.stdout.write('\x1b[32m' + finishedLang + ' ');
      if (cursorPosition + 11 >= process.stdout.columns) {
        cursorPosition = 0;
        process.stdout.write('\n');
      }
      /* write progress */
      process.stdout.write('\x1b[0m(' + `  ${i + 1}`.slice(-3) + '/' + `  ${amountOfLangs}`.slice(-3) + ' ) ');

      i += 1;
      if (i === amountOfLangs) {
        process.stdout.write('\x1b[11D\x1b[0K\n');
        if (finish) {
          process.stdout.write('Finish en bundle\n');
          await buildLanguage();
        }
        process.stdout.write(`\x1b[33mTranslating took ${Math.round((Date.now() - ts) / 1000)}s\x1b[0m\n`);
        assetAstCache.clear();
        assetSourceCache.clear();

        resolve();
      }
    };

    parallel = parseInt(parallel, 10);
    if (Number.isNaN(parallel) || parallel < 1) {
      parallel = false;
    }
    if (!parallel) {
      /*
       * minify in current process
       */
      buildLanguageAssets(langs, callback);
    } else {
      /*
       * split into multiple other processes
       */
      const partSize = Math.ceil(amountOfLangs / parallel);

      for (let i = 0; i < parallel; i++) {
        const start = i * partSize;
        const end = start + partSize;
        await buildLanguageAssetsInProcess(langs.slice(start, end), callback);
      }
    }
  });
}

async function doBuildLanguages() {
  /*
   * if there are any arguments, they are lang codes
  */
  // console.log('buildLanguageBundles.js process.argv', process.argv)
  if (process.argv.length > 1) {
    const langs = process.argv.slice(2).filter((a) => !a.startsWith('-'));
    if (langs.length) {
      buildLanguageAssets(langs, (error, finishedLang) => {
        if (error) {
          console.error(error.message);
          process.exit(1);
        } else {
          console.log(finishedLang);
        }
      });
      return;
    }
  }
  console.log('No --langs given');
  process.exit(1);
}

// if (import.meta.url.endsWith(process.argv[1])) {
// if (require.main === module) {
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  doBuildLanguages();
}

export default buildLanguages;
