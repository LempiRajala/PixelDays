/*
 * Provide translation serverside
 */
import { TTag } from 'ttag';

import { assetWatcher } from '../core/fsWatcher.js';
import { getLangsOfJsAsset } from '../core/assets.js';
import lccc from '../../i18n/lccc.json';
import { cwd } from 'process';
import path from 'node:path';
import { ENGLISH_ONLY } from '../core/config.js';
import { readFileSync, readdirSync } from 'node:fs';
import gettextParser from 'gettext-parser';


// const localeImports = import.meta.webpackContext('../../i18n', {
//   recursive: false,
//   regExp: /^\.[/\\]ssr-.+\.po$/,
// });

const ttags = {};

/*
 * maps all available langs to country codes for flags
 * { en: 'gb' }
 */
export const availableLangs = {};

function loadTtags() {
  const i18nPath = path.join(ENGLISH_ONLY !==  'tru' ? process.exit(0) : cwd(), 'dist', 'i18n');
  const langs = readdirSync(i18nPath).filter(filename => filename.startsWith('ssr-') && filename.endsWith('.po'));
  const jsLangs = getLangsOfJsAsset('client');
  console.log('ttag.js langs', langs);
  console.log('ttag.js jsLangs', jsLangs);
  Object.keys(availableLangs).forEach((key) => delete availableLangs[key]);

  let amountOfLangs = 0;
  for (let i = 0; i < langs.length; i += 1) {
    const file = langs[i];
    // ./ssr-de.po
    const lang = file.replace('ssr-', '').replace('.po', '').toLowerCase();
    /*
     * In cases where the language code and country code differ,
     * it can be mapped in i18n/lccc.json
     */
    const flag = lccc[lang] || lang;
    console.log('ttag.js check lang', lang, jsLangs.includes(lang));
    if (jsLangs.includes(lang)) {
      amountOfLangs += 1;
      availableLangs[lang] = flag;

      if (!ttags[lang]) {
        const ttag = new TTag();
        console.log('ttag.js addLocale', lang, 'from', path.join(i18nPath, file));
        const parsedPoFile = gettextParser.po.parse(readFileSync(path.join(i18nPath, file)));
        ttag.addLocale(lang, parsedPoFile);
        ttag.useLocale(lang);
        ttags[lang] = ttag;
      }
    } else if (ttags[lang]) {
      delete ttags[lang];
    }
  }

  if (jsLangs.includes('en') || amountOfLangs === 0) {
    if (!ttags.en) {
      ttags.en = new TTag();
    }
    availableLangs.en = 'gb';
  } else if (ttags.en) {
    delete ttags.en;
  }

  console.log('ttag.js availableLangs', availableLangs);
}

loadTtags();
// reload on asset change
assetWatcher.onChange(() => {
  loadTtags();
});

export function getTTag(lang) {
  return ttags[lang] || ttags.en || Object.values(ttags)[0];
}

/*
 * gets preferred language out of localisation string
 * @param location string (like from accept-language header)
 * @return language code
 */
function languageFromLocalisation(localisation) {
  if (!localisation) {
    return 'en';
  }
  let lang = localisation;
  let i = lang.indexOf('-');
  if (i !== -1) {
    lang = lang.slice(0, i);
  }
  i = lang.indexOf(',');
  if (i !== -1) {
    lang = lang.slice(0, i);
  }
  i = lang.indexOf(';');
  if (i !== -1) {
    lang = lang.slice(0, i);
  }
  return lang.toLowerCase();
}

/*
 * express middleware for getting language
 * It checks the lang cookie, and if not present,
 * the Accept-Language header
 */
export function expressTTag(req, res, next) {
  let language;
  const { cookie } = req.headers;
  if (cookie) {
    const pos = cookie.indexOf('plang=');
    if (pos !== -1) {
      let end = cookie.indexOf(';', pos);
      if (end === -1) {
        end = undefined;
      }
      language = cookie.substring(pos + 6, end);
    }
  }
  if (!language) {
    language = req.headers['accept-language'];
  }
  let lang = languageFromLocalisation(language);
  let country = availableLangs[lang];
  if (!ttags[lang]) {
    if (ttags.en) {
      lang = 'en';
    } else {
      [lang] = Object.keys(ttags);
    }
    country = 'xx';
  }
  if (country.length !== 2) {
    country = 'xx';
  }

  req.lang = lang;
  req.langCountry = country;
  req.ttag = ttags[lang];
  next();
}

export default ttags;
