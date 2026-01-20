/*
 * Admintools
 */

import React, { useState, useEffect, useCallback } from 'react';
import { t } from 'ttag';

import DeleteList from './DeleteList.jsx';
import { api } from '../utils/utag.js';
import { USERLVL } from '../core/constants.ts';

async function submitTextAction(
  action,
  text,
  callback,
) {
  const data = new FormData();
  data.append('textaction', action);
  data.append('text', text);
  const resp = await fetch(api`/api/modtools`, {
    credentials: 'include',
    method: 'POST',
    body: data,
  });
  callback(await resp.text());
}

async function getModList(callback) {
  const data = new FormData();
  data.append('modlist', true);
  const resp = await fetch(api`/api/modtools`, {
    credentials: 'include',
    method: 'POST',
    body: data,
  });
  if (resp.ok) {
    callback(await resp.json());
  } else {
    callback([]);
  }
}

async function submitRemMod(userId, callback) {
  const data = new FormData();
  data.append('remmod', userId);
  const resp = await fetch(api`/api/modtools`, {
    credentials: 'include',
    method: 'POST',
    body: data,
  });
  callback(resp.ok, await resp.text());
}

async function submitMakeMod(userName, userlvl, callback) {
  const data = new FormData();
  data.append('makemod', userName);
  data.append('userlvl', userlvl);
  const resp = await fetch(api`/api/modtools`, {
    credentials: 'include',
    method: 'POST',
    body: data,
  });
  if (resp.ok) {
    callback(await resp.json());
  } else {
    callback(await resp.text());
  }
}

async function submitQuickAction(action, callback) {
  const data = new FormData();
  data.append('quickaction', action);
  const resp = await fetch(api`/api/modtools`, {
    credentials: 'include',
    method: 'POST',
    body: data,
  });
  callback(await resp.text());
}

async function getGameState(
  callback,
) {
  const data = new FormData();
  data.append('gamestate', true);
  const resp = await fetch(api`/api/modtools`, {
    credentials: 'include',
    method: 'POST',
    body: data,
  });
  if (resp.ok) {
    callback(await resp.json());
  } else {
    callback({
    });
  }
}

