/*
 * post-process production bundle to resolve translations
 */
import fs from 'fs';
import path from 'path';
import { parseAsync, transformFromAstAsync } from '@babel/core';
import { spawn } from 'child_process';

const assetdir = path.resolve(
  import.meta.dirname, '..', 'dist', 'public', 'assets',
);
const podir = path.resolve(
  import.meta.dirname, '..', 'i18n',
);
const assetSourceCache = new Map();
const assetAstCache = new Map();

console.log('__dirname:', import.meta.dirname);
console.log('Asset dir exists:', fs.existsSync(assetdir));
console.log('Public dir exists:', fs.existsSync(path.resolve(
  import.meta.dirname, '..', 'dist', 'public',
)));
console.log('PO dir exists:', fs.existsSync(podir));

export async function buildLanguage(lang = 'en') {
  const ttag = { resolve: {} };

  if (lang === 'en') {
    ttag.resolve.translations = 'default';
    /*
     * if we do it here, we do not have a template.pot avaiable for completition
     * check earlier in build
    ttag.extract = { output: path.join(podir, 'template.pot') };
    ttag.sortByMsgid = true;
    */
  } else {
    const translations = path.join(podir, lang + '.po');
    if (!fs.existsSync(translations)) {
      // throw new Error(`Language ${lang} has no translation`);
      console.warn(`Language ${lang} has no translation`);
      return;
    }
    ttag.resolve.translations = translations;
  }

  const options = {
    plugins: [
      ['ttag', ttag],
    ],
    configFile: false,
    babelrc: false,
    sourceMaps: false,
    compact: true,
    comments: false,
  };

  const translatableAssets = fs.readdirSync(assetdir).filter((e) => e.endsWith('.js') && e.includes('.WPLANGCODE.'));

  const amountOfAssets = translatableAssets.length;
  for (let i = 0; i < amountOfAssets; i += 1) {
    const asset = translatableAssets[i];

    let code = assetSourceCache.get(asset);
    if (!code) {
      const assetPath = path.join(assetdir, asset);
      if(!fs.existsSync(assetPath)) {
        console.warn(`cant find file ${assetPath}`);
        continue;
      }

      code = 'import { t, jt, c, gettext, ngettext } from \'ttag\';\n'
        + fs.readFileSync(assetPath, 'utf8');
      assetSourceCache.set(asset, code);
    }
    let ast = assetAstCache.get(asset);
    if (!ast) {
      // console.log('parseSync before', lang)
      // console.log(code.substring(code.length-100));
      // ast = parseSync(code);
      ast = await parseAsync(code, {
        filename: path.join(assetdir, asset), // или просто 'file.js'
        configFile: false, // отключаем поиск конфига
        babelrc: false, // отключаем .babelrc
      });
      // console.log('parseSync after', lang)
      assetAstCache.set(asset, ast);
    }

    // console.log('transformFromAstAsync before', lang)
    const { code: output } = await transformFromAstAsync(ast, code, options);
    // console.log('transformFromAstAsync after', lang)
    fs.writeFileSync(
      path.join(assetdir, asset.replace('.WPLANGCODE.', '.' + lang + '.')),
      output.replace('WPLANGCODE', lang),
    );
  }
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
  const minifyProcess = spawn('node', [import.meta.filename, ...langs], {
    shell: process.platform == 'win32',
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

  return new Promise((resolve, reject) => {
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
        buildLanguageAssetsInProcess(langs.slice(start, end), callback);
      }
    }
  });
}

async function doBuildLanguages() {
  /*
   * if there are any arguments, they are lang codes
   */
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

if (import.meta.url.endsWith(process.argv[1])) {
  doBuildLanguages();
}

export default buildLanguages;
