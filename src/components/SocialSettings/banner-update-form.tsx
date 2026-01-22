import React from 'react';
import { useState } from "react";
import { getImageFromUser } from "../../core/client-utils";
import { maxUploadFileSize } from "../../core/constants";
import { t } from 'ttag';
import { updateBanner } from '../../api/update-banner';
import type { PropsWithStyle } from '../../types';
import store from '../../store/store';
import { setSelfBannerId } from '../../store/actions/user';

export function BannerUpdateForm({ 
  style,
}: PropsWithStyle) {
  const [tooBigFile, setTooBigFile] = useState(false);

  const onChangeFile = async () => {
    const file = await getImageFromUser();

    if(!file) {
      setTooBigFile(false);
    } else {
      const fileTooBig = file.size > maxUploadFileSize;
      setTooBigFile(fileTooBig);
      if(!fileTooBig) {
        const { bannerId } = await updateBanner(file);
        store.dispatch(setSelfBannerId(bannerId));
      }
    }
  }

  const onRemoveAvatar = async () => {
    await updateBanner(null);
    store.dispatch(setSelfBannerId(null));
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'start',
      justifyContent: 'center',
      ...style,
    }}>
      <h3 className="settitle">
        Banner
      </h3>
      <div style={{
        display: 'flex',
        gap: '8px',
        flexDirection: 'row',
        marginBottom: '8px',
      }}>
        <button
          onClick={onChangeFile}
          style={{
            cursor: 'pointer',
          }}
        >
          {t`Click to upload banner`}
        </button>
        { tooBigFile &&
          <div
            style={{
              color: 'red',
              background: '#e8e8e8',
              border: 'solid 1px black',
              paddingLeft: '4px',
              paddingRight: '4px',
            }}
          >
            {t`File must be less than`} <span style={{ whiteSpace: 'nowrap' }}>{(maxUploadFileSize / 1024 / 1024).toFixed(2)} mb.</span>
          </div>
        }
      </div>
      <button
        style={{
          cursor: 'pointer',
        }}
        onClick={onRemoveAvatar}
      >
        {t`Remove banner`}
      </button>
    </div>
  )
}