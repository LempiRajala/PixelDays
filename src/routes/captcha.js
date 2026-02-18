import logger from '../core/logger.js';
import { CAPTCHA_SERVICE_URL } from '../core/config.js';
import { isTrusted } from '../data/redis/captcha.js';

async function captcha(req, res) {
  req.tickRateLimiter(3000);

  res.set({
    'Access-Control-Expose-Headers': 'captcha-id, challenge-needed',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  });

  if (req.csrfPossible) {
    res.status(403);
    res.set({ 'Content-Type': 'text/html; charset=utf-8' });
    res.send(
      '<html><body><h1>Captchaserver: 403 Server Error</h1>Cross-Site request rejected</body></html>',
    );
    return;
  }

  const { ipString } = req.ip;

  try {
    const trusted = await isTrusted(ipString, req.headers['user-agent']);
    const captchaRes = await fetch(`${CAPTCHA_SERVICE_URL}/captcha`);
    if (!captchaRes.ok) {
      throw new Error(`Captcha service: ${captchaRes.status}`);
    }
    const id = captchaRes.headers.get('x-captcha-id');
    if (!id) {
      throw new Error('No X-Captcha-ID from captcha service');
    }
    const body = await captchaRes.arrayBuffer();
    logger.info(`CAPTCHA ${ipString} got captcha id ${id}`);

    res.set({
      'Content-Type': 'image/png',
      'Captcha-Id': id,
      'Challenge-Needed': trusted ? '0' : '1',
    });
    res.end(Buffer.from(body));
  } catch (err) {
    if (!res.writableEnded) {
      res.status(503);
      res.set({ 'Content-Type': 'text/html; charset=utf-8' });
      res.send(
        '<html><body><h1>Captchaserver: 503 Service Unavailable</h1>Maybe try it later again</body></html>',
      );
    }
    logger.warn(err.message);
  }
}

export default captcha;
