import { config, hasKisCredentials } from "../config.js";

export interface KisCredentialStatus {
  hasAppKey: boolean;
  hasAppSecret: boolean;
  environment: "real" | "virtual";
}

interface KisAccessTokenResponse {
  access_token?: unknown;
}

interface KisApprovalKeyResponse {
  approval_key?: unknown;
}

export const getKisCredentialStatus = (): KisCredentialStatus => ({
  hasAppKey: Boolean(config.KIS_APP_KEY),
  hasAppSecret: Boolean(config.KIS_APP_SECRET),
  environment: config.KIS_ENVIRONMENT
});

const getKisRestBaseUrl = (): string => {
  if (!config.KIS_REST_BASE_URL) {
    throw new Error("KIS REST base URL is not configured.");
  }

  return config.KIS_REST_BASE_URL;
};

export const requestKisAccessToken = async (): Promise<string> => {
  if (!hasKisCredentials()) {
    throw new Error("KIS credentials are not configured.");
  }

  const response = await fetch(
    `${getKisRestBaseUrl()}/oauth2/tokenP`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        grant_type: "client_credentials",
        appkey: config.KIS_APP_KEY,
        appsecret: config.KIS_APP_SECRET,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`KIS access token request failed: HTTP ${response.status}`);
  }

  const data = (await response.json()) as KisAccessTokenResponse;

  if (typeof data.access_token !== "string" || data.access_token.length === 0) {
    throw new Error("KIS access token response is invalid.");
  }

  return data.access_token;
};

export const requestKisApprovalKey = async (): Promise<string> => {
  if (!hasKisCredentials()) {
    throw new Error("KIS credentials are not configured.");
  }

  const response = await fetch(
    `${getKisRestBaseUrl()}/oauth2/Approval`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=UTF-8",
      },
      body: JSON.stringify({
        grant_type: "client_credentials",
        appkey: config.KIS_APP_KEY,
        secretkey: config.KIS_APP_SECRET,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`KIS approval key request failed: HTTP ${response.status}`);
  }

  const data = (await response.json()) as KisApprovalKeyResponse;

  if (typeof data.approval_key !== "string" || data.approval_key.length === 0) {
    throw new Error("KIS approval key response is invalid.");
  }

  return data.approval_key;
};

