/*
 * outer shell for a html page with a modal on it, good for smaller windows
 * like info, redirection and error pages
 */
import { getTTag } from '../middleware/ttag.js';
import { getThemeCssAssets } from '../core/assets.js';
import { BASENAME } from '../core/config.js';

/* eslint-disable max-len */

export default function putHtmlIntoModal(title, description, htmlString, lang = 'en') {
  const { t } = getTTag(lang);
  return `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="UTF-8" />
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta name="google" content="nopagereadaloud" />
    <meta name="theme-color" content="#cae3ff" />
    <link rel="icon" href="${BASENAME}/favicon.ico" type="image/x-icon" />
    <link rel="apple-touch-icon" href="${BASENAME}/apple-touch-icon.png" />
    <link rel="stylesheet" type="text/css" id="globcss" href="${BASENAME}${getThemeCssAssets().default}" />
  </head>
  <body>
    <div class="popup">
      <div class="popup-modal">
        <div class="popup-content" style="font-size: 20px;">
${htmlString}
          <p><a href="${BASENAME}/">${t`Click here`}</a> ${t`to go back to pixeldays`}</p>
        </div>
      </div>
    </div>
    <a data-jslicense="1" style="display: none;" href="${BASENAME}/legal">JavaScript license information</a>
  </body>
</html>
`;
}
