/*
 * Html for mainpage
 */

import { getJsAssets } from '../core/assets.js';
import generateMainHTML from './mainHTML.js';

/**
 * Generates string with html of main page
 * @param req express request, populated with ttag and ip
 * @return {html, csp, etab} html, content-security-policy and etag for mainpage
 */
export default function generateMainPage(req) {
  const scripts = getJsAssets('client', req.lang);
  return generateMainHTML(req, 'PixelDays', scripts, 'game');
}
