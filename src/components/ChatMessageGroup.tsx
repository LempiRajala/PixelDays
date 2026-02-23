import React, { type CSSProperties, useRef } from 'react';
import { useSelector } from 'react-redux';

import MdParagraph from './markdown/MdParagraph.tsx';
import {
  colorFromText,
  setBrightness,
  getDateTimeString,
} from '../core/utils.js';
import { selectIsDarkMode } from '../store/selectors/gui.ts';
import { cdn } from '../utils/utag.js';
import { SmallAvatar } from './small-avatar.tsx';

const containerStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '32px 1fr',
  fontSize: '13px',
  userSelect: 'text',
  padding: '3px 0 3px 2px',
  gap: '8px',
}

const headerStyle: CSSProperties = {
  display: 'inline-flex',
  gap: '4px',
}

const flagStyle: CSSProperties = {
  width: '16px',
  height: '11px',
  placeSelf: 'center',
}

const contentStyle: CSSProperties = {
  gridColumnStart: 2,
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
}

const messageStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'auto 1fr',
}

const ChatMessageGroup = React.memo(({
  name,
  avatarId,
  userId,
  country,
  messages,
  openCm,
}: {
  name: string;
  avatarId: string | null;
  userId: number;
  country: string;
  messages: { createdAt: number, text: string }[];
  openCm: (x: number, y: number, name: string, uid: number) => void;
}) => {
  const isDarkMode = useSelector(selectIsDarkMode);
  const refEmbed = useRef<HTMLLIElement | null>(null);

  // const isInfo = (name === 'info');
  // const isEvent = (name === 'event');
  // let className = 'msg';
  // if (isInfo) {
  //   className += ' info';
  // } else if (isEvent) {
  //   className += ' event';
  // } else if (msg.charAt(0) === '>') {
  //   className += ' greentext';
  // } else if (msg.charAt(0) === '<') {
  //   className += ' redtext';
  // }

  const isServiceAccount = userId < 4;

  return (
    <li style={containerStyle} ref={refEmbed}>
      { isServiceAccount &&
        <SmallAvatar src={cdn`/service-account-avatar.webp`}/>
      }
      { !isServiceAccount &&
        <SmallAvatar avatarId={avatarId}/>
      }
      <div style={contentStyle}>
        <span
          style={{
            ...headerStyle,
            ...(isServiceAccount ? {} : { cursor: 'pointer' })
          }}
          role="button"
          tabIndex={-1}
          onClick={(event) => {
            if(isServiceAccount) return;
            openCm(event.clientX, event.clientY, name, userId);
          }}
        >
          <span
            className="chatname"
            style={{
              color: setBrightness(colorFromText(name), isDarkMode),
            }}
            title={name}
          >
            {name}
          </span>
          { !isServiceAccount &&
            <img
              style={flagStyle}
              alt="flag icon"
              title={country}
              src={cdn`/cf/${country}.gif`}
            />
          }
        </span>
        {
          messages.map(({ text, createdAt }, i) => (
            <div style={messageStyle} key={i}>
              <div>
                <MdParagraph
                  refEmbed={refEmbed}
                  text={text}
                />
                <span className="chatts">
                  {getDateTimeString(createdAt)}
                </span>
              </div>
            </div>
          ))
        }
      </div>
    </li>
  );
});

ChatMessageGroup.displayName = 'ChatMessageGroup';

export { ChatMessageGroup };