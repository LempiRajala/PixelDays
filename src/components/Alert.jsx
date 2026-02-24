/*
 *
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import GlobalCaptcha from './GlobalCaptcha.jsx';
import BanInfo from './BanInfo.jsx';
import Overlay from './Overlay.jsx';
import RefreshPrompt from './RefreshPrompt.jsx';
import { closeAlert } from '../store/actions/index.js';
import Markdown from './markdown/Markdown.jsx';
import useLink from './hooks/link.js';
import { t } from 'ttag';

const Alert = () => {
  const [render, setRender] = useState(false);
  const link = useLink();

  const {
    open,
    alertType,
    title,
    message,
    btn,
    ...restState
  } = useSelector((state) => state.alert);

  const isProxyRetcode = 'retcode' in restState && restState.retcode === 11;
  const isRussianDude = navigator.languages.includes('ru');

  const dispatch = useDispatch();
  const close = useCallback(() => {
    dispatch(closeAlert());
  }, [dispatch]);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => {
        setRender(true);
      }, 10);
    }
  }, [open]);

  let Content = null;
  switch (alertType) {
    case 'captcha':
      Content = GlobalCaptcha;
      break;
    case 'ban':
      Content = BanInfo;
      break;
    case 'refresh':
      Content = RefreshPrompt;
      break;
    default:
      // nothing
  }

  if (!render && !open) {
    return null;
  }

  const show = open && render;

  const gotoReportForm = () => {
    close();
    link('REPORT_FORM', {
      target: 'parent',
      args: {
        category: 'add-to-whitelist',
        title: 'Добавьте меня в белый список',
      },
      width: 500,
      height: 500,
    });
  }

  return (
    <>
      <Overlay
        z={6}
        show={show}
        onClick={close}
      />
      <div
        className={(show) ? 'Alert show' : 'Alert'}
        onTransitionEnd={() => {
          if (!open) setRender(false);
        }}
      >
        <h2>{title}</h2>
        {(message) && (
          <Markdown text={message} parseLinks />
        )}
        { isProxyRetcode && isRussianDude &&
          <div style={{ marginBottom: '12px' }}>
            <div>{t`Are you Russian and can't play without a VPN?`}</div>
            <div style={{ display: 'flex', alignItems: 'center', marginTop: '4px' }}>
              <span
                style={{
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
                onClick={gotoReportForm}
              >
                {t`Make repоrt`}
              </span>
              {t`, and we'll add you to our whitelist.`}
            </div>
          </div>
        }
        {(Content) ? (
          <Content close={close} />
        ) : (
          <button type="button" onClick={close}>{btn}</button>
        )}
      </div>
      )
    </>
  );
};

export default React.memo(Alert);
