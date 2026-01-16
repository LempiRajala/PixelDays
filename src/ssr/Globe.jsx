/*
 * react html for 3D globe page
 *
 */

/* eslint-disable max-len */
import etag from 'etag';

import { CDN_URL, BASENAME, NO_CDN_COUNTRIES } from '../core/config.js';

/* this will be set by webpack */
import { getJsAssets, getCssAssets } from '../core/assets.js';

/*
 * generates string with html of globe page
 * @param lang language code
 * @return html of mainpage
 */
function generateGlobePage(req) {
  const { lang, ttag: { t } } = req;
  const scripts = getJsAssets('globe', lang);

  const globeEtag = etag(scripts.join('_'), { weak: true });
  if (req.headers['if-none-match'] === globeEtag) {
    return { html: null, etag: globeEtag };
  }

  const cdnUrl = NO_CDN_COUNTRIES?.includes(req.ip.country)
    ? undefined : CDN_URL;

  const html = `<!doctype html>
    <html lang="${lang}">
      <head>
        <meta charset="UTF-8" />
        <title>${t`PixelDays 3DGlobe`}</title>
        <meta name="description" content="${t`A 3D globe of our whole map`}" />
        <meta name="google" content="nopagereadaloud" />
        <meta name="theme-color" content="#cae3ff" />
        <meta name="viewport"
          content="user-scalable=no, width=device-width, initial-scale=1.0, maximum-scale=1.0"
        />
        <link rel="icon" href="${BASENAME}/favicon.ico" type="image/x-icon" />
        <link rel="apple-touch-icon" href="${BASENAME}/apple-touch-icon.png" />
        <link rel="stylesheet" type="text/css" id="globcss" href="${cdnUrl || BASENAME}${getCssAssets().globe}" />
      </head>
      <body>
        <div id="webgl" />
        <div id="coorbox">(0, 0)</div>
        <div id="info">${t`Double click on globe to go back.`}</div>
        <div id="loading">${t`Loading...`}</div>
        ${scripts.map((script) => `<script src="${cdnUrl || BASENAME}${script}"></script>`).join('')}
        <a data-jslicense="1" style="display: none;" href="${BASENAME}/legal">JavaScript license information</a>
      </body>
    </html>
  `;

  return { html, etag: globeEtag };
}

export default generateGlobePage;
