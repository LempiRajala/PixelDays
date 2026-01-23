import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { t } from 'ttag';

import {
  startDm,
  setUserBlock,
} from '../../store/actions/thunks.js';
import { escapeMd } from '../../core/utils.js';
import type { State } from '../../store/store.js';
import type { ChatState } from '../../store/reducers/chat.js';
import useLink from '../hooks/link.js';

/*
 * args: {
 *   name,
 *   uid,
 *   setChannel,
 *   addToInput,
 * }
 */
const UserContextMenu = ({
  args,
  close,
}: {
  args: {
    name: string;
    uid: number;
    setChannel: any;
    addToInput: any;
  };
  close: () => void;
}) => {
  const link = useLink();
  const channels = useSelector<State>((state) => state.chat.channels) as ChatState['channels'];
  const fetching = useSelector<State>((state) => state.fetching!.fetchingApi) as Required<State>['fetching'];

  const dispatch = useDispatch();

  const {
    name,
    uid,
    setChannel,
    addToInput,
  } = args;

  return (
    <>
      <div
        role="button"
        key="profile"
        tabIndex={0}
        onClick={() => {
          link('PROFILE', {
            target: 'parent',
            args: { userId: uid },
            width: 780,
            height: 301,
          });
        }}
        style={{ borderTop: 'none' }}
      >
        {t`Profile`}
      </div>
      <div
        role="button"
        key="ping"
        tabIndex={0}
        onClick={() => {
          const ping = `@[${escapeMd(name)}](${uid})`;
          addToInput(ping);
          close();
        }}
        style={{ borderTop: 'none' }}
      >
        {t`Ping`}
      </div>
      <div
        role="button"
        key="dm"
        tabIndex={0}
        onClick={() => {
          /*
           * if dm channel already exists,
           * just switch
           */
          const cids = Object.keys(channels);
          for (let i = 0; i < cids.length; i += 1) {
            const cid = cids[i];
            if (channels[cid].length === 4 && channels[cid][3] === uid) {
              setChannel(cid);
              close();
              return;
            }
          }
          if (!fetching) {
            // @ts-expect-error
            dispatch(startDm({ userId: uid }, setChannel));
          }
          close();
        }}
      >
        {t`DM`}
      </div>
      <div
        role="button"
        key="block"
        tabIndex={-1}
        onClick={() => {
          // @ts-expect-error
          dispatch(setUserBlock(uid, name, true));
          close();
        }}
      >
        {t`Block`}
      </div>
    </>
  );
};

export default React.memo(UserContextMenu);