function Admintools() {
  const [textAction, selectTextAction] = useState('iidtoip');
  const [modName, selectModName] = useState('');
  const [modType, selectModType] = useState(USERLVL.MOD);
  const [txtval, setTxtval] = useState('');
  const [resp, setResp] = useState(null);
  const [modlist, setModList] = useState({});
  const [gameState, setGameState] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    getModList((mods) => setModList(mods));
  }, []);

  useEffect(() => {
    getGameState((stats) => setGameState(stats));
  }, []);

  const reqQuickAction = useCallback((action) => () => {
    if (submitting) return;
    setSubmitting(true);
    submitQuickAction(action, (ret) => {
      setResp(ret);
      setSubmitting(false);
    });
  }, [submitting]);

  const promoteUser = useCallback(() => {
    if (submitting) return;
    setSubmitting(true);
    submitMakeMod(
      modName, modType,
      (ret) => {
        if (typeof ret === 'string') {
          setResp(ret);
        } else {
          const [id, name] = ret;
          setResp(`Made ${name} mod successfully.`);
          const newModList = {};
          /* make sure new mod is not in any other list already */
          Object.keys(modlist).forEach((lvl) => {
            newModList[lvl] = modlist[lvl].filter(
              (modl) => (modl[0] !== id),
            );
          });
          newModList[modType] = [...(newModList[modType] || []), ret];
          setModList(newModList);
        }
        setSubmitting(false);
      },
    );
  }, [submitting, modType, modName, modlist]);

  const demoteUser = useCallback((id) => {
    if (submitting) return;
    setSubmitting(true);
    submitRemMod(id, (success, ret) => {
      if (success) {
        const newModList = {};
        Object.keys(modlist).forEach((userlvl) => {
          newModList[userlvl] = modlist[userlvl].filter(
            (modl) => (modl[0] !== id),
          );
        });
        setModList(newModList);
      }
      setSubmitting(false);
      setResp(ret);
    });
  }, [submitting, modlist]);

  return (
    <div className="content">
      {resp && (
        <div className="respbox">
          {resp.split('\n').map((line) => (
            <p key={line.slice(0, 3)}>
              {line}
            </p>
          ))}
          <span
            role="button"
            tabIndex={-1}
            className="modallink"
            onClick={() => setResp(null)}
          >
            {t`Close`}
          </span>
        </div>
      )}
      <div>
        <br />
        <h3>{t`IP Actions`}</h3>
        <p>
          {t`Do stuff with IPs (one IP per line)`}
        </p>
        <select
          value={textAction}
          onChange={(e) => {
            const sel = e.target;
            selectTextAction(sel.options[sel.selectedIndex].value);
          }}
        >
          {['iidtoip', 'iptoiid', 'markusersashacked', 'announce']
            .map((opt) => (
              <option
                key={opt}
                value={opt}
              >
                {opt}
              </option>
            ))}
        </select>
        <br />
        <textarea
          rows="15"
          cols="25"
          value={txtval}
          onChange={(e) => setTxtval(e.target.value)}
        /><br />
        <button
          type="button"
          onClick={() => {
            if (submitting) return;
            setSubmitting(true);
            submitTextAction(
              textAction,
              txtval,
              (ret) => {
                setSubmitting(false);
                setTxtval(ret);
              },
            );
          }}
        >
          {(submitting) ? '...' : t`Submit`}
        </button>
        <br />
        <div className="modaldivider" />

        <h3>{t`Quick Actions`}</h3>
        <button
          type="button"
          onClick={reqQuickAction('resetcaptchas')}
        >
          {(submitting) ? '...' : t`Reset Captchas of ALL Users`}
        </button>
        <br />
        <button
          type="button"
          onClick={reqQuickAction('rollcaptchafonts')}
        >
          {(submitting) ? '...' : t`Roll different Captcha Fonts`}
        </button>
        <br />
        {(gameState.needVerification) ? (
          <button
            key="disableverify"
            type="button"
            onClick={() => {
              reqQuickAction('disableverify')();
              setGameState({ ...gameState, needVerification: false });
            }}
          >
            {(submitting) ? '...' : t`Stop requiring Verification to Place`}
          </button>
        ) : (
          <button
            key="enableverify"
            type="button"
            onClick={() => {
              reqQuickAction('enableverify')();
              setGameState({ ...gameState, needVerification: true });
            }}
          >
            {(submitting) ? '...' : t`Require Verification to Place`}
          </button>
        )}
        <br />
        {(gameState.malwareCheck) ? (
          <button
            key="disablemalware"
            type="button"
            onClick={() => {
              reqQuickAction('disablemalware')();
              setGameState({ ...gameState, malwareCheck: false });
            }}
          >
            {(submitting) ? '...' : t`Stop checking for Malware`}
          </button>
        ) : (
          <button
            key="enablemalware"
            type="button"
            onClick={() => {
              reqQuickAction('enablemalware')();
              setGameState({ ...gameState, malwareCheck: true });
            }}
          >
            {(submitting) ? '...' : t`Start checking for Malware`}
          </button>
        )}
        <br />
        <div className="modaldivider" />

        <h3>{t`Manage Moderators`}</h3>
        {(modlist[USERLVL.MOD]?.length > 0) && (
          <React.Fragment key="mmod">
            <p>{t`Remove Moderator`}</p>
            <DeleteList
              list={modlist[USERLVL.MOD]}
              callback={demoteUser}
              enabled={!submitting}
              joinident
            />
            <br />
          </React.Fragment>
        )}
        {(modlist[USERLVL.JANNY]?.length > 0) && (
          <React.Fragment key="mjan">
            <p>{t`Remove Janny`}</p>
            <DeleteList
              list={modlist[USERLVL.JANNY]}
              callback={demoteUser}
              enabled={!submitting}
              joinident
            />
            <br />
          </React.Fragment>
        )}
        {(modlist[USERLVL.CLEANER]?.length > 0) && (
          <React.Fragment key="mcln">
            <p>{t`Remove Cleaner`}</p>
            <DeleteList
              list={modlist[USERLVL.CLEANER]}
              callback={demoteUser}
              enabled={!submitting}
              joinident
            />
            <br />
          </React.Fragment>
        )}
        <p>
          { t`Assign new Mod` }
        </p>
        <p>
          {t`Enter UserName of new Mod`}:&nbsp;
          <input
            value={modName}
            style={{
              display: 'inline-block',
              width: '100%',
              maxWidth: '20em',
            }}
            type="text"
            placeholder={t`User Name`}
            onChange={(evt) => {
              const co = evt.target.value.trim();
              selectModName(co);
            }}
          />
        </p>
        <p>
          {t`Type of Mod`}:&nbsp;
          <select
            value={modType}
            onChange={(e) => {
              const sel = e.target;
              selectModType(parseInt(sel.options[sel.selectedIndex].value, 10));
            }}
          >
            {['MOD', 'JANNY', 'CLEANER'].map((opt) => (
              <option
                key={opt}
                value={USERLVL[opt]}
              >
                {opt}
              </option>
            ))}
          </select>
        </p>
        <p>{(() => {
          switch (modType) {
            case USERLVL.MOD:
              return t`Moderators can access all Canvas, Watch and IID tools.`;
            case USERLVL.JANNY:
              return t`Jannies can rollback and protect, but not watch or ban.`;
            case USERLVL.CLEANER:
              return t`Cleaners can use 0cd blank colors.`;
            default:
              return null;
          }
        })()}</p>
        <button
          type="button"
          onClick={promoteUser}
        >
          {(submitting) ? '...' : t`Submit`}
        </button>
        <br />
      </div>
    </div>
  );
}

export default React.memo(Admintools);
