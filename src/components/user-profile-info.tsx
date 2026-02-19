import React, { type CSSProperties, Fragment, memo, useId, useMemo, useRef } from "react"
import { getFileUrl } from "../core/client-utils";
import { avatarSizeAfterUploading } from "../core/constants";
import { numberToString } from '../core/utils.js';
import type { UnmarshalledUser } from "../db/schema";
import { t } from "ttag";
import { useElementWidth } from "./hooks/useElementWidth.ts";

interface Props extends
  Pick<UnmarshalledUser, 'avatarId' | 'bannerId' | 'username'>,
  Partial<Pick<UnmarshalledUser, 'lastSeen' | 'createdAt'>>
{
  dailyTotalPixels?: number;
  dailyRanking?: number;
  totalPixels?: number;
  ranking?: number;
}

export const UserProfileInfo = memo<Props>(({
  username,
  dailyTotalPixels,
  dailyRanking,
  totalPixels,
  ranking,
  avatarId,
  bannerId,
  createdAt,
  lastSeen,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useElementWidth(containerRef);

  const containerStyle = useMemo(() => {
    const renderInCompactWay = containerWidth ? containerWidth <= 600 : false;

    const style: CSSProperties = {
      display: 'grid',
      position: 'relative',
    }

    if(avatarId) {
      if(renderInCompactWay) {
        style.gridTemplateRows = '1fr 1fr';
      } else {
        style.gridTemplateColumns = '1fr 1fr';
      }
    } else {
      style.gridTemplateColumns = '1fr';
    }
  
    return style;
  }, [avatarId, containerWidth]);

  const hasBanner = bannerId !== null;

  return (
    <div ref={containerRef} style={containerStyle}>
      { bannerId !== null &&
        <div style={{
          width: 'calc(100% + 16px)',
          height: 'calc(100% + 16px)',
          overflow: 'hidden',
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          borderRadius: '8px',
          zIndex: 0,
        }}>
          <img
            src={getFileUrl(bannerId)}
            alt="banner"
            style={{
              objectFit: 'cover',
              width: '100%',
              height: '100%',
            }}
          />
        </div>
      }
      { avatarId !== null &&
        <img
          src={getFileUrl(avatarId)}
          alt="avatar"
          style={{
            aspectRatio: '1/1',
            width: `${avatarSizeAfterUploading}px`,
            maxWidth: '100%',
            borderRadius: '9999px',
            boxShadow: '0 0 5px black',
            border: '1px solid black',
            zIndex: 1,
          }}
        />
      }
      <div style={{
        alignSelf: 'center',
        textAlign: avatarId ? 'start' : 'center',
        zIndex: 1,
      }}>
        <InfoLine
          key={0}
          bannerStyled={hasBanner}
          label={t`Username`}
          value={username}
        />
        { createdAt &&
          <InfoLine
            key={1}
            bannerStyled={hasBanner}
            label={t`Registered`}
            value={createdAt}
          />
        }
        { lastSeen &&
          <InfoLine
            key={2}
            bannerStyled={hasBanner}
            label={t`Last login`}
            value={lastSeen}
          />
        }
        { dailyTotalPixels !== undefined &&
          <InfoLine
            key={3}
            bannerStyled={hasBanner}
            label={t`Today Placed Pixels`}
            value={dailyTotalPixels}
          />
        }
        { dailyRanking !== undefined &&
          <InfoLine
            key={4}
            bannerStyled={hasBanner}
            label={t`Daily Rank`}
            value={dailyRanking}
            zero="N/A"
            rank
          />
        }
        { totalPixels !== undefined &&
          <InfoLine
            key={5}
            bannerStyled={hasBanner}
            label={t`Placed Pixels`}
            value={totalPixels}
          />
        }
        { ranking !== undefined &&
          <InfoLine
            key={6}
            bannerStyled={hasBanner}
            label={t`Total Rank`}
            value={ranking}
            zero="N/A"
            rank
          />
        }
      </div>
    </div>
  )
});

UserProfileInfo.displayName = 'UserProfileInfo';

function InfoLine({
  label,
  value,
  rank,
  zero,
  bannerStyled,
}: {
  label?: string,
  value?: number | string | Date;
  rank?: boolean;
  zero?: string,
  bannerStyled: boolean;
}) {
  const id = useId();
  return (
    <p key={id} style={bannerStyled ? {
      background: 'white',
      boxShadow: '0 0 4px black',
      borderRadius: '8px',
      paddingLeft: '8px',
    } : {}}>
      { label &&
        <span key={id + '_0'} className="stattext">{(rank) ? `${label}: #` : `${label}: `}</span>
      }
      { value !== undefined &&
        <Fragment key={id + '_1'}>
          &nbsp;
          <span key={id + '_2'} className="statvalue">{
            typeof value === 'number' ? numberToString(value, zero) :
            value instanceof Date ? formatDate(value) :
            value
          }</span>
        </Fragment>
      }
    </p>
  )
}

function formatDate(date: Date) {
  const iso = date.toISOString();
  return iso.substring(0, iso.indexOf('.')).replaceAll('-', '.').replaceAll('T', ' ');
}