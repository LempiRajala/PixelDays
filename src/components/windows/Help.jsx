/**
 *
 */

import React, { useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { c, t, jt } from 'ttag';
import { GiMouse } from 'react-icons/gi';
import { MdTouchApp } from 'react-icons/md';

import GetIID from '../GetIID.jsx';
import ClipboardCopyField from '../ClipboardCopyField.jsx';
import useLongPress from '../hooks/useLongPress.js';
import { toggleEasterEgg } from '../../store/actions/index.js';
import { notify } from '../../store/actions/thunks.js';
import { cdn, u } from '../../utils/utag.js';

/* eslint-disable max-len */

const Help = () => {
  const bindG = <kbd>{c('keybinds').t`G`}</kbd>;
  const bindX = <kbd>{c('keybinds').t`X`}</kbd>;
  const bindH = <kbd>{c('keybinds').t`H`}</kbd>;
  const bindR = <kbd>{c('keybinds').t`R`}</kbd>;
  const bindQ = <kbd>{c('keybinds').t`Q`}</kbd>;
  const bindE = <kbd>{c('keybinds').t`E`}</kbd>;
  const bindW = <kbd>{c('keybinds').t`W`}</kbd>;
  const bindA = <kbd>{c('keybinds').t`A`}</kbd>;
  const bindS = <kbd>{c('keybinds').t`S`}</kbd>;
  const bindD = <kbd>{c('keybinds').t`D`}</kbd>;
  const bindAUp = <kbd>↑</kbd>;
  const bindALeft = <kbd>←</kbd>;
  const bindADown = <kbd>↓</kbd>;
  const bindARight = <kbd>→</kbd>;
  const mouseSymbol = <kbd><GiMouse /></kbd>;
  const touchSymbol = <kbd><MdTouchApp /></kbd>;
  const bindShift = <kbd>⇧ {c('keybinds').t`Shift`}</kbd>;

  const starhouseLink = <a href="https://twitter.com/starhousedev">starhouse </a>;
  const vinikLink = <a href="https://twitter.com/Vinikdev">Vinikdev</a>;
  const donendoLink = <a href="https://lospec.com/palette-list/lava-gb">Do-Nendo</a>;
  const guildedLink = <a href="/guilded">matrix space</a>;
  const mailLink = <a href={`mailto:${window.ssv.contactAddress}`}>{window.ssv.contactAddress}</a>;
  const agplLink = <a href="http://www.gnu.org/licenses/agpl-3.0.html">AGPLv3</a>;

  const dispatch = useDispatch();
  const easterEgg = useSelector((state) => state.gui.easterEgg);
  const userId = useSelector((state) => state.user.id);

  const onLongPress = useCallback(() => {
    dispatch(toggleEasterEgg());
    dispatch(notify((easterEgg)
      ? t`Easter Egg OFF`
      : t`Easter Egg ON`));
  }, [easterEgg, dispatch]);
  const refCallback = useLongPress(null, onLongPress, 1000);

  const sourceUrl = `${cdn`/legal/` + process.env.PKG_NAME}-${process.env.PKG_VERSION}-source.zip`;

  return (
    <div className="content">
      <img
        style={{
          padding: 2, maxWidth: '20%', verticalAlign: 'middle', display: 'inline-block',
        }}
        alt="ppfun"
        src={cdn`/logo.png`}
        ref={refCallback}
       />
      <p>{t`PixelDays is a pixel game for you to have fun with your friends, create art, countries, factions, expand, and wage war against other nations!`}</p>
      <p>{t`PixelDays stands out among its competitors because it has less harassment, discrimination, and almost complete freedom of speech.`}</p>
      <br/>
      <p>{t`Here's some information about us`}:</p>
      <p style={{ paddingLeft: '10px' }}>1) {t`We guarantee freedom of expression in our project. There is almost no harassment from moderation for your stance or ideals.`}</p>
      <p style={{ paddingLeft: '10px' }}>2) {t`We do not allow moderation to abuse its authority. For example, if a moderator is Russian or Ukrainian, they should not be more loyal to their own country than to players from other factions.`}</p>
      <p style={{ paddingLeft: '10px' }}>3) {t`We listen to the players' opinions and try to implement their ideas and ambitions. You help us to become better!`}</p>

      <p>{t`Our main canvas is a huge world map, you can draw your art, build your countries and create the history of our site!`}</p>
      <p>{t`The cooldown on the site is 1/2, the reserve of pixels (recharge) - 120 seconds.`}</p>

      <p>{t`PixelDays is an experiment in the world of pixels to find out what will happen if you give a person the right to self-expression, bypassing censorship and control from the administration. Most websites persecute people for their views and punish them severely, even to the point of wiping out an entire country.`}</p>

      <p> {t`Find out more about us in our channels`}: </p>
      <p> {t`Telegram`} <a rel="noopener noreferrer" target="_blank" href="https://t.me/pixeldaysfun">https://t.me/pixeldaysfun</a> </p>
      <p> {t`Discord`} <a rel="noopener noreferrer" target="_blank" href="https://dsc.gg/pixeldays">https://dsc.gg/pixeldays</a> </p>

      <p> {t`Source for pixeldays on`} <a rel="noopener noreferrer" target="_blank" href="https://github.com/LempiRajala/PixelDays">https://github.com/LempiRajala/PixelDays</a> </p>
        
      <h3>{t`Identifiers`}</h3>
      <p>{t`If you talk to moderators or administrators, you might get asked for one of the following identifiers:`}</p>
      <p>IID</p>
      <GetIID />
      {(userId > 0) && (
        <React.Fragment key="cui">
          <p>UID</p>
          <p><ClipboardCopyField text={userId} /></p>
        </React.Fragment>
      )}
      <h3>2D {t`Controls`}</h3>
      <div style={{ lineHeight: 1.5 }}>
        {t`Click a color in palette to select it`}<br />
        {jt`Press ${bindG} to toggle grid`}<br />
        {jt`Press ${bindX} to toggle showing of pixel activity`}<br />
        {jt`Press ${bindH} to toggle historical view`}<br />
        {jt`Press ${bindR} to copy coordinates`}<br />
        {jt`Press ${bindQ} or ${bindE} to zoom`}<br />
        {jt`Press ${bindW}, ${bindA}, ${bindS}, ${bindD} to move`}<br />
        {jt`Press ${bindAUp}, ${bindALeft}, ${bindADown}, ${bindARight} to move`}<br />
        {jt`Drag ${mouseSymbol} mouse or ${touchSymbol} pan to move`}<br />
        {jt`Scroll ${mouseSymbol} mouse wheel or ${touchSymbol} pinch to zoom`}<br />
        {jt`Hold left ${bindShift} for pencil (to place while moving mouse)`}<br />
        {jt`${mouseSymbol} Left click or ${touchSymbol} tap to place a pixel`}<br />
        {jt`Click ${mouseSymbol} middle mouse button or ${touchSymbol} long-tap to select current hovering color`}<br />
      </div>
      <h3>3D {t`Controls`}</h3>
      <div style={{ lineHeight: 1.5 }}>
        {jt`Press ${bindW}, ${bindA}, ${bindS}, ${bindD} to move`}<br />
        {jt`Press ${bindAUp}, ${bindALeft}, ${bindADown}, ${bindARight} to move`}<br />
        {jt`Press ${bindQ} and ${bindE} to fly up and down`}<br />
        {jt`${mouseSymbol} Hold left mouse button and drag mouse to rotate`}<br />
        {jt`${mouseSymbol} Scroll mouse wheel or hold ${mouseSymbol} middle mouse button and drag to zoom`}<br />
        {jt`${mouseSymbol} Right click and drag mouse to pan`}<br />
        {jt`${mouseSymbol} Left click or ${touchSymbol} tap to place a pixel`}<br />
        {jt`${mouseSymbol} Right click or ${touchSymbol} double-tap to remove a pixel`}<br />
        {jt`Click ${mouseSymbol} middle mouse button or ${touchSymbol} long-tap to select current hovering color`}<br />
      </div>
      <h3>{t`For Developers`}</h3>
      <p>{t`You can connect to pixeldays and use pixeldays accounts for oauth / oidc login. See here:`}<a href={u`/oidc/register`}>{t`OpenID Connect Client registration`}</a></p>
    </div>
  );
};

export default Help;
