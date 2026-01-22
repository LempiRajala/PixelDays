import React from 'react';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import { t } from 'ttag';

import DeleteList from '../DeleteList.jsx';

import {
  setBlockingDm,
  setPrivatize,
  setUserBlock,
} from '../../store/actions/thunks.js';
import SettingsItem from '../SettingsItem.tsx';
import type { State } from '@/store/store.js';
import { AvatarUpdateForm } from './avatar-update-form.tsx';
import { BannerUpdateForm } from './banner-update-form.tsx';

/* eslint-disable max-len */
const SocialSettings = ({
  done,
}: {
  done: () => void;
}) => {
  const blocked = useSelector<State>(state => state.chat.blocked, shallowEqual) as State['chat']['blocked'];
  const blockDm = useSelector<State>(state => state.user.blockDm, shallowEqual) as State['user']['blockDm'];
  const priv = useSelector<State>(state => state.user.priv, shallowEqual) as State['user']['priv'];
  const fetching = useSelector<State>(state => state.fetching.fetchingApi, shallowEqual) as State['fetching']['fetchingApi'];
  const dispatch = useDispatch();

  return (
    <div className="inarea">
      <SettingsItem
        title={t`Block DMs`}
        value={blockDm}
        onToggle={() => {
          if (!fetching) {
            //@ts-expect-error
            dispatch(setBlockingDm(!blockDm));
          }
        }}
      >
        {t`Block all Private Messages. Enabling this will delete all your current DMs. You can still start new DMs with other users, but other users won't be able to start DMs with you.`}
      </SettingsItem>
      <SettingsItem
        title={t`Private`}
        value={priv}
        onToggle={() => {
          if (!fetching) {
            //@ts-expect-error
            dispatch(setPrivatize(!priv));
          }
        }}
      >
        {t`Don't show me in global stats`}
      </SettingsItem>
      <h3
        style={{
          textAlign: 'left',
          marginLeft: 10,
        }}
      >
        {t`Unblock Users`}
      </h3>
      { blocked.length !== 0 &&
        //@ts-expect-error
        <DeleteList
          list={blocked}
          //@ts-expect-error
          callback={(id, name) => {
            if (!fetching) {
              //@ts-expect-error
              dispatch(setUserBlock(id, name, false));
            }
          }}
          enabled={!fetching}
        />
      }
      { blocked.length === 0 &&
        <p>{t`You have no users blocked`}</p>
      }
      <div className="modaldivider" />
      <BannerUpdateForm
        style={{
          marginTop: '16px',
        }}
      />
      <div className="modaldivider" />
      <AvatarUpdateForm style={{
        marginTop: '16px',
      }}/>
      <div className="modaldivider" />
      <button
        type="button"
        onClick={done}
        style={{ margin: 10 }}
      >
        Done
      </button>
    </div>
  );
};

export default React.memo(SocialSettings);
