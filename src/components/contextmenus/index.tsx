import React, { ComponentProps, type CSSProperties, useRef } from 'react';
import { createPortal } from 'react-dom';

import UserContextMenu from './UserContextMenu.tsx';
import ChannelContextMenu from './ChannelContextMenu.tsx';
import {
  useClickOutside,
} from '../hooks/clickOutside.js';

export const types = {
  USER: UserContextMenu,
  CHANNEL: ChannelContextMenu,
};

type BaseProps = {
  x: number;
  y: number;
  close: () => void;
  align?: string;
}

export type ContextMenuProps = (
  (BaseProps & {
    type: 'USER';
    args: ComponentProps<typeof UserContextMenu>['args'];
  }) | 
  (BaseProps & {
    type: 'CHANNEL';
    args: ComponentProps<typeof ChannelContextMenu>['args']
  })
)

const ContextMenu = ({
  type,
  x,
  y,
  args,
  close,
  align,
}: ContextMenuProps) => {
  const wrapperRef = useRef(null);

  useClickOutside([wrapperRef], close);

  if (!type) {
    return null;
  }

  const style: CSSProperties = {};
  switch (align) {
    case 'tr': {
      style.right = window.innerWidth - x;
      style.top = y;
      break;
    }
    case 'br': {
      style.right = window.innerWidth - x;
      style.bottom = window.innerHeight - y;
      break;
    }
    case 'bl': {
      style.left = x;
      style.bottom = window.innerHeight - y;
      break;
    }
    default: {
      // also 'tl'
      style.left = x;
      style.top = y;
    }
  }

  return createPortal((
    <div
      ref={wrapperRef}
      className={`contextmenu ${type}`}
      style={style}
    >
      { type === 'USER' &&
        <UserContextMenu close={close} args={args}/>
      }
      { type === 'CHANNEL' &&
        <ChannelContextMenu close={close} args={args}/>
      }
    </div>
  ), document.getElementById('app')!);
};

export default React.memo(ContextMenu);
