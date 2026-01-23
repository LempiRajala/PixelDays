/*
 *
 */

import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { t } from 'ttag';

import {
  muteChatChannel,
  unmuteChatChannel,
} from '../../store/actions/index.js';
import {
  setLeaveChannel,
} from '../../store/actions/thunks.js';
import { State } from '../../store/store.js';
import { ChatState } from '../../store/reducers/chat.js';

/*
 * args: {
 *   cid,
 * }
 */
const ChannelContextMenu = ({
  args,
  close,
}: {
  args: {
    cid: string;
  },
  close: () => void;
}) => {
  const channels = useSelector<State>((state) => state.chat.channels) as ChatState['channels'];
  const muteArr = useSelector<State>((state) => state.chatRead!.mute) as Required<State>['chatRead']['mute'];

  const { cid } = args;
  const dispatch = useDispatch();

  // @ts-expect-error
  const isMuted = muteArr.includes(cid);

  return (
    <>
      <div
        role="button"
        key="mute"
        onClick={() => {
          if (isMuted) {
            dispatch(unmuteChatChannel(cid));
          } else {
            dispatch(muteChatChannel(cid));
          }
        }}
        tabIndex={0}
        style={{ borderTop: 'none' }}
      >
        {`${(isMuted) ? '✔' : '✘'} ${t`Mute`}`}
      </div>
      {(channels[cid][1] !== 0)
        && (
        <div
          key="leave"
          role="button"
          onClick={() => {
            // @ts-expect-error
            dispatch(setLeaveChannel(cid));
            close();
          }}
          tabIndex={0}
        >
          {t`Close`}
        </div>
        )}
    </>
  );
};

export default React.memo(ChannelContextMenu);
