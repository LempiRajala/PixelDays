/*
 * functions for mail verify
 */

/* eslint-disable max-len */

import nodemailer from 'nodemailer';

import logger from './logger.js';
import { getTTag } from '../middleware/ttag.js';
import { codeExists, checkCode, setCode } from '../data/redis/mailCodes.js';
import socketEvents from '../socket/socketEvents.js';
import { USE_MAILER, MAIL_ADDRESS } from './config.js';
import {
  getUserByEmail, verifyEmail, getMailAndNameOfUserId,
} from '../data/sql/User.js';

export class MailProvider {
  constructor() {
    this.enabled = !!USE_MAILER;
    if (this.enabled) {
      this.transporter = nodemailer.createTransport({
        sendmail: true,
        newline: 'unix',
        path: '/usr/sbin/sendmail',
      });
    }

    /*
     * mail requests make it through SocketEvents when sharding
     */
    socketEvents.on('mail', (type, args) => {
      switch (type) {
        case 'verify':
          this.postVerifyMail(...args);
          break;
        case 'newloc':
          this.postNewLocationMail(...args);
          break;
        case 'pwreset':
          this.postPasswdResetMail(...args);
          break;
        default:
          // nothing
      }
    });
  }

  sendMail(to, subject, html) {
    if (!this.enabled) {
      return;
    }
    this.transporter.sendMail({
      from: `PixelDays <${MAIL_ADDRESS}>`,
      to,
      replyTo: MAIL_ADDRESS,
      subject,
      html,
    }, (err) => {
      if (err) {
        logger.error(err);
      }
    });
  }

  postVerifyMail(to, name, host, lang, code) {
    const { t } = getTTag(lang);
    logger.info(`Sending verification mail to ${to} / ${name}`);
    const verifyUrl = `${host}/api/auth/verify?token=${code}&email=${encodeURIComponent(to)}`;
    const subject = t`Welcome ${name} to PixelDays, please verify your mail`;
    const html = `<em>${t`Hello ${name}`}</em>,<br />
      ${t`welcome to our little community of pixelplacers, to use your account, you have to verify your mail. You can do that here: `} <a href="${verifyUrl}">${t`Click to Verify`}</a>. ${t`Or by copying following url:`}<br />${verifyUrl}\n<br />
      ${t`Have fun and don't hesitate to contact us if you encounter any problems :)`}<br />
      ${t`Thanks`}<br /><br />
      <img alt="" src="https://pixelplanet.fun/tile.png" style="height:64px; width:64px" />`;
    this.sendMail(to, subject, html);
  }

  async sendVerifyMail(to, name, host, lang) {
    if (!this.enabled && !socketEvents.isCluster) {
      return null;
    }
    const { t } = getTTag(lang);

    const pastCodeAge = await codeExists(to);
    if (pastCodeAge && pastCodeAge < 180) {
      const minLeft = Math.ceil((180 - pastCodeAge) / 60);
      logger.info(
        `Verify mail for ${to} - already sent, ${minLeft} minutes left`,
      );
      return t`We already sent you a verification mail, you can request another one in ${minLeft} minutes.`;
    }

    const code = setCode(to);
    if (this.enabled) {
      this.postVerifyMail(to, name, host, lang, code);
    } else {
      socketEvents.sendMail('verify', [to, name, host, lang, code]);
    }
    return null;
  }

  postNewLocationMail(to, name, host, lang, ip) {
    const { t } = getTTag(lang);
    logger.info(`Send new location login mail to ${to} / ${name} by ${ip}`);
    const subject = t`Login from new location on PixelDays`;
    const html = `<em>${t`Hello ${name}`}</em>,<br />
${t`Someone logged into your account from a new location, with the IP:`} ${ip}<br />
${t`If this was you, please ignore this email. If it wasn't you, please go to <a href="https://pixelplanet.fun">pixelplanet.fun</a> and log-out any session that you are unaware of under "Login Methods" in the User Area and change your password.`}<br />
${t`Thanks`}<br /><br />
<img alt="" src="https://pixelplanet.fun/tile.png" style="height:64px; width:64px" />`;
    this.sendMail(to, subject, html);
  }

  async sendNewLocationMail(userId, host, lang, ip) {
    if (!this.endabled && !socketEvents.isCluster) {
      return null;
    }

    const [name, to] = await getMailAndNameOfUserId(userId);
    if (!to) {
      return null;
    }
    if (this.enabled) {
      this.postNewLocationMail(to, name, host, lang, ip);
    } else {
      socketEvents.sendMail('newloc', [to, name, host, lang, ip]);
    }
    return null;
  }

  postPasswdResetMail(to, ip, host, lang, code) {
    const { t } = getTTag(lang);
    logger.info(`Sending Password reset mail to ${to}`);
    const restoreUrl = `${host}/reset_password?token=${code}&email=${encodeURIComponent(to)}`;
    const subject = t`You forgot your password for PixelDays? Get a new one here`;
    const html = `<em>${t`Hello`}</em>,<br />
      ${t`You requested to get a new password. You can change your password within the next 30min here: `} <a href="${restoreUrl}">${t`Reset Password`}</a>. ${t`Or by copying following url:`}<br />${restoreUrl}\n<br />
      ${t`If you did not request this mail, please just ignore it (the ip that requested this mail was ${ip}).`}<br />
      ${t`Thanks`}<br /><br />\n<img alt="" src="https://pixelplanet.fun/tile.png" style="height:64px; width:64px" />`;
    this.sendMail(to, subject, html);
  }

  async sendPasswdResetMail(to, ip, host, lang) {
    const { t } = getTTag(lang);
    if (!this.enabled && !socketEvents.isCluster) {
      return t`Mail is not configured on the server`;
    }

    const pastCodeAge = await codeExists(to);
    if (pastCodeAge && pastCodeAge < 180) {
      logger.info(
        `Password reset mail for ${to} requested by ${ip} - already sent`,
      );
      return t`We already sent you a mail with instructions. Please wait before requesting another mail.`;
    }

    const userdata = await getUserByEmail(to);
    if (!userdata) {
      logger.info(
        `Password reset mail for ${to} requested by ${ip} - mail not found`,
      );
      return t`Couldn't find this mail in our database`;
    }

    const code = setCode(to);
    if (this.enabled) {
      this.postPasswdResetMail(to, ip, host, lang, code);
    } else {
      socketEvents.sendMail('pwreset', [to, ip, host, lang, code]);
    }
    return null;
  }

  static async verify(email, code) {
    const ret = await checkCode(email, code);
    if (!ret) {
      return false;
    }
    const userId = await verifyEmail(email);
    if (!userId) {
      logger.error(`${email} does not exist in database`);
    }
    return userId;
  }
}

const mailProvider = new MailProvider();

export default mailProvider;
