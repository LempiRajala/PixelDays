/*
 * Menu to change user credentials
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useSelector, shallowEqual, useDispatch } from 'react-redux';
import { t } from 'ttag';

import UserMessages from './UserMessages.jsx';
import FishList from './FishList.jsx';
import BadgeList from './BadgeList.jsx';
import ChangePassword from './ChangePassword.jsx';
import ChangeName from './ChangeName.jsx';
import ChangeUsername from './ChangeUsername.jsx';
import ChangeMail from './ChangeMail.jsx';
import DeleteAccount from './DeleteAccount.jsx';
import LogInForm from './LogInForm.jsx';
import SocialSettings from './SocialSettings';
import { logoutUser } from '../store/actions/index.js';
import { requestLogOut } from '../store/actions/fetch.js';
import { numberToString } from '../core/utils.js';
import { selectIsDarkMode } from '../store/selectors/gui.ts';
import { fetchProfile } from '../store/actions/thunks.js';
import { getFileUrl } from '../core/client-utils.ts';
import { avatarSizeAfterUploading } from '../core/constants.ts';

const AREAS = {
  CHANGE_NAME: ChangeName,
  CHANGE_USERNAME: ChangeUsername,
  CHANGE_MAIL: ChangeMail,
  CHANGE_PASSWORD: ChangePassword,
  DELETE_ACCOUNT: DeleteAccount,
  SOCIAL_SETTINGS: SocialSettings,
};

const Stat = ({
  text, value, rank, zero,
}) => (
  <p>
    <span className="stattext">{(rank) ? `${text}: #` : `${text}: `}</span>
    &nbsp;
    <span className="statvalue">{numberToString(value, zero)}</span>
  </p>
);

const UserAreaContent = () => {
  const user = useSelector(state => state.user, shallowEqual);
  const [area, setArea] = useState('NONE');

  const dispatch = useDispatch();
  const logout = useCallback(async () => {
    const ret = await requestLogOut();
    if (ret) {
      dispatch(logoutUser());
    }
  }, [dispatch]);

  const isDarkMode = useSelector(selectIsDarkMode);
  const lastProfileFetch = useSelector((state) => state.profile.lastFetch);
  const [
    name,
    havePassword,
    username,
  ] = useSelector((state) => [
    state.user.name,
    state.user.havePassword,
    state.user.username,
  ], shallowEqual);
  const [
    totalPixels,
    dailyTotalPixels,
    ranking,
    dailyRanking,
  ] = useSelector((state) => [
    state.ranks.totalPixels,
    state.ranks.dailyTotalPixels,
    state.ranks.ranking,
    state.ranks.dailyRanking,
  ], shallowEqual);

  useEffect(() => {
    if (username && Date.now() - 600000 > lastProfileFetch) {
      dispatch(fetchProfile());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastProfileFetch, username]);

  if (!name) {
    return <LogInForm title={t`Login to access more features and stats.`} />;
  }

  const Area = AREAS[area];

  return (
    <div className="content">
      <UserMessages />
      <div style={{
        display: 'grid',
        gridTemplateColumns: user.avatarId ? '1fr 1fr' : '1fr',
      }}>
        { user.avatarId !== null &&
          <img
            src={getFileUrl(user.avatarId)}
            alt="avatar"
            style={{
              width: `${avatarSizeAfterUploading}px`,
              height: `${avatarSizeAfterUploading}px`,
              borderRadius: '9999px',
              boxShadow: '0 0 5px black',
              border: '1px solid black',
            }}
          />
        }
        <div style={{
          alignSelf: 'center',
          textAlign: user.avatarId ? 'start' : 'center',
        }}>
          <Stat
            text={t`Today Placed Pixels`}
            value={dailyTotalPixels}
          />
          <Stat
            text={t`Daily Rank`}
            value={dailyRanking}
            zero="N/A"
            rank
          />
          <Stat
            text={t`Placed Pixels`}
            value={totalPixels}
          />
          <Stat
            text={t`Total Rank`}
            value={ranking}
            zero="N/A"
            rank
          />
        </div>
      </div>
      <BadgeList />
      <FishList />
      <div>
        <p>
          {t`Your name is:`}<span className="statvalue">{` ${name} `}</span>
          [{` ${username} `}]
        </p>(
        <span
          role="button"
          tabIndex={-1}
          className="modallink"
          onClick={logout}
        > {t`Log out`}</span>
        <span className="hdivider" />
        <span
          role="button"
          tabIndex={-1}
          className="modallink"
          onClick={() => setArea('CHANGE_NAME')}
        > {t`Change Name`}</span>
        <span className="hdivider" />
        {(username.startsWith('pp_')) && (
          <React.Fragment key="choseun">
            <span
              role="button"
              tabIndex={-1}
              style={{
                fontWeight: 'bold',
                color: (isDarkMode) ? '#fcff4b' : '#8f270d',
              }}
              className="modallink"
              onClick={() => setArea('CHANGE_USERNAME')}
            > {t`Choose Username`}</span>
            <span className="hdivider" />
          </React.Fragment>
        )}
        <span
          role="button"
          tabIndex={-1}
          className="modallink"
          onClick={() => setArea('CHANGE_MAIL')}
        > {t`Login Methods`}</span>
        <span className="hdivider" />
        <span
          role="button"
          tabIndex={-1}
          style={(havePassword) ? {} : {
            fontWeight: 'bold',
            color: (isDarkMode) ? '#fcff4b' : '#8f270d',
          }}
          className="modallink"
          onClick={() => setArea('CHANGE_PASSWORD')}
        > {(havePassword) ? t`Change Password` : t`Set Password`}</span>
        <span className="hdivider" />
        <span
          role="button"
          tabIndex={-1}
          className="modallink"
          onClick={() => setArea('DELETE_ACCOUNT')}
        > {t`Delete Account`}</span> )
        <br />(
        <span
          role="button"
          tabIndex={-1}
          className="modallink"
          onClick={() => setArea('SOCIAL_SETTINGS')}
        > {t`Social Settings`}</span> )
      </div>
      {(Area) && <Area key="area" done={() => setArea(null)} />}
    </div>
  );
};

export default React.memo(UserAreaContent);
