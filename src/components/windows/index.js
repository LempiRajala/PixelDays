import { t } from 'ttag';

import Help from './Help.jsx';
import Settings from './Settings.jsx';
import UserArea from './UserArea.jsx';
import CanvasSelect from './CanvasSelect.jsx';
import Archive from './Archive.jsx';
import Chat from './Chat.tsx';
import Player from './Player.jsx';
import FishDisplay from './FishDisplay.jsx';
import BadgeDisplay from './BadgeDisplay.jsx';
import OIDCConsent from './OIDCConsent.jsx';
import Profile from './Profile.tsx';

export default {
  HELP: [Help, t`Help`],
  SETTINGS: [Settings, t`Settings`],
  USERAREA: [UserArea, t`User Area`],
  CHAT: [Chat, t`Chat`],
  CANVAS_SELECTION: [CanvasSelect, t`Canvas Selection`],
  ARCHIVE: [Archive, t`Canvas Archive`],
  PLAYER: [Player, t`Player`],
  FISH_DISPLAY: [FishDisplay, t`Fish Display`],
  BADGE_DISPLAY: [BadgeDisplay, t`Badge Display`],
  PROFILE: [Profile, t`User profile`],
  /*
   * OIDC Consent is a very special case, because it is only available as
   * seperate popup, hoever, this is a single-page-applications, so we include
   * it everywhere.
   * Maybe some React.lazy to lazyload things would be good, but OIDC requests
   * shouldn't be slow.
   * It's also not in AVAILABLE_POPUPS, but rather gets served sepeartely by
   * the /oidc route and it can not work without window.ssv.params.
   *
   * Maybe every single window should be lazy loaded and we additional set the
   * current script in popupHtml?
   */
  OIDC: [OIDCConsent, t`OIDC LogIn`],
  /* other windows */
};

/*
 * NOTE:
 * set windows that should be accessible via popup / url
 * also in ../../core/constants.ts
 */
