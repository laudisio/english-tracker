import { config } from "./config.js";

const AUTH_KEY = "et.auth";

export const cloudEnabled = () => !!(config.region && config.userPoolClientId && config.apiUrl);

async function cognito(action, body) {
  const res = await fetch(`https://cognito-idp.${config.region}.amazonaws.com/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "X-Amz-Target": `AWSCognitoIdentityProviderService.${action}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || "Falha na autenticação");
    err.code = (data.__type || "").split("#").pop();
    throw err;
  }
  return data;
}

function tokenExp(jwt) {
  const payload = JSON.parse(atob(jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
  return payload.exp * 1000;
}

function saveTokens(result, refreshToken) {
  const auth = {
    idToken: result.IdToken,
    refreshToken: result.RefreshToken || refreshToken,
    exp: tokenExp(result.IdToken),
  };
  localStorage.setItem(AUTH_KEY, JSON.stringify(auth));
  return auth;
}

function readAuth() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY));
  } catch {
    return null;
  }
}

export const isLoggedIn = () => !!readAuth()?.refreshToken;

export function logout() {
  localStorage.removeItem(AUTH_KEY);
}

// askNewPassword: chamado se o Cognito exigir troca de senha no primeiro acesso.
export async function login(email, password, askNewPassword) {
  let data = await cognito("InitiateAuth", {
    AuthFlow: "USER_PASSWORD_AUTH",
    ClientId: config.userPoolClientId,
    AuthParameters: { USERNAME: email, PASSWORD: password },
  });
  if (data.ChallengeName === "NEW_PASSWORD_REQUIRED") {
    const newPassword = await askNewPassword();
    if (!newPassword) throw new Error("É preciso definir uma nova senha.");
    data = await cognito("RespondToAuthChallenge", {
      ChallengeName: "NEW_PASSWORD_REQUIRED",
      ClientId: config.userPoolClientId,
      Session: data.Session,
      ChallengeResponses: { USERNAME: email, NEW_PASSWORD: newPassword },
    });
  }
  if (!data.AuthenticationResult) throw new Error("Login não concluído.");
  saveTokens(data.AuthenticationResult);
}

export async function getIdToken() {
  const auth = readAuth();
  if (!auth?.refreshToken) throw new Error("not-authenticated");
  if (auth.exp - Date.now() > 60_000) return auth.idToken;
  try {
    const data = await cognito("InitiateAuth", {
      AuthFlow: "REFRESH_TOKEN_AUTH",
      ClientId: config.userPoolClientId,
      AuthParameters: { REFRESH_TOKEN: auth.refreshToken },
    });
    return saveTokens(data.AuthenticationResult, auth.refreshToken).idToken;
  } catch (e) {
    if (e.code === "NotAuthorizedException") logout();
    throw e;
  }
}
