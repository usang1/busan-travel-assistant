import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import ts from "typescript";

const testEnv = {
  GOOGLE_MAPS_API_KEY: "google-test-key",
  NAVER_SEARCH_CLIENT_ID: "naver-client-id",
  NAVER_SEARCH_CLIENT_SECRET: "naver-client-secret",
  KAKAO_REST_API_KEY: "kakao-test-key",
};

function loadTsModule(path, aliases = {}) {
  const source = readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: false,
    },
  });
  const module = { exports: {} };
  const require = (specifier) => {
    if (specifier in aliases) return aliases[specifier];
    throw new Error(`Unexpected runtime import in test for ${path}: ${specifier}`);
  };

  new Script(outputText, { filename: path }).runInNewContext({
    module,
    exports: module.exports,
    require,
    console,
    process: { env: testEnv },
    URL,
  });

  return module.exports;
}

const detection = loadTsModule("lib/place-providers/detect.ts");
const mapUrl = loadTsModule("lib/map-url.ts", {
  "@/lib/place-providers/detect": detection,
});
const normalize = loadTsModule("lib/place-providers/normalize.ts", {
  "@/lib/map-url": mapUrl,
});
const google = loadTsModule("lib/place-providers/google.ts", {
  "@/lib/place-providers/normalize": normalize,
});
const naver = loadTsModule("lib/place-providers/naver.ts", {
  "@/lib/place-providers/normalize": normalize,
});
const kakao = loadTsModule("lib/place-providers/kakao.ts", {
  "@/lib/place-providers/normalize": normalize,
});
const registry = loadTsModule("lib/place-providers/registry.ts", {
  "@/lib/place-providers/google": google,
  "@/lib/place-providers/naver": naver,
  "@/lib/place-providers/kakao": kakao,
});
const mapLinkAnalysis = loadTsModule("lib/map-link-analysis.ts", {
  "@/lib/map-url": mapUrl,
});
const resolver = loadTsModule("lib/map-url-resolver.ts", {
  "@/lib/map-link-analysis": mapLinkAnalysis,
  "@/lib/map-url": mapUrl,
  "@/lib/place-providers/detect": detection,
  "@/lib/place-providers/normalize": normalize,
  "@/lib/place-providers/registry": registry,
});

assert.equal(detection.detectPlaceProvider("https://www.google.com/maps/place/Gwangalli"), "google");
assert.equal(detection.detectPlaceProvider("https://maps.google.com/?q=Busan"), "google");
assert.equal(detection.detectPlaceProvider("https://maps.app.goo.gl/short"), "google");
assert.equal(detection.detectPlaceProvider("https://map.naver.com/p/search/test"), "naver");
assert.equal(detection.detectPlaceProvider("https://m.place.naver.com/restaurant/123/home"), "naver");
assert.equal(detection.detectPlaceProvider("https://naver.me/short"), "naver");
assert.equal(detection.detectPlaceProvider("https://map.kakao.com/link/map/test,35.1,129.1"), "kakao");
assert.equal(detection.detectPlaceProvider("https://place.map.kakao.com/123"), "kakao");
assert.equal(detection.detectPlaceProvider("https://kko.kakao.com/short"), "kakao");
assert.equal(detection.detectPlaceProvider("https://www.google.com/search?q=maps"), "unknown");

const googlePlaceId = "ChIJN1t_tDeuEmsRUsoyG83frY4";
const googleIdUrl = `https://www.google.com/maps/search/?api=1&query=Gwangalli&query_place_id=${googlePlaceId}`;
assert.equal(mapUrl.parseMapUrl(googleIdUrl).placeId, googlePlaceId);
assert.equal(mapUrl.parseMapUrl("https://www.google.com/maps/place/Test/data=!4m2!3m1!1sChIJAbc_123-xyz").placeId, "ChIJAbc_123-xyz");
assert.equal(mapUrl.parseMapUrl("https://map.naver.com/p/entry/place/1435915485").placeId, "1435915485");
assert.equal(mapUrl.parseMapUrl("https://place.map.kakao.com/12345").placeId, "12345");
assert.equal(mapUrl.parseMapUrl("https://map.kakao.com/link/map/Test,0,0").latitude, undefined);
assert.equal(mapUrl.parseMapUrl("https://map.naver.com/?lat=NaN&lng=NaN").latitude, undefined);
assert.equal(mapUrl.parseMapUrl("https://map.kakao.com/link/map/Test,95,190").latitude, undefined);

const googleDetailsFetcher = async (input, init = {}) => {
  const url = input.toString();
  if (url.startsWith("https://places.googleapis.com/v1/places/")) {
    assert.equal(init.headers["X-Goog-Api-Key"], "google-test-key");
    return jsonResponse({
      id: googlePlaceId,
      displayName: { text: "광안리해수욕장" },
      formattedAddress: "대한민국 부산광역시 수영구 광안해변로 219",
      location: { latitude: 35.1532, longitude: 129.1186 },
      nationalPhoneNumber: "051-000-0000",
      websiteUri: "https://example.com",
      regularOpeningHours: { weekdayDescriptions: ["월요일: 24시간 영업"] },
      rating: 4.6,
      userRatingCount: 321,
      priceLevel: "PRICE_LEVEL_FREE",
      primaryTypeDisplayName: { text: "해변" },
      photos: [{ name: "places/test/photos/photo" }],
    });
  }
  return htmlResponse();
};
const googleDetails = await resolver.resolveMapUrl(googleIdUrl, googleDetailsFetcher);
assert.equal(googleDetails.provider, "google");
assert.equal(googleDetails.normalizedPlace.providerPlaceId, googlePlaceId);
assert.equal(googleDetails.normalizedPlace.name, "광안리해수욕장");
assert.equal(googleDetails.normalizedPlace.formattedAddress, "대한민국 부산광역시 수영구 광안해변로 219");
assert.equal(googleDetails.normalizedPlace.latitude, 35.1532);
assert.equal(googleDetails.normalizedPlace.longitude, 129.1186);
assert.equal(googleDetails.normalizedPlace.reviewCount, 321);
assert.equal(googleDetails.coordinateSource, "provider-lookup");

const googleShort = await resolver.resolveMapUrl("https://maps.app.goo.gl/short", async (input, init = {}) => {
  const url = input.toString();
  if (url.includes("maps.app.goo.gl") && init.method === "HEAD") {
    return { ...htmlResponse(), ok: false, status: 403 };
  }
  if (url.includes("maps.app.goo.gl")) {
    return redirectResponse(googleIdUrl);
  }
  return googleDetailsFetcher(input, init);
});
assert.equal(googleShort.resolvedUrl, googleIdUrl);
assert.equal(googleShort.normalizedPlace.providerPlaceId, googlePlaceId);
assert.equal(googleShort.normalizedPlace.latitude, 35.1532);

const googleTextSearch = await resolver.resolveMapUrl(
  "https://www.google.com/maps/place/Gwangalli+Beach",
  async (input, init = {}) => {
    const url = input.toString();
    if (url.endsWith("places:searchText")) {
      assert.equal(init.method, "POST");
      return jsonResponse({ places: [{ id: "ChIJTextSearch", displayName: { text: "Gwangalli Beach" }, formattedAddress: "Busan", location: { latitude: 35.1532, longitude: 129.1186 } }] });
    }
    return htmlResponse();
  },
);
assert.equal(googleTextSearch.normalizedPlace.providerPlaceId, "ChIJTextSearch");
assert.equal(googleTextSearch.normalizedPlace.name, "Gwangalli Beach");

const naverUrl = "https://map.naver.com/?pinId=1435915485&title=%EC%A7%84%EC%86%A1%EC%88%AF%EB%B6%88%20%EC%88%98%EC%98%81%EC%A0%90";
const naverResolved = await resolver.resolveMapUrl(naverUrl, async (input) => {
  const url = input.toString();
  if (url.startsWith("https://openapi.naver.com/v1/search/local.json")) {
    return jsonResponse({ items: [{ title: "<b>진송숯불 수영점</b>", link: "https://map.naver.com/p/entry/place/1435915485", category: "한식>육류", address: "부산 수영구", roadAddress: "부산 수영구 수영로", mapx: "1291170388", mapy: "351671242" }] });
  }
  return htmlResponse();
});
assert.equal(naverResolved.normalizedPlace.providerPlaceId, "1435915485");
assert.equal(naverResolved.normalizedPlace.name, "진송숯불 수영점");
assert.equal(naverResolved.normalizedPlace.roadAddressKo, "부산 수영구 수영로");
assert.equal(naverResolved.normalizedPlace.latitude, 35.1671242);
assert.equal(naverResolved.normalizedPlace.longitude, 129.1170388);

const naverShort = await resolver.resolveMapUrl("https://naver.me/short", async (input, init = {}) => {
  const url = input.toString();
  if (url.includes("naver.me") && init.method === "HEAD") return redirectResponse(naverUrl);
  if (url.startsWith("https://openapi.naver.com")) return jsonResponse({ items: [{ title: "진송숯불 수영점", link: "https://map.naver.com/p/entry/place/1435915485", address: "부산 수영구", mapx: "1291170388", mapy: "351671242" }] });
  return htmlResponse();
});
assert.equal(naverShort.resolvedUrl, naverUrl);
assert.equal(naverShort.normalizedPlace.latitude, 35.1671242);

const kakaoUrl = "https://place.map.kakao.com/12345?placeName=%EA%B4%91%EC%95%88%EB%A6%AC";
const kakaoResolved = await resolver.resolveMapUrl(kakaoUrl, async (input) => {
  const url = input.toString();
  if (url.startsWith("https://dapi.kakao.com/v2/local/search/keyword.json")) {
    return jsonResponse({ documents: [{ id: "12345", place_name: "광안리", category_name: "관광명소 > 해수욕장", phone: "051-000-0000", address_name: "부산 수영구 광안동", road_address_name: "부산 수영구 광안해변로", x: "129.1186", y: "35.1532", place_url: "https://place.map.kakao.com/12345" }] });
  }
  return htmlResponse();
});
assert.equal(kakaoResolved.normalizedPlace.providerPlaceId, "12345");
assert.equal(kakaoResolved.normalizedPlace.name, "광안리");
assert.equal(kakaoResolved.normalizedPlace.formattedAddress, "부산 수영구 광안해변로");
assert.equal(kakaoResolved.normalizedPlace.latitude, 35.1532);
assert.equal(kakaoResolved.normalizedPlace.longitude, 129.1186);

const kakaoShort = await resolver.resolveMapUrl("https://kko.kakao.com/short", async (input, init = {}) => {
  const url = input.toString();
  if (url.includes("kko.kakao.com") && init.method === "HEAD") return redirectResponse(kakaoUrl);
  if (url.startsWith("https://dapi.kakao.com")) return jsonResponse({ documents: [{ id: "12345", place_name: "광안리", x: "129.1186", y: "35.1532" }] });
  return htmlResponse();
});
assert.equal(kakaoShort.resolvedUrl, kakaoUrl);
assert.equal(kakaoShort.normalizedPlace.providerPlaceId, "12345");

await assert.rejects(() => resolver.resolveMapUrl("https://example.com/place/123", async () => htmlResponse()), /네이버\/카카오\/구글 지도 링크/);

function jsonResponse(value, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name) => name.toLowerCase() === "content-type" ? "application/json" : null },
    bodyUsed: false,
    json: async () => value,
    text: async () => JSON.stringify(value),
  };
}

function htmlResponse(html = "") {
  return {
    ok: true,
    status: 200,
    headers: { get: (name) => name.toLowerCase() === "content-type" ? "text/html" : null },
    bodyUsed: false,
    json: async () => ({}),
    text: async () => html,
  };
}

function redirectResponse(location) {
  return {
    ok: false,
    status: 302,
    headers: { get: (name) => name.toLowerCase() === "location" ? location : null },
    bodyUsed: false,
    json: async () => ({}),
    text: async () => "",
  };
}
