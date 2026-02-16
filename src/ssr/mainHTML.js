/*
 * main page html
 */

/* eslint-disable max-len */
import etag from 'etag';

import hashScript from '../utils/scriptHash.js';
import getLocalizedCanvases, {
  defaultCanvasForCountry,
} from '../canvasesDesc.js';
import { availableLangs as langs } from '../middleware/ttag.js';
import { getThemeCssAssets } from '../core/assets.js';
import chooseAPIUrl from '../core/chooseAPIUrl.js';
import {
  BACKUP_URL, CONTACT_ADDRESS, AVAILABLE_TP,
  UNSHARDED_HOST, CDN_HOST, CDN_URL, BASENAME, NO_CDN_COUNTRIES,
} from '../core/config.js';
import { DEFAULT_CANVAS_ID } from '../core/constants.ts';

/**
 * Generates string with html of main pages, only the entry script differs
 * @param req express request, populated with ttag and ip
 * @param title title of website
 * @param scripts Array of paths to scripts to include
 * @param appClass classname of div of react entry point
 * @param params additional parameters we give to the client in window.ssv
 * @return {html, csp, etab} html, content-security-policy and etag for mainpage
 */
export default function generateMainHTML(
  req, title, scripts, appClass, params = null,
) {
  const { lang, ip, ttag: { t } } = req;
  const { country } = ip;
  const host = ip.getHost(false);
  const proto = req.headers['x-forwarded-proto'] || 'http';

  const apiUrl = (UNSHARDED_HOST && host.startsWith(UNSHARDED_HOST))
    ? null : chooseAPIUrl();
  const localizedCanvases = getLocalizedCanvases(lang);
  const defaultCanvas = defaultCanvasForCountry[country] || DEFAULT_CANVAS_ID;

  const ssv = {
    availableStyles: getThemeCssAssets(),
    langs,
    backupurl: BACKUP_URL,
    contactAddress: CONTACT_ADDRESS,
    apiUrl,
    basename: BASENAME,
    lang,
    canvases: localizedCanvases,
    defaultCanvas,
    availableTp: AVAILABLE_TP,
  };

  if (params) {
    ssv.params = params;
  }

  if (CDN_URL) {
    /*
     * CDN_URL gets used for all assets, but not for /api/ or /ws requests
     */
    if (NO_CDN_COUNTRIES?.includes(country)) {
      /*
       * tells the client to test the cdn and use it if successful
       */
      ssv.cdnTestUrl = CDN_URL;
    } else {
      ssv.cdnUrl = CDN_URL;
    }
  }

  const ssvR = JSON.stringify(ssv);

  const headScript = `/* @license magnet:?xt=urn:btih:0b31508aeb0634b347b8270c7bee4d411b5d4109&dn=agpl-3.0.txt AGPL-3.0-or-later */\n(function(){window.ssv=${ssvR};window.me=fetch('${apiUrl || BASENAME}/api/me',{credentials:'include'})})();\n/* @license-end */`;
  const scriptHash = hashScript(headScript);

  const csp = `script-src 'self' ${CDN_HOST} ${scriptHash} api.tuxlervpn.com *.tiktok.com *.ttwstatic.com static.cloudflareinsights.com; worker-src 'self' blob:;`;

  const mainEtag = etag(scripts.concat(ssvR).join('_'), { weak: true });
  if (req.headers['if-none-match'] === mainEtag) {
    return { html: null, csp, etag: mainEtag };
  }

  const description = t`Place color pixels on an map styled canvas with other players online`;
  const media = BASENAME + '/apple-touch-icon.png';
  const type = 'image';
  const width = 256;
  const height = 256;

  const html = `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="UTF-8" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta property="og:type" content="${(type === 'video') ? 'video.other' : 'website'}" />
    <meta property="og:site_name" content="${host}" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:${type}" content="${proto}://${host}${media}" />
    <meta property="og:${type}:secure_url" content="https://${host}${BASENAME}${media}" />
    <meta property="og:${type}:width" content="${width}" />
    <meta property="og:${type}:height" content="${height}" />${(type === 'video') ? `
      <meta property="og:video:type" content="video/mp4" />` : ''}
    <meta name="google" content="nopagereadaloud" />
    <meta name="theme-color" content="#cae3ff" />
    <meta name="viewport" content="user-scalable=no, width=device-width, initial-scale=1.0, maximum-scale=1.0" />
    <link rel="icon" href="${BASENAME}/favicon.ico" type="image/x-icon" />
    <link rel="apple-touch-icon" href="${BASENAME}/apple-touch-icon.png" />
    <script>${headScript}</script>
    <style>html, body { position: fixed; top: 0; left: 0; bottom: 0; right: 0; overflow: hidden; user-select: none; margin: 0; }</style>
    <link rel="stylesheet" type="text/css" id="globcss" href="${ssv.cdnUrl || BASENAME}${getThemeCssAssets().default}" />
  </head>
  <body>
    <div id="app" class="${appClass}"></div>
    ${scripts.map((script) => `<script src="${ssv.cdnUrl || BASENAME}${script}"></script>`).join('')}
    <a data-jslicense="1" style="display: none;" href="${BASENAME}/legal">JavaScript license information</a>
  </body>
</html>`;

  return { html, csp, etag: mainEtag };
}
