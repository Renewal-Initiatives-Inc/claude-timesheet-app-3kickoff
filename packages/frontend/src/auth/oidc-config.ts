import { UserManagerSettings, WebStorageStateStore } from 'oidc-client-ts';

const ZITADEL_ISSUER = import.meta.env.VITE_ZITADEL_ISSUER;
const ZITADEL_CLIENT_ID = import.meta.env.VITE_ZITADEL_CLIENT_ID;
const APP_URL = import.meta.env.VITE_APP_URL || window.location.origin;

// App Portal project ID - needed for JWT access tokens
const ZITADEL_PROJECT_ID = '358210659915177779';

export const oidcConfig: UserManagerSettings = {
  authority: ZITADEL_ISSUER,
  client_id: ZITADEL_CLIENT_ID,
  redirect_uri: `${APP_URL}/callback`,
  post_logout_redirect_uri: APP_URL,
  response_type: 'code',
  scope: `openid profile email urn:zitadel:iam:org:project:roles urn:zitadel:iam:org:project:id:${ZITADEL_PROJECT_ID}:aud`,
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  // Disable automatic silent renew - it causes issues before first login
  automaticSilentRenew: false,
};
