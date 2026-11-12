/*
 * Password reset page (LA9a). Spec: docs/LA9-WEBSITE-PAGE.md in the app repo.
 *
 * The reset email links here with ?token_hash=...&type=recovery. This script:
 *   1. reads the token and removes it from the address bar at once (before the page is drawn),
 *   2. exchanges it with verifyOtp (short recovery session, kept in memory only),
 *   3. sets the new password with updateUser,
 *   4. signs the person out on all devices (scope: global).
 * The token is never logged, stored, sent anywhere except Supabase, or put in the page.
 */

/* Public values only: the project URL and the public anon / publishable key.
   NEVER put a service_role or secret key here. */
var ATHLOMATE_SUPABASE_URL = 'https://qqrtugwshmfmgdshkfoy.supabase.co';
var ATHLOMATE_SUPABASE_ANON_KEY = 'sb_publishable_phZZkeQjoop-3R2rKCYV3A_hiJIOqsH';

(function () {
  'use strict';

  var MIN_PASSWORD_LENGTH = 8; // same as kMinPasswordLength in the app (password_rules.dart)

  var root = document.documentElement;
  function setState(name) { root.setAttribute('data-state', name); }

  // ---- 1. Read the link and clean the address bar right away -------------------------------
  var tokenHash = null;
  var linkUsable = false;
  (function readLink() {
    var search = window.location.search || '';
    var hash = window.location.hash || '';
    var params = new URLSearchParams(search);
    var hashParams = new URLSearchParams(hash.replace(/^#/, ''));
    var th = params.get('token_hash');
    var type = params.get('type');
    // Supabase's own error shape (#error=...&error_code=otp_expired) and the older link shapes
    // (?code=... from PKCE, #access_token=... implicit) cannot be used on this page.
    var hasError = params.has('error') || params.has('error_code') ||
      hashParams.has('error') || hashParams.has('error_code');
    var oldShape = params.has('code') || hashParams.has('access_token');
    if (th && type === 'recovery' && !hasError && !oldShape) {
      tokenHash = th;
      linkUsable = true;
    }
    if (search || hash) {
      try { history.replaceState(null, '', window.location.pathname); } catch (e) { /* ignore */ }
    }
  })();

  setState(linkUsable ? 'checking' : 'invalid');

  // ---- Supabase client (memory only: no cookies, no localStorage) ---------------------------
  var memoryStorage = (function () {
    var m = {};
    return {
      getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null; },
      setItem: function (k, v) { m[k] = String(v); },
      removeItem: function (k) { delete m[k]; }
    };
  })();

  function configured() {
    return /^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(ATHLOMATE_SUPABASE_URL) &&
      ATHLOMATE_SUPABASE_ANON_KEY.indexOf('FILL-IN') === -1 &&
      ATHLOMATE_SUPABASE_ANON_KEY.length > 20;
  }

  var client = null;
  function getClient() {
    if (client) return client;
    if (!window.supabase || !configured()) return null;
    client = window.supabase.createClient(ATHLOMATE_SUPABASE_URL, ATHLOMATE_SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storage: memoryStorage
      }
    });
    return client;
  }

  // ---- Error helpers -------------------------------------------------------------------------
  function errCode(err) { return (err && (err.code || err.error_code)) || ''; }
  function isNetworkError(err) {
    if (!err) return false;
    if (err.name === 'AuthRetryableFetchError' || err.status === 0) return true;
    if (err.name === 'TypeError') return true; // fetch() itself failed
    return typeof navigator !== 'undefined' && navigator.onLine === false;
  }
  function isSessionGone(err) {
    var c = errCode(err);
    return c === 'session_not_found' || c === 'session_expired' || c === 'bad_jwt' ||
      c === 'otp_expired' || (err && err.status === 401) || (err && err.name === 'AuthSessionMissingError');
  }

  var MSG = {
    short: ['Ο κωδικός πρέπει να έχει τουλάχιστον 8 χαρακτήρες.', 'The password must be at least 8 characters.'],
    mismatch: ['Οι κωδικοί δεν ταιριάζουν.', "The passwords don't match."],
    weak: ['Αυτός ο κωδικός είναι πολύ εύκολος. Επιλέξτε πιο ισχυρό.', 'That password is too easy to guess. Please choose a stronger one.'],
    same: ['Επιλέξτε κωδικό που δεν έχετε χρησιμοποιήσει πριν.', "Choose a password you haven't used before."],
    generic: ['Κάτι πήγε στραβά. Δοκιμάστε ξανά.', 'Something went wrong. Please try again.']
  };

  function setMessage(el, pair) {
    while (el.firstChild) el.removeChild(el.firstChild);
    if (!pair) return;
    var g = document.createElement('span'); g.lang = 'el'; g.textContent = pair[0];
    var e = document.createElement('span'); e.lang = 'en'; e.textContent = pair[1];
    el.appendChild(g); el.appendChild(e);
  }

  function labelPair(el, gr, en) {
    while (el.firstChild) el.removeChild(el.firstChild);
    var g = document.createElement('span'); g.lang = 'el'; g.textContent = gr;
    var e = document.createElement('span'); e.lang = 'en'; e.textContent = en;
    el.appendChild(g); el.appendChild(document.createTextNode(' ')); el.appendChild(e);
  }

  // ---- 2. Verify the link -------------------------------------------------------------------
  var verifying = false;
  function verify() {
    if (verifying || !tokenHash) return;
    var c = getClient();
    if (!c) {
      // Page not configured or the library did not load: not the person's fault, link may be fine.
      setState('offline');
      return;
    }
    verifying = true;
    setState('checking');
    c.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' }).then(function (res) {
      verifying = false;
      if (res && !res.error && res.data && res.data.session) {
        tokenHash = null; // used up; the in-memory session is all we need now
        setState('form');
        var pw1 = document.getElementById('pw1');
        if (pw1) { try { pw1.focus({ preventScroll: true }); } catch (e) { pw1.focus(); } }
      } else if (res && res.error && isNetworkError(res.error)) {
        setState('offline');
      } else {
        tokenHash = null;
        setState('invalid');
      }
    }, function (err) {
      verifying = false;
      if (isNetworkError(err)) { setState('offline'); } else { tokenHash = null; setState('invalid'); }
    });
  }

  // ---- 3. Form ------------------------------------------------------------------------------
  function charCount(s) { return Array.from(s).length; } // characters, not bytes

  function init() {
    var form = document.getElementById('reset-form');
    var pw1 = document.getElementById('pw1');
    var pw2 = document.getElementById('pw2');
    var err1 = document.getElementById('pw1-error');
    var err2 = document.getElementById('pw2-error');
    var formErr = document.getElementById('form-error');
    var btn = document.getElementById('save-btn');
    var retry = document.getElementById('retry-btn');
    var busy = false;

    Array.prototype.forEach.call(document.querySelectorAll('.pw-toggle'), function (t) {
      t.addEventListener('click', function () {
        var input = document.getElementById(t.getAttribute('data-target'));
        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        t.setAttribute('aria-pressed', show ? 'true' : 'false');
        labelPair(t, show ? 'Απόκρυψη' : 'Εμφάνιση', show ? 'Hide' : 'Show');
      });
    });

    function setBusy(on) {
      busy = on;
      btn.disabled = on;
      btn.setAttribute('aria-busy', on ? 'true' : 'false');
      if (on) labelPair(btn, 'Αποθήκευση…', 'Saving…');
      else labelPair(btn, 'Αποθήκευση νέου κωδικού', 'Save new password');
    }

    function clearErrors() {
      setMessage(err1, null); setMessage(err2, null); setMessage(formErr, null);
      pw1.removeAttribute('aria-invalid'); pw2.removeAttribute('aria-invalid');
    }

    pw1.addEventListener('input', function () { if (err1.firstChild) { setMessage(err1, null); pw1.removeAttribute('aria-invalid'); } });
    pw2.addEventListener('input', function () { if (err2.firstChild) { setMessage(err2, null); pw2.removeAttribute('aria-invalid'); } });

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (busy) return;
      clearErrors();
      var a = pw1.value, b = pw2.value;
      if (charCount(a) < MIN_PASSWORD_LENGTH) {
        setMessage(err1, MSG.short); pw1.setAttribute('aria-invalid', 'true'); pw1.focus(); return;
      }
      if (a !== b) {
        setMessage(err2, MSG.mismatch); pw2.setAttribute('aria-invalid', 'true'); pw2.focus(); return;
      }
      var c = getClient();
      if (!c) { setMessage(formErr, MSG.generic); return; }
      setBusy(true);
      c.auth.updateUser({ password: a }).then(function (res) {
        if (res && !res.error) {
          // 4. Sign out everywhere (also this browser). A failure here is ignored: the password changed.
          var done = function () {
            pw1.value = ''; pw2.value = ''; a = ''; b = '';
            setBusy(false);
            setState('done');
            var h = document.getElementById('done-heading');
            if (h) { try { h.focus({ preventScroll: true }); } catch (e) { h.focus(); } }
          };
          var p;
          try { p = c.auth.signOut({ scope: 'global' }); } catch (e) { p = null; }
          if (p && typeof p.then === 'function') p.then(done, done); else done();
          return;
        }
        setBusy(false);
        handleUpdateError(res && res.error);
      }, function (err) {
        setBusy(false);
        handleUpdateError(err);
      });
    });

    function handleUpdateError(err) {
      var code = errCode(err);
      if (code === 'same_password') {
        setMessage(err1, MSG.same); pw1.setAttribute('aria-invalid', 'true'); pw1.focus();
      } else if (code === 'weak_password') {
        setMessage(err1, MSG.weak); pw1.setAttribute('aria-invalid', 'true'); pw1.focus();
      } else if (!isNetworkError(err) && isSessionGone(err)) {
        pw1.value = ''; pw2.value = '';
        setState('invalid');
      } else {
        setMessage(formErr, MSG.generic); // form stays filled
      }
    }

    if (retry) retry.addEventListener('click', function () { if (tokenHash) verify(); else setState('invalid'); });

    if (linkUsable) verify();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
