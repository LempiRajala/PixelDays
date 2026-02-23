import React, { type CSSProperties } from "react";
import type { User } from "../db/schema";
import { getFileUrl } from "../core/client-utils";
import { CgProfile } from "react-icons/cg";

const avatarStyle: CSSProperties = {
  gridColumnStart: 1,
  width: '32px',
  height: '32px',
  borderRadius: '9999px',
  overflow: 'hidden',
}

type Props = {
  avatarId: User['avatarId'];
} | {
  src: string;
}

export function SmallAvatar(props: Props) {
  let imgSource: string | null;
  if('avatarId' in props) {
    if(props.avatarId) {
      imgSource = getFileUrl(props.avatarId);
    } else {
      imgSource = null;
    }
  } else {
    imgSource = props.src;
  }

  return (
    <div style={avatarStyle}>
      { imgSource &&
        <img
          alt={`${name} avatar`}
          src={imgSource}
          width={32}
          height={32}
        />
      }
      { !imgSource &&
        <CgProfile
          size={32}
        />
      }
    </div>
  )
}