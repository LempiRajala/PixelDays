/**
 *
 */

import React, {
  useRef, useLayoutEffect, useState, useEffect, useCallback,
  useMemo,
} from 'react';
import useStayScrolled from 'react-stay-scrolled';
import { useSelector, useDispatch, shallowEqual } from 'react-redux';
import { t } from 'ttag';

import { useWindow } from '../context/window.ts';
import useLink from '../hooks/link.js';
import ContextMenu, { ContextMenuProps } from '../contextmenus/index.tsx';
import { ChatMessageGroup } from '../ChatMessageGroup.tsx';
import ChannelDropDown from '../contextmenus/ChannelDropDown.jsx';

import { CHANNEL_TYPES } from '../../core/constants.ts';

import {
  markChannelAsRead,
  sendChatMessage,
} from '../../store/actions/index.js';
import {
  fetchChatMessages,
} from '../../store/actions/thunks.js';
import type { State } from '../../store/store.ts';
import type { ChatState } from '../../store/reducers/chat.ts';
import { FaBullhorn } from "react-icons/fa6";

interface MessagesGroup {
  userId: number;
  username: string;
  country: string;
  messages: {
    createdAt: number;
    text: string;
  }[],
}

const Chat = () => {
  const listRef = useRef<HTMLUListElement | null>(null);
  const targetRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [blockedIds, setBlockedIds] = useState<number[]>([]);
  const [btnSize, setBtnSize] = useState(20);
  const [cmArgs, setCmArgs] = useState<ContextMenuProps | null>(null);

  const dispatch = useDispatch();

  const ownName = useSelector<State>(state => state.user!.name);
  const fetching = useSelector<State>(state => state.fetching!.fetchingChat);
  const { channels, messages, blocked } = useSelector<State>(state => state.chat) as ChatState;
  const userIdToAvatarId = useSelector<State>(state => state.chat.userIdToAvatarId, shallowEqual) as State['chat']['userIdToAvatarId'];

  const {
    args,
    setArgs,
    setTitle,
  } = useWindow();

  const chatChannel = args.chatChannel || 0;

  const link = useLink();

  const setChannel = useCallback((cid: string) => {
    dispatch(markChannelAsRead(cid));
    setArgs({
      chatChannel: Number(cid),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  const addToInput = useCallback((msg: string) => {
    const inputElem = inputRef.current;
    if (!inputElem) {
      return;
    }
    let newInputMessage = inputElem.value;
    if (newInputMessage.slice(-1) !== ' ') {
      newInputMessage += ' ';
    }
    newInputMessage += `${msg} `;
    inputElem.value = newInputMessage;
    inputRef.current?.focus();
  }, []);

  const closeCm = useCallback(() => {
    setCmArgs(null);
  }, []);

  const openUserCm = useCallback((x: number, y: number, name: string, uid: number) => {
    setCmArgs({
      type: 'USER',
      x,
      y,
      args: {
        name,
        uid,
        setChannel,
        addToInput,
      },
      close: closeCm,
    });
  }, [setChannel, addToInput]);

  const { stayScrolled } = useStayScrolled(listRef, {
    initialScroll: Infinity,
    inaccuracy: 10,
  });

  const channelMessages = messages[chatChannel] || [];
  useEffect(() => {
    if (channels[chatChannel] && !messages[chatChannel] && !fetching) {
      //@ts-expect-error
      dispatch(fetchChatMessages(chatChannel));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels, messages, chatChannel, fetching]);

  useEffect(() => {
    if (channels[chatChannel]) {
      const channelName = channels[chatChannel][0];
      setTitle(`Chan: ${channelName}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatChannel, channels]);

  useLayoutEffect(() => {
    stayScrolled();
  }, [channelMessages.length, stayScrolled]);

  useEffect(() => {
    setTimeout(() => {
      if(!targetRef.current) return;
      const fontSize = Math.round(targetRef.current.offsetHeight / 10);
      setBtnSize(Math.min(28, fontSize));
    }, 330);
  }, [targetRef]);

  useEffect(() => {
    const bl: number[] = [];
    for (let i = 0; i < blocked.length; i += 1) {
      bl.push(blocked[i][0]);
    }
    setBlockedIds(bl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocked.length]);

  const handleSubmit: React.FormEventHandler<HTMLFormElement> = evt => {
    evt.preventDefault();
    if(!inputRef.current) return;

    const inptMsg = inputRef.current.value.trim();
    if (!inptMsg) return;
    // send message via websocket
    dispatch(sendChatMessage(inptMsg, chatChannel));
    inputRef.current.value = '';
  }

  /*
   * if selected channel isn't in channel list anymore
   * for whatever reason (left faction etc.)
   * set channel to first available one
   */
  useEffect(() => {
    if (!chatChannel || !channels[chatChannel]) {
      let chosenChannel;
      for (const [cid, [name, type]] of Object.entries(channels)) {
        if (!chosenChannel) {
          chosenChannel = cid;
        }
        if (type === CHANNEL_TYPES.PUBLIC) {
          chosenChannel = cid;
          if (name === 'en') {
            chosenChannel = cid;
            break;
          }
        }
      }
      if (chosenChannel) {
        setChannel(chosenChannel);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels, chatChannel]);

  const messagesGroups = useMemo(() => {
    const formatted = channelMessages.map(msg => ({
      name: msg[0],
      text: msg[1],
      flag: msg[2],
      userId: msg[3],
      createdAt: msg[4],
    }));
    const notBlocked = formatted.filter(msg => !blockedIds.includes(msg.userId));
    
    const groups: MessagesGroup[] = [];
    notBlocked.forEach(msg => {
      const messageToAdd = {
        createdAt: msg.createdAt,
        text: msg.text,
      }
      const lastGroup = groups.at(-1);
      if(lastGroup && lastGroup.userId === msg.userId) {
        lastGroup.messages.push(messageToAdd);
      } else {
        groups.push({
          userId: msg.userId,
          country: msg.flag,
          username: msg.name,
          messages: [messageToAdd],
        });
      }
    });
    // console.warn(channelMessages);
    // console.warn(groups);
    return groups;
  }, [channelMessages, blockedIds]);

  return (
    <div
      ref={targetRef}
      className="chat-container"
    >
      { cmArgs &&
        // TODO wtf happening in this code
        // @ts-expect-error
        <ContextMenu
          type={cmArgs.type}
          x={cmArgs.x}
          y={cmArgs.y}
          args={cmArgs.args}
          close={cmArgs.close}
          align={cmArgs.align}
        />
      }
      <ul
        className="chatarea"
        ref={listRef}
        style={{ flexGrow: 1 }}
        role="presentation"
      >
        {/* { !channelMessages.length === 0 &&
          <ChatMessageGroup
            userId={0}
            name="info"
            msg={t`Start chatting here`}
          />
        } */}
        {
          messagesGroups.map((group, i) => 
            <ChatMessageGroup
              key={i}
              country={group.country}
              avatarId={
                group.userId in userIdToAvatarId
                ? userIdToAvatarId[group.userId]
                : null
              }
              name={group.username}
              userId={group.userId}
              messages={group.messages}
              openCm={openUserCm}
            />
          )
        }
      </ul>
      <form
        key="chatinputform"
        className="chatinput"
        onSubmit={(e) => handleSubmit(e)}
        style={{
          display: 'flex',
        }}
      >
        {(ownName) ? (
          <React.Fragment key="chtipt">
            <input
              key="chtiptinput"
              style={{
                flexGrow: 1,
                minWidth: 40,
              }}
              ref={inputRef}
              autoComplete="off"
              maxLength={200}
              type="text"
              className="chtipt"
              placeholder={t`Chat here`}
            />
            <button
              id="sendbtn"
              style={{ flexGrow: 0 }}
              type="submit"
            >
              ‣
            </button>
          </React.Fragment>
        ) : (
          <div
            key="chtiptmodal"
            className="modallink"
            key="nlipt"
            onClick={(evt) => {
              evt.stopPropagation();
              link('USERAREA', { target: 'parent' });
            }}
            style={{
              textAlign: 'center',
              fontSize: 13,
              flexGrow: 1,
            }}
            role="button"
            tabIndex={0}
          >
            {t`You must be logged in to chat`}
          </div>
        )}
        <ChannelDropDown
          key="cdd"
          setChatChannel={setChannel}
          chatChannel={chatChannel}
        />
        <div
          key="reportbtn"
          className='channelbtn'
          role="button"
          tabIndex={-1}
          onClick={e => {
            e.stopPropagation();
            link('REPORT_FORM', { target: 'parent', width: 500, height: 500 });
          }}
          style={{
            width: 'fit-content',
            paddingLeft: '8px',
            paddingRight: '8px',
          }}
        >
          <FaBullhorn />
        </div>
      </form>
      <div
        className="chatlink"
        style={{
          fontSize: btnSize,
        }}
      >
        <span
          onClick={(event) => {
            setCmArgs({
              type: 'CHANNEL',
              x: event.clientX,
              y: event.clientY,
              args: { cid: chatChannel },
              align: 'tr',
              close: closeCm,
            });
          }}
          role="button"
          title={t`Channel settings`}
          tabIndex={-1}
        >⚙</span>
      </div>
    </div>
  );
};

export default Chat;
