/*
 * Consent Request of third party OpenID Connect login
 * This is not the oauth logins (google, facebook, ...), its the others that are
 * logging in with us.
 */

/* eslint-disable max-len */

import React, {
  useMemo, useContext, useState, useEffect,
} from 'react';
import { useSelector, shallowEqual, useDispatch } from 'react-redux';
import { t, jt } from 'ttag';

import WindowContext from '../context/window.ts';
import LogInForm from '../LogInForm.jsx';
import { requestConsent, requestUsernameChange } from '../../store/actions/fetch.js';
/* for ability to change username if require */
import { validateUsername } from '../../utils/validation.js';
import { setName } from '../../store/actions/index.js';

const OIDCConsent = () => {
  const [expirationHours, setExpirationHours] = useState(String(24 * 7));
  const [submitting, setSubmitting] = useState(false);
  const [consentedScopes, setConsentedScopes] = useState([]);
  /* when logging in to different account */
  const [switchAccount, setSwitchAccount] = useState(false);
  /* only relevant on forced reauthentification */
  const [authReturn, setAuthReturn] = useState(null);
  /* only for changing username, which can be required */
  const [usernameErrors, setUsernameErrors] = useState([]);

  const [sessionName, sessionUsername] = useSelector((state) => [
    state.user.name,
    state.user.username,
  ], shallowEqual);

  const dispatch = useDispatch();

  /*
   * params includes everything the server parsed for oidc and gave us in
   * window.ssv.params, we return the same back
   * additions: clientName needsReauthentication requiredScopes
   */
  const { params } = useContext(WindowContext);

  useEffect(() => {
    if (params.scope) {
      setConsentedScopes([...params.scope]);
    } else {
      setConsentedScopes([]);
    }
  }, [params]);

  const scopes = useMemo(() => params.scope?.sort().map((s) => {
    const required = params.requiredScopes.includes(s);
    switch (s) {
      case 'profile':
        return [s, t`Read name, username and account age`, required];
      case 'email':
        return [s, t`Get email address`, required];
      case 'game_data':
        return [s, t`Get the amount of Pixels placed and ranking`, required];
      case 'achievements':
        return [s, t`Read Badges and fishes`, required];
      case 'modtools':
        return [s, t`ACCESS MODTOOLS`, required];
      case 'offline_access':
        return [s, t`Regularly update this data`, required];
      case 'user_id':
        return [s, t`User ID and verification level`, required];
      case 'openid':
        return [s, t`Know that an account exists`, required];
      default:
        return [s, s, required];
    }
  }), [params]);

  const name = authReturn ? authReturn.me.name : sessionName;

  if ((params.needsReauthentication || !name || switchAccount) && !authReturn) {
    return (
      <LogInForm
        title={t`Login to grant access to other application.`}
        reauthenticate={params.needsReauthentication}
        onLoginSuccess={setAuthReturn}
      />
    );
  }

  const username = authReturn ? authReturn.me.username : sessionUsername;
  const userIsValid = name && !username.startsWith('pp_');

  const { redirect_uri: redirectUri, clientName } = params;
  if (!redirectUri) {
    return null;
  }

  const submitConsent = async () => {
    if (!redirectUri || submitting) {
      return;
    }
    setSubmitting(true);
    const { errors, code } = await requestConsent({
      ...params,
      scope: consentedScopes,
      expirationHours,
      reauthToken: authReturn?.token,
    });
    console.log('consent reply', errors, code);
    let urlParams;
    if (errors) {
      urlParams = {
        error: 'cosent_error',
        error_description: errors[0],
      };
    } else {
      urlParams = { code };
    }
    if (params.state) {
      urlParams.state = params.state;
    }
    urlParams = new URLSearchParams(urlParams);
    window.location.href = `${redirectUri}?${urlParams.toString()}`;
  };

  const submitChangeUsername = async (evt) => {
    evt.preventDefault();
    if (submitting) {
      return;
    }
    const newUsername = evt.target.username.value;
    const error = validateUsername(newUsername);
    if (error) {
      setUsernameErrors([error]);
      return;
    }
    const token = authReturn?.token;

    setSubmitting(true);
    const { errors } = await requestUsernameChange(newUsername, token);
    if (errors) {
      setUsernameErrors(errors);
      return;
    }

    setSubmitting(false);
    if (authReturn) {
      setAuthReturn({
        ...authReturn,
        me: {
          ...authReturn.me,
          username: newUsername,
        },
      });
    } else {
      dispatch(setName(null, newUsername));
    }
  };

  const consentScope = (evt) => {
    const { target } = evt;
    const newConsentedScopes = consentedScopes.filter(
      (s) => s !== target.value,
    );
    if (target.checked) {
      newConsentedScopes.push(target.value);
    }
    setConsentedScopes(newConsentedScopes);
  };

  const deny = () => {
    const urlParams = new URLSearchParams({
      error: 'consent_required',
      error_description: t`You did not consent`,
    });
    if (params.state) {
      urlParams.append('state', params.state);
    }
    window.location.href = `${redirectUri}?${urlParams.toString()}`;
  };

  const appName = <span key="a" className="statvalue">{clientName}</span>;

  const domainStart = redirectUri.indexOf('://') + 3;
  const domainEnd = redirectUri.indexOf('/', domainStart);
  let appUrl;
  if (domainEnd !== -1) {
    appUrl = redirectUri.substring(domainStart, domainEnd);
  } else {
    appUrl = redirectUri.substring(domainStart);
  }
  appUrl = <span key="b" className="statvalue">{appUrl}</span>;

  const accountName = (
    <React.Fragment key="c">
      <span className="statvalue">{name}</span>[{` ${username} `}]
    </React.Fragment>
  );

  return (
    <div style={{ textAlign: 'center' }}>
      <h2>{t`Login to other application`}</h2>
      <p className="stattext">
        {jt`The application ${appName} at ${appUrl} wants to login with your pixeldays account ${accountName}`}{' '}
        <button
          type="button"
          disabled={submitting}
          onClick={() => {
            setAuthReturn(null);
            setSwitchAccount(true);
          }}
        >
          {t`Switch Account`}
        </button>{'. '}
      </p>
      {(userIsValid) ? (
        <React.Fragment key="vu">
          {(scopes.length > 0) && (
          <React.Fragment key="ctt">
            <p>{t`It requests the following permissions. Uncheck what you don't want to grant:`}</p>
            <table className="consenttable">
              <thead>
                <tr>
                  <th>{t`Consent`}</th>
                  <th>{t`Permission`}</th>
                </tr>
              </thead>
              <tbody>
                {scopes?.map(([scope, description, required]) => (
                  <tr key={scope}>
                    <th>
                      <input
                        type="checkbox"
                        value={scope}
                        disabled={required}
                        title={required ? t`This permission is required` : t`Check to allow`}
                        checked={consentedScopes.includes(scope)}
                        onChange={consentScope}
                      />
                    </th>
                    <th>{description}</th>
                  </tr>
                ))}
              </tbody>
            </table>
          </React.Fragment>
          )}
          <p>
            {t`Remember this decision: `}
            <select
              value={expirationHours}
              onChange={(e) => {
                const sel = e.target;
                setExpirationHours(sel.options[sel.selectedIndex].value);
              }}
            >
              <option value={0}>{t`Don't remember`}</option>
              <option value={24}>{t`For one day`}</option>
              <option value={24 * 7}>{t`For one week`}</option>
              <option value={24 * 31}>{t`For one month`}</option>
              <option value={24 * 265}>{t`For one year`}</option>
              <option value="forever">{t`Forever`}</option>
            </select>
          </p>
          <button
            type="button"
            disabled={submitting}
            onClick={deny}
          >
            {t`Deny`}
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={submitConsent}
          >
            {(submitting) ? '...' : t`Grant`}
          </button>
        </React.Fragment>
      ) : (
        <React.Fragment key="nuv">
          <p>{t`Your did not set your username yet. A username is required to login to other applications. You can set it now:`}</p>
          <form onSubmit={submitChangeUsername}>
            {usernameErrors.map((error) => (
              <p key={error} className="errormessage">
                <span>{t`Error`}</span>:&nbsp;{error}</p>
            ))}
            <p>
              <span
                style={{
                  fontWeight: 'bold',
                  backgroundColor: '#dcb822',
                  color: 'black',
                }}
              >{t`YOU CAN ONLY CHOOSE YOUR USERNAME ONCE!`}</span><br />
              {t`Username can only contain the characters: a-z A-z . _ and -`}
            </p>
            <input
              name="username"
              autoComplete="username"
              type="text"
              placeholder={t`User Name`}
            /><br />
            <button
              type="button"
              disabled={submitting}
              onClick={deny}
            >{t`Deny`}
            </button>
            <button
              type="submit"
              disabled={submitting}
            >{t`Save`}
            </button>
          </form>
        </React.Fragment>
      )}
    </div>
  );
};

export default OIDCConsent;
