/*
 * Form to LogIn, Register and reset password
 */
import React, { useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { t } from 'ttag';

import { u, cdn } from '../utils/utag.js';
import Captcha from './Captcha.jsx';
import {
  validateEMail, validateName, validatePassword, validateUsername,
} from '../utils/validation.js';
import {
  requestLogin, requestNewPassword, requestRegistration,
} from '../store/actions/fetch.js';
import { loginUser } from '../store/actions/index.js';
import { THREEPID_ABBR } from '../core/constants.js';

/* eslint-disable max-len */

function validateLogin(nameoremail, password) {
  const errors = [];
  const mailerror = (nameoremail.indexOf('@') !== -1)
    ? validateEMail(nameoremail)
    : validateName(nameoremail);
  if (mailerror) errors.push(mailerror);
  const passworderror = validatePassword(password);
  if (passworderror) errors.push(passworderror);
  return errors;
}

function validateEmail(email) {
  const errors = [];
  const mailerror = validateEMail(email);
  if (mailerror) errors.push(mailerror);
  return errors;
}

function validateRegister(name, username, email, password, confirmPassword) {
  const errors = [];
  const mailerror = validateEMail(email);
  if (mailerror) errors.push(mailerror);
  const nameerror = validateName(name);
  if (nameerror) errors.push(nameerror);
  const usernameerror = validateUsername(username);
  if (usernameerror) errors.push(usernameerror);
  const passworderror = validatePassword(password);
  if (passworderror) errors.push(passworderror);

  if (password !== confirmPassword) {
    errors.push('Passwords do not match');
  }
  return errors;
}

const inputStyles = {
  display: 'inline-block',
  width: '75%',
  maxWidth: '35em',
};

const logoStyle = {
  marginRight: 5,
};

const LogInForm = ({
  /*
   * on reauthenticate, we do not set cookies and get the token directly, which
   * is used for forced OpenID login window
   */
  title, onLoginSuccess, reauthenticate,
}) => {
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState([]);
  const [success, setSuccess] = useState(false);
  const [page, setPage] = useState('login');
  // used to be able to force Captcha rerender on error
  const [captKey, setCaptKey] = useState(Date.now());

  const dispatch = useDispatch();

  const changePage = useCallback((newPage) => () => {
    setSuccess(false);
    setErrors([]);
    setPage(newPage);
  }, []);

  const submitLogin = useCallback(async (evt) => {
    evt.preventDefault();
    if (submitting) {
      return;
    }
    const nameoremail = evt.target.nameoremail.value;
    const password = evt.target.password.value;
    /* durationsel is ignored server-side if we reauthenticate */
    const durationsel = evt.target.durationsel.value;

    const valErrors = validateLogin(nameoremail, password);
    if (valErrors.length > 0) {
      setErrors(valErrors);
      return;
    }

    setSubmitting(true);
    const { errors: respErrors, me, token } = await requestLogin(
      nameoremail, password, durationsel, reauthenticate,
    );
    setSubmitting(false);
    if (respErrors) {
      setErrors(respErrors);
      return;
    }
    if (onLoginSuccess) {
      onLoginSuccess({ me, token });
    }
    dispatch(loginUser(me));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitting]);

  const submitRestore = useCallback(async (evt) => {
    evt.preventDefault();
    if (submitting) {
      return;
    }
    const email = evt.target.email.value;
    const valErrors = validateEmail(email);
    if (valErrors.length > 0) {
      setErrors(valErrors);
      return;
    }

    setSubmitting(true);
    const { errors: respErrors } = await requestNewPassword(email);
    setSubmitting(false);
    if (respErrors) {
      setErrors(respErrors);
      return;
    }
    setSuccess(true);
  }, [submitting]);


  const submitRegister = useCallback(async (evt) => {
    evt.preventDefault();
    if (submitting || !success) {
      return;
    }
    const name = evt.target.name.value;
    const username = evt.target.username.value;
    const email = evt.target.email.value;
    const password = evt.target.password.value;
    const confirmPassword = evt.target.confirmpassword.value;
    const durationsel = evt.target.durationsel.value;
    const captcha = evt.target.captcha.value;
    const captchaid = evt.target.captchaid.value;
    const challengeSolution = evt.target.challengesolution.value;
    const valErrors = validateRegister(
      name, username, email, password, confirmPassword,
    );
    if (valErrors.length > 0) {
      setErrors(valErrors);
      return;
    }

    setSubmitting(true);
    const { errors: respErrors, me } = await requestRegistration(
      name,
      username,
      email,
      password,
      durationsel,
      captcha,
      captchaid,
      challengeSolution,
    );
    setSubmitting(false);
    if (respErrors) {
      setCaptKey(Date.now());
      setErrors(respErrors);
      return;
    }

    dispatch(loginUser(me));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitting, success]);

  const path = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);

  return (
    <div style={{ textAlign: 'center' }}>
      {(title) && <p>{title}</p>}
      {(() => {
        switch (page) {
          case 'login':
            return (
              <React.Fragment key="log">
                <h2>{t`Login with Name or Mail:`}</h2>
                <form onSubmit={submitLogin}>
                  {errors.map((error) => (
                    <p key={error} className="errormessage">
                      <span>{t`Error`}</span>:&nbsp;{error}
                    </p>
                  ))}
                  <input
                    style={inputStyles}
                    name="nameoremail"
                    autoComplete="email"
                    type="text"
                    placeholder={t`Name or Email`}
                  /><br />
                  <input
                    style={inputStyles}
                    name="password"
                    autoComplete="current-password"
                    type="password"
                    placeholder={t`Password`}
                  />
                  <p>
                    {t`Stay logged in: `}
                    <select defaultValue={24 * 31} name="durationsel">
                      <option value={0}>{t`Until the browser closes`}</option>
                      <option value={24 * 7}>{t`For one week`}</option>
                      <option value={24 * 31}>{t`For one month`}</option>
                      <option value={24 * 265}>{t`For one year`}</option>
                      <option value="forever">{t`Forever`}</option>
                    </select>
                  </p>
                  <p>
                    <button type="submit">
                      {(submitting) ? '...' : t`LogIn`}
                    </button>
                  </p>
                </form>

                <p>
                  <span
                    className="modallink"
                    onClick={changePage('restore')}
                    role="presentation"
                  >
                    {t`I forgot my Password.`}
                  </span>
                </p>
                {(!reauthenticate && window.ssv?.availableTp?.length > 0) && (
                  <React.Fragment key="tp">
                    <h2>{t`or login with:`}</h2>
                    {window.ssv.availableTp.map((abbr) => {
                      const providerName = THREEPID_ABBR[abbr];
                      return (
                        <a href={u`/tp/${abbr}?o=${path}`} key={abbr}>
                          <img
                            style={logoStyle}
                            width={32}
                            src={cdn`/${providerName.toLowerCase()}logo.png`}
                            title={providerName}
                            alt={providerName}
                          />
                        </a>
                      );
                    })}
                  </React.Fragment>
                )}
                <h2>{t`or register here:`}</h2>
                <button
                  type="button"
                  onClick={changePage('register')}
                >
                  {t`Register`}
                </button>
              </React.Fragment>
            );
          case 'restore':
            return (
              <React.Fragment key="rest">
                <h2>{t`Reset your password`}</h2>
                {(success) ? (
                  <React.Fragment key="succ">
                    <p className="modalmessage">
                      {t`Sent you a mail with instructions to reset your password.`}
                    </p>
                    <button type="button" onClick={changePage('login')}>
                      {t`Back`}
                    </button>
                  </React.Fragment>
                ) : (
                  <React.Fragment key="do">
                    <p>
                      {t`Enter your mail address and we will send you a new password:`}
                    </p><br />
                    <form onSubmit={submitRestore}>
                      {errors.map((error) => (
                        <p key={error} className="errormessage"><span>{t`Error`}</span>
                          :&nbsp;{error}</p>
                      ))}
                      <input
                        style={inputStyles}
                        name="email"
                        autoComplete="email"
                        type="text"
                        placeholder={t`Email`}
                      />
                      <br />
                      <button type="submit">
                        {(submitting) ? '...' : t`Submit`}
                      </button>
                      <button type="button" onClick={changePage('login')}>
                        {t`Cancel`}
                      </button>
                    </form>
                  </React.Fragment>
                )}
              </React.Fragment>
            );
          case 'register':
            return (
              <React.Fragment key="rest">
                <form
                  style={{ paddingLeft: '5%', paddingRight: '5%' }}
                  onSubmit={submitRegister}
                >
                  <h2>{t`Register new account here`}</h2>
                  <h3>{t`Name`}:</h3>
                  <p>{t`This is the name that other people see, e.g. in Chat. You can change it at any time. All characters except @, /, \, >, < and # are allowed.`}</p>
                  <input
                    name="name"
                    className="reginput"
                    autoComplete="username"
                    type="text"
                    placeholder={t`Name`}
                  />
                  <h3>{t`User Name`}:</h3>
                  <p>{t`The name of your account, only a-z, A-Z, -, ., and - characters are allowed. It is permanent, you can not change it later.`}</p>
                  <input
                    name="username"
                    className="reginput"
                    autoComplete="username"
                    type="text"
                    placeholder={t`User Name`}
                  />
                  <h3>{t`Email`}:</h3>
                  <p>{t`Email is used to verify your account. You might get a cofirmation mail after registering.`}</p>
                  <input
                    name="email"
                    className="reginput"
                    autoComplete="email"
                    type="text"
                    placeholder={t`Email`}
                  />
                  <h3>{t`Password`}:</h3>
                  <input
                    name="password"
                    className="reginput"
                    autoComplete="new-password"
                    type="password"
                    placeholder={t`Password`}
                  />
                  <h3>{t`Confirm Password`}:</h3>
                  <input
                    name="confirmpassword"
                    className="reginput"
                    autoComplete="new-password"
                    type="password"
                    placeholder={t`Confirm Password`}
                  />
                  <p
                    style={{
                      visibility: (reauthenticate) ? 'hidden' : 'visible',
                    }}
                  >
                    {t`Stay logged in: `}
                    <select defaultValue={24 * 31} name="durationsel">
                      <option value={0}>{t`Until the browser closes`}</option>
                      <option value={24 * 7}>{t`For one week`}</option>
                      <option value={24 * 31}>{t`For one month`}</option>
                      <option value={24 * 265}>{t`For one year`}</option>
                      <option value="forever">{t`Forever`}</option>
                    </select>
                  </p>
                  <h3>{t`Captcha`}:</h3>
                  <Captcha
                    autoload={false}
                    width={85}
                    key={captKey}
                    onReadyStateChange={setSuccess}
                  /><br />
                  {errors.map((error) => (
                    <p key={error} className="errormessage"><span>{t`Error`}</span>
                      :&nbsp;{error}</p>
                  ))}
                  <button
                    type="submit"
                    disabled={submitting || !success}
                  >
                    {t`Submit`}
                  </button>
                  <button
                    type="button"
                    onClick={changePage('login')}
                  >
                    {t`Cancel`}
                  </button>
                </form>
              </React.Fragment>
            );
          default:
            return null;
        }
      })()}
    </div>
  );
};

export default React.memo(LogInForm);
