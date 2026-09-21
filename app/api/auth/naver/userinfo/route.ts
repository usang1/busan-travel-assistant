const naverUserInfoUrl = "https://openapi.naver.com/v1/nid/me";

type NaverProfile = {
  id?: unknown;
  email?: unknown;
  nickname?: unknown;
  name?: unknown;
  profile_image?: unknown;
};

type NaverUserInfoResponse = {
  resultcode?: unknown;
  response?: NaverProfile;
};

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function noStoreJson(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");

  if (!authorization || !/^Bearer\s+\S+$/i.test(authorization) || authorization.length > 8192) {
    return noStoreJson({ error: "missing_or_invalid_authorization" }, 401);
  }

  let upstream: Response;

  try {
    upstream = await fetch(naverUserInfoUrl, {
      headers: {
        Accept: "application/json",
        Authorization: authorization,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return noStoreJson({ error: "naver_userinfo_unavailable" }, 502);
  }

  if (!upstream.ok) {
    return noStoreJson({ error: "naver_userinfo_rejected" }, upstream.status);
  }

  let payload: NaverUserInfoResponse;

  try {
    payload = (await upstream.json()) as NaverUserInfoResponse;
  } catch {
    return noStoreJson({ error: "invalid_naver_userinfo_response" }, 502);
  }

  const profile = payload.response;
  const providerId = optionalString(profile?.id);

  if (payload.resultcode !== "00" || !providerId) {
    return noStoreJson({ error: "invalid_naver_userinfo_response" }, 502);
  }

  const email = optionalString(profile?.email);
  const nickname = optionalString(profile?.nickname);
  const name = optionalString(profile?.name) ?? nickname;
  const picture = optionalString(profile?.profile_image);

  return noStoreJson({
    sub: providerId,
    provider_id: providerId,
    ...(email ? { email } : {}),
    ...(name ? { name, full_name: name } : {}),
    ...(nickname ? { nickname, preferred_username: nickname } : {}),
    ...(picture ? { picture, avatar_url: picture } : {}),
  });
}
