import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import ts from "typescript";

const testEnv = {
  GOOGLE_MAPS_API_KEY: "google-test-key",
  OPENAI_API_KEY: "openai-test-key",
  OPENAI_PLACE_MODEL: "gpt-test-model",
  NAVER_SEARCH_CLIENT_ID: "naver-client-id",
  NAVER_SEARCH_CLIENT_SECRET: "naver-client-secret",
  KAKAO_REST_API_KEY: "kakao-test-key",
};

function loadTsModule(path, aliases = {}, env = testEnv) {
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
    process: { env },
    URL,
  });

  return module.exports;
}

const detection = loadTsModule("lib/place-providers/detect.ts");
const capabilities = loadTsModule("lib/place-providers/capabilities.ts");
const mapUrl = loadTsModule("lib/map-url.ts", {
  "@/lib/place-providers/detect": detection,
});
const normalize = loadTsModule("lib/place-providers/normalize.ts", {
  "@/lib/map-url": mapUrl,
});
const placeDraft = loadTsModule("lib/place-draft.ts");
let webSearchRequest;
class FakeWebSearchOpenAI {
  constructor() {
    this.responses = {
      create: async (request) => {
        webSearchRequest = request;
        return {
          output_text: JSON.stringify({
            phone: { value: "051-999-9999", confidence: 0.95, sourceUrls: ["https://official.example/place"] },
            openingHours: { value: "17:00-02:00", confidence: 0.82, sourceUrls: ["https://official.example/place"] },
            closedDays: { value: null, confidence: 0, sourceUrls: [] },
            menu: { value: [{ name: "깐풍육", price: null }], confidence: 0.9, sourceUrls: ["https://official.example/menu"] },
            priceRange: { value: { min: 12000, max: 30000 }, confidence: 0.8, sourceUrls: ["https://official.example/menu"] },
            parking: { value: true, confidence: 0.9, sourceUrls: ["https://official.example/place"] },
            description: { value: "중식 요리와 주류를 함께 판매하는 중식 요리주점", confidence: 0.85, sourceUrls: ["https://official.example/place"] },
            websiteUrl: { value: "https://official.example", confidence: 0.9, sourceUrls: ["https://official.example/place"] },
            sources: [{ title: "공식 페이지", url: "https://official.example/place", type: "OFFICIAL" }],
          }),
          output: [{ type: "web_search_call", action: { sources: [{ title: "공식 페이지", url: "https://official.example/place" }] } }],
        };
      },
    };
  }
}
const webSearch = loadTsModule("lib/place-web-search.ts", {
  openai: FakeWebSearchOpenAI,
  "@/lib/openai-errors": { toPublicOpenAiError: (error) => error },
  "@/lib/place-draft": placeDraft,
});
class FailingWebSearchOpenAI {
  constructor() {
    this.responses = { create: async () => { throw new Error("web search unavailable"); } };
  }
}
const failingWebSearch = loadTsModule("lib/place-web-search.ts", {
  openai: FailingWebSearchOpenAI,
  "@/lib/openai-errors": { toPublicOpenAiError: (error) => error },
  "@/lib/place-draft": placeDraft,
});
const google = loadTsModule("lib/place-providers/google.ts", {
  "@/lib/place-providers/normalize": normalize,
});
const naver = loadTsModule("lib/place-providers/naver.ts", {
  "@/lib/place-providers/normalize": normalize,
});
const naverHub = loadTsModule("lib/place-providers/naver.ts", {
  "@/lib/place-providers/normalize": normalize,
}, {
  NAVER_API_HUB_CLIENT_ID: "hub-client-id",
  NAVER_API_HUB_CLIENT_SECRET: "hub-client-secret",
});
const kakao = loadTsModule("lib/place-providers/kakao.ts", {
  "@/lib/place-providers/normalize": normalize,
});
const nearestStation = loadTsModule("lib/place-providers/nearest-station.ts", {
  "@/lib/place-providers/normalize": normalize,
});
const registry = loadTsModule("lib/place-providers/registry.ts", {
  "@/lib/place-providers/google": google,
  "@/lib/place-providers/naver": naver,
  "@/lib/place-providers/kakao": kakao,
});
const unconfiguredRegistry = loadTsModule("lib/place-providers/registry.ts", {
  "@/lib/place-providers/google": google,
  "@/lib/place-providers/naver": naver,
  "@/lib/place-providers/kakao": kakao,
}, {});
const mapLinkAnalysis = loadTsModule("lib/map-link-analysis.ts", {
  "@/lib/map-url": mapUrl,
});
const resolver = loadTsModule("lib/map-url-resolver.ts", {
  "@/lib/map-link-analysis": mapLinkAnalysis,
  "@/lib/map-url": mapUrl,
  "@/lib/place-providers/detect": detection,
  "@/lib/place-providers/normalize": normalize,
  "@/lib/place-providers/nearest-station": nearestStation,
  "@/lib/place-providers/registry": registry,
  "@/lib/place-providers/capabilities": capabilities,
});
const databaseRuntime = {
  placeCategories: ["restaurant", "cafe", "bar", "attraction", "shopping", "photo_spot", "luggage"],
};
const enrichment = loadTsModule("lib/admin-place-enrichment.ts", {
  "@/lib/place-providers/normalize": normalize,
  "@/lib/place-ai/locale-validation": loadTsModule("lib/place-ai/locale-validation.ts"),
});
const location = loadTsModule("lib/location.ts");
const duplicates = loadTsModule("lib/place-duplicates.ts", {
  "@/lib/location": location,
  "@/lib/place-providers/normalize": normalize,
});
const validation = loadTsModule("lib/place-validation.ts", {
  "@/lib/place-providers/normalize": normalize,
  "@/types/database": databaseRuntime,
});
class FakeOpenAI {}
const openAiErrors = loadTsModule("lib/openai-errors.ts");
const adminSummary = loadTsModule("lib/place-ai/admin-summary.ts", {
  openai: FakeOpenAI,
  "@/lib/openai-errors": openAiErrors,
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
assert.deepEqual([...capabilities.getProviderCapabilities("google").map(({ field }) => field)], [
  "name", "category", "address", "coordinates", "phone", "website", "openingHours", "rating", "reviewCount", "priceLevel", "photos", "providerPlaceId", "sourceUrl",
]);
assert.deepEqual([...capabilities.getProviderCapabilities("naver").map(({ field }) => field)], [
  "name", "category", "address", "coordinates", "phone", "providerPlaceId", "sourceUrl",
]);
assert.equal(capabilities.formatProviderWarnings(["photos_not_supported", "price_not_supported"]).join(" · "), "사진 정보 없음 · 가격대 정보 없음");

const sparseProviderPlace = {
  provider: "kakao",
  sourceUrl: "https://place.map.kakao.com/12345",
  providerPlaceId: "12345",
  name: "테스트 중식당",
  category: "restaurant",
  addressKo: "부산 수영구",
  latitude: 35.15,
  longitude: 129.11,
  phone: "051-111-1111",
};
const sparseDraft = placeDraft.createPlaceDraft(sparseProviderPlace);
assert.ok(sparseDraft.fieldSources.name);
assert.ok(sparseDraft.fieldSources.phone);
assert.deepEqual([...placeDraft.getMissingPlaceFields(sparseDraft)], ["openingHours", "closedDays", "menu", "priceRange", "parking", "description", "websiteUrl"]);
const webResult = await webSearch.searchMissingPlaceDataCached(sparseDraft, placeDraft.getMissingPlaceFields(sparseDraft));
assert.equal(webSearchRequest.tools[0].type, "web_search");
assert.deepEqual([...webResult.needsReviewFields], ["openingHours", "priceRange"]);
const mergedSparse = placeDraft.mergePlaceData(sparseProviderPlace, webResult.data);
assert.equal(mergedSparse.normalizedPlace.phone, "051-111-1111");
assert.equal(mergedSparse.normalizedPlace.description, "중식 요리와 주류를 함께 판매하는 중식 요리주점");
assert.equal(mergedSparse.normalizedPlace.website, "https://official.example");
assert.equal(mergedSparse.normalizedPlace.openingHours, undefined);
assert.equal(mergedSparse.normalizedPlace.menu[0].name, "깐풍육");
assert.equal(mergedSparse.normalizedPlace.amenities.parking, true);
assert.equal(mergedSparse.normalizedPlace.priceRange, undefined);
assert.equal(mergedSparse.normalizedPlace.photos, undefined);

const providerConflict = placeDraft.mergePlaceData(sparseProviderPlace, {
  phone: { value: "051-000-0000", confidence: 0.99, sourceUrls: ["https://official.example/place"] },
  sources: [{ title: "공식 페이지", url: "https://official.example/place", type: "OFFICIAL" }],
});
assert.equal(providerConflict.normalizedPlace.phone, "051-111-1111");

const unsupportedSearchFact = placeDraft.mergePlaceData(sparseProviderPlace, {
  description: { value: "근거 없는 설명", confidence: 0.99, sourceUrls: [] },
  sources: [],
});
assert.equal(unsupportedSearchFact.normalizedPlace.description, undefined);
assert.deepEqual([...unsupportedSearchFact.needsReviewFields], ["description"]);

const providerComplete = placeDraft.createPlaceDraft({
  ...sparseProviderPlace,
  openingHours: ["월요일: 10:00-20:00"],
  closedDays: ["연중무휴"],
  menu: [{ name: "대표 메뉴", price: 10000 }],
  priceRange: { min: 10000, max: 20000, currency: "KRW" },
  amenities: { parking: true },
  description: "Provider 설명",
  website: "https://official.example",
});
assert.deepEqual([...placeDraft.getMissingPlaceFields(providerComplete)], []);
await assert.rejects(
  () => failingWebSearch.searchMissingPlaceData(sparseDraft, ["description"]),
  /web search unavailable/,
);

const providerWithLevelOnly = placeDraft.createPlaceDraft({
  ...sparseProviderPlace,
  priceLevel: 2,
});
assert.deepEqual([...placeDraft.getMissingPlaceFields(providerWithLevelOnly)], ["openingHours", "closedDays", "menu", "priceRange", "parking", "description", "websiteUrl"]);

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
  if (url.startsWith("https://dapi.kakao.com/v2/local/search/category.json")) {
    return jsonResponse({ documents: [{ id: "station-1", place_name: "광안역 부산2호선", distance: "420" }] });
  }
  if (url.includes("/photos/") && url.includes("/media")) {
    assert.equal(new URL(url).searchParams.get("key"), "google-test-key");
    assert.equal(new URL(url).searchParams.get("skipHttpRedirect"), "true");
    return jsonResponse({ photoUri: "https://lh3.googleusercontent.com/place-preview" });
  }
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
      priceRange: { startPrice: { currencyCode: "KRW", units: "5000" }, endPrice: { currencyCode: "KRW", units: "12000" } },
      parkingOptions: { freeParkingLot: true },
      reservable: true,
      takeout: false,
      restroom: true,
      primaryTypeDisplayName: { text: "해변" },
      types: ["tourist_attraction", "beach"],
      photos: [{
        name: "places/test/photos/photo",
        widthPx: 1200,
        heightPx: 800,
        authorAttributions: [{ displayName: "지도 사용자", uri: "https://maps.google.com/contrib/test" }],
      }],
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
assert.deepEqual([...googleDetails.normalizedPlace.types], ["tourist_attraction", "beach"]);
assert.equal(googleDetails.normalizedPlace.priceMin, 5000);
assert.equal(googleDetails.normalizedPlace.priceMax, 12000);
assert.equal(googleDetails.normalizedPlace.priceRange.currency, "KRW");
assert.equal(googleDetails.normalizedPlace.primaryImageUrl, "https://lh3.googleusercontent.com/place-preview");
assert.equal(googleDetails.normalizedPlace.photos[0].persistence, "preview_only");
assert.match(googleDetails.normalizedPlace.photos[0].attribution, /지도 사용자/);
assert.equal("photos" in googleDetails.normalizedPlace.raw, false);
assert.equal(googleDetails.normalizedPlace.raw.photoCount, 1);
assert.equal(googleDetails.normalizedPlace.amenities.parking, true);
assert.equal(googleDetails.normalizedPlace.amenities.reservable, true);
assert.equal(googleDetails.coordinateSource, "provider-lookup");
assert.equal(googleDetails.normalizedPlace.nearestStation, "광안역 부산2호선");
assert.equal(googleDetails.normalizedPlace.nearestStationWalkingMinutes, 6);
assert.equal(googleDetails.providerLookup.configured, true);
assert.equal(googleDetails.providerLookup.enriched, true);

const googlePhotoFailure = await resolver.resolveMapUrl(googleIdUrl, async (input, init = {}) => {
  const url = input.toString();
  if (url.includes("/photos/") && url.includes("/media")) {
    return jsonResponse({ error: { status: "PERMISSION_DENIED" } }, 403);
  }
  return googleDetailsFetcher(input, init);
});
assert.equal(googlePhotoFailure.providerLookup.enriched, true);
assert.equal(googlePhotoFailure.normalizedPlace.photos, undefined);
assert.match(googlePhotoFailure.normalizedPlace.providerWarnings[0], /Google 사진 조회에 실패/);
assert.equal(unconfiguredRegistry.getPlaceProviderConfiguration("google").configured, false);
assert.deepEqual([...unconfiguredRegistry.getPlaceProviderConfiguration("naver").missingEnvironmentVariables], ["NAVER_API_HUB_CLIENT_ID", "NAVER_API_HUB_CLIENT_SECRET"]);

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
assert.equal(googleTextSearch.normalizedPlace.photos, undefined);

const googlePlacePath = "https://www.google.com/maps/place/Gwangalli+Beach/@35.1532,129.1186,17z/data=!3m1!4b1";
const parsedGooglePlacePath = mapUrl.parseMapUrl(googlePlacePath);
assert.equal(parsedGooglePlacePath.title, "Gwangalli Beach");
assert.equal(parsedGooglePlacePath.latitude, 35.1532);
assert.equal(parsedGooglePlacePath.longitude, 129.1186);
const googlePlacePathResolved = await resolver.resolveMapUrl(googlePlacePath, async (input) => {
  const url = input.toString();
  if (url.endsWith("places:searchText")) {
    return jsonResponse({ places: [{
      id: "ChIJPathPlace",
      displayName: { text: "Gwangalli Beach" },
      formattedAddress: "Busan",
      location: { latitude: 35.1532, longitude: 129.1186 },
    }] });
  }
  return htmlResponse();
});
assert.equal(googlePlacePathResolved.normalizedPlace.providerPlaceId, "ChIJPathPlace");
assert.equal(googlePlacePathResolved.normalizedPlace.name, "Gwangalli Beach");

const googleWithoutPrice = await resolver.resolveMapUrl(
  `https://www.google.com/maps/search/?api=1&query=Cafe&query_place_id=${googlePlaceId}`,
  async (input) => {
    const url = input.toString();
    if (url.startsWith("https://places.googleapis.com/v1/places/")) {
      return jsonResponse({
        id: googlePlaceId,
        displayName: { text: "가격 정보 없는 카페" },
        formattedAddress: "부산 수영구 광안해변로 1",
        location: { latitude: 35.15, longitude: 129.11 },
        primaryType: "cafe",
      });
    }
    return htmlResponse();
  },
);
assert.equal(googleWithoutPrice.normalizedPlace.priceLevel, undefined);
assert.equal(googleWithoutPrice.normalizedPlace.priceRange, undefined);

const googleRestaurant = await resolver.resolveMapUrl(
  "https://www.google.com/maps/search/?api=1&query=Restaurant&query_place_id=ChIJRestaurant",
  async (input) => {
    const url = input.toString();
    if (url.startsWith("https://places.googleapis.com/v1/places/")) {
      return jsonResponse({
        id: "ChIJRestaurant",
        displayName: { text: "테스트 음식점" },
        formattedAddress: "부산 수영구 테스트로 10",
        location: { latitude: 35.16, longitude: 129.12 },
        nationalPhoneNumber: "051-123-4567",
        websiteUri: "https://restaurant.example",
        currentOpeningHours: { weekdayDescriptions: ["월요일: 오전 11:00~오후 9:00"] },
        primaryType: "restaurant",
        types: ["restaurant", "food"],
      });
    }
    return htmlResponse();
  },
);
assert.equal(googleRestaurant.normalizedPlace.category, "restaurant");
assert.equal(googleRestaurant.normalizedPlace.phone, "051-123-4567");
assert.equal(googleRestaurant.normalizedPlace.website, "https://restaurant.example");
assert.deepEqual([...googleRestaurant.normalizedPlace.currentOpeningHours], ["월요일: 오전 11:00~오후 9:00"]);

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

const naverHubPlace = await naverHub.naverMapsProvider.lookup({
  sourceUrl: naverUrl,
  finalResolvedUrl: naverUrl,
  parsedUrls: [mapUrl.parseMapUrl(naverUrl)],
  fetcher: async (input, init = {}) => {
    const url = new URL(input.toString());
    assert.equal(url.origin + url.pathname, "https://naverapihub.apigw.ntruss.com/search/v1/local");
    assert.equal(url.searchParams.get("format"), "json");
    assert.equal(init.headers["X-NCP-APIGW-API-KEY-ID"], "hub-client-id");
    assert.equal(init.headers["X-NCP-APIGW-API-KEY"], "hub-client-secret");
    return jsonResponse({ items: [{ title: "진송숯불 수영점", category: "한식>육류", address: "부산 수영구", roadAddress: "부산 수영구 수영로", mapx: "1291170388", mapy: "351671242" }] });
  },
});
assert.equal(naverHubPlace.name, "진송숯불 수영점");
assert.deepEqual([...naverHubPlace.types], ["한식", "육류"]);

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

const naverWrongSearchResult = await resolver.resolveMapUrl(naverUrl, async (input) => {
  const url = input.toString();
  if (url.startsWith("https://openapi.naver.com")) {
    return jsonResponse({ items: [{
      title: "전혀 다른 장소",
      link: "https://map.naver.com/p/entry/place/9999999999",
      address: "부산 해운대구",
      mapx: "1291600000",
      mapy: "351800000",
    }] });
  }
  return htmlResponse();
});
assert.equal(naverWrongSearchResult.normalizedPlace.name, "진송숯불 수영점");
assert.equal(naverWrongSearchResult.providerLookup.enriched, false);
assert.match(naverWrongSearchResult.providerLookup.message, /일치하는 상세 장소/);

const kakaoWrongSearchResult = await resolver.resolveMapUrl(kakaoUrl, async (input) => {
  const url = input.toString();
  if (url.startsWith("https://dapi.kakao.com/v2/local/search/keyword.json")) {
    return jsonResponse({ documents: [{
      id: "99999",
      place_name: "전혀 다른 장소",
      x: "129.18",
      y: "35.18",
    }] });
  }
  return htmlResponse();
});
assert.equal(kakaoWrongSearchResult.normalizedPlace.name, "광안리");
assert.equal(kakaoWrongSearchResult.providerLookup.enriched, false);

const googleProviderFailure = await resolver.resolveMapUrl(googleIdUrl, async (input) => {
  const url = input.toString();
  if (url.startsWith("https://places.googleapis.com/v1/places/")) {
    return jsonResponse({ error: { status: "PERMISSION_DENIED" } }, 403);
  }
  return htmlResponse();
});
assert.equal(googleProviderFailure.normalizedPlace.providerPlaceId, googlePlaceId);
assert.equal(googleProviderFailure.normalizedPlace.name, "Gwangalli");
assert.equal(googleProviderFailure.normalizedPlace.latitude, undefined);
assert.match(googleProviderFailure.lookupError, /Google Places 상세 조회에 실패/);
assert.equal(googleProviderFailure.providerLookup.enriched, false);

await assert.rejects(() => resolver.resolveMapUrl("https://example.com/place/123", async () => htmlResponse()), /네이버\/카카오\/구글 지도 링크/);

const emptyForm = {
  source_url: "",
  provider: "MANUAL",
  source_external_id: "",
  name_ko: "",
  name_zh: "",
  category: "",
  address_ko: "",
  address_zh: "",
  address_en: "",
  address_ja: "",
  latitude: "",
  longitude: "",
  phone: "",
  website: "",
  opening_hours: "",
  price_level: "",
  price_min: "",
  price_max: "",
  thumbnail_url: "",
  provider_image_preview_url: "",
  provider_image_attribution: "",
  nearest_station: "",
  walking_minutes: "",
  provider_rating: "",
  provider_review_count: "",
  provider_amenities: "",
  source_metadata: null,
  source_fetched_at: "",
};
const enrichedGoogleForm = enrichment.enrichPlaceForm(emptyForm, {
  ...googleDetails.normalizedPlace,
  category: "cafe",
  priceMin: 5000,
  priceMax: 12000,
});
assert.equal(enrichment.enrichPlaceForm(emptyForm, googleRestaurant.normalizedPlace).opening_hours, "월요일: 오전 11:00~오후 9:00");
assert.equal(enrichedGoogleForm.provider, "GOOGLE");
assert.equal(enrichedGoogleForm.name_ko, "광안리해수욕장");
assert.equal(enrichedGoogleForm.category, "cafe");
assert.equal(enrichedGoogleForm.address_ko, "대한민국 부산광역시 수영구 광안해변로 219");
assert.equal(enrichedGoogleForm.phone, "051-000-0000");
assert.equal(enrichedGoogleForm.website, "https://example.com");
assert.equal(enrichedGoogleForm.price_level, "0");
assert.equal(enrichedGoogleForm.price_min, "5000");
assert.equal(enrichedGoogleForm.price_max, "12000");
assert.equal(enrichedGoogleForm.thumbnail_url, "");
assert.equal(enrichedGoogleForm.provider_image_preview_url, "https://lh3.googleusercontent.com/place-preview");
assert.match(enrichedGoogleForm.provider_image_attribution, /지도 사용자/);
assert.equal(enrichedGoogleForm.provider_rating, "4.6");
assert.equal(enrichedGoogleForm.provider_review_count, "321");
assert.equal(enrichedGoogleForm.provider_amenities, "주차: 가능 · 예약 지원: 가능 · 포장: 불가 · 화장실: 가능");
assert.equal(enrichedGoogleForm.nearest_station, "광안역 부산2호선");
assert.equal(enrichedGoogleForm.walking_minutes, "6");

const preservedForm = enrichment.enrichPlaceForm({
  ...emptyForm,
  name_ko: "관리자 장소명",
  address_ko: "관리자 주소",
  latitude: "35.1000000",
  longitude: "129.1000000",
  phone: "관리자 전화",
  website: "https://admin.example",
  opening_hours: "관리자 영업시간",
  price_level: "3",
  thumbnail_url: "https://admin.example/image.jpg",
}, googleDetails.normalizedPlace);
assert.equal(preservedForm.name_ko, "관리자 장소명");
assert.equal(preservedForm.address_ko, "관리자 주소");
assert.equal(preservedForm.latitude, "35.1000000");
assert.equal(preservedForm.longitude, "129.1000000");
assert.equal(preservedForm.phone, "관리자 전화");
assert.equal(preservedForm.website, "https://admin.example");
assert.equal(preservedForm.opening_hours, "관리자 영업시간");
assert.equal(preservedForm.price_level, "3");
assert.equal(preservedForm.thumbnail_url, "https://admin.example/image.jpg");
assert.equal(preservedForm.provider_image_preview_url, "https://lh3.googleusercontent.com/place-preview");

const preservedMetadataForm = enrichment.enrichPlaceForm({
  ...emptyForm,
  provider: "GOOGLE",
  source_external_id: googlePlaceId,
  provider_rating: "4.9",
  source_metadata: { rating: 4.9, review_count: 999 },
}, {
  provider: "google",
  sourceUrl: googleIdUrl,
  providerPlaceId: googlePlaceId,
});
assert.equal(preservedMetadataForm.provider_rating, "4.9");
assert.equal(preservedMetadataForm.source_metadata.rating, 4.9);
assert.equal(preservedMetadataForm.source_metadata.review_count, 999);

const changedSourceForm = enrichment.enrichPlaceForm({
  ...emptyForm,
  provider: "GOOGLE",
  source_external_id: "old-google-id",
  provider_rating: "4.9",
  source_metadata: { rating: 4.9, review_count: 999 },
}, naverResolved.normalizedPlace);
assert.equal(changedSourceForm.provider, "NAVER");
assert.equal(changedSourceForm.provider_rating, "");
assert.equal(changedSourceForm.source_metadata.rating, undefined);
assert.equal(changedSourceForm.source_external_id, "1435915485");

const enrichedNaverForm = enrichment.enrichPlaceForm(emptyForm, naverResolved.normalizedPlace);
assert.equal(enrichedNaverForm.provider, "NAVER");
assert.equal(enrichedNaverForm.category, "restaurant");
assert.equal(enrichedNaverForm.website, "");
assert.equal(enrichedNaverForm.price_level, "");
assert.equal(enrichedNaverForm.provider_rating, "");

const sourcePayload = enrichment.buildPlaceSourcePayload(enrichedNaverForm);
assert.equal(sourcePayload.provider, "NAVER");
assert.equal(sourcePayload.external_id, "1435915485");
assert.equal(sourcePayload.raw_metadata.category, "한식>육류");
assert.ok(sourcePayload.last_synced_at);

const enrichedKakaoForm = enrichment.enrichPlaceForm(emptyForm, kakaoResolved.normalizedPlace);
assert.equal(enrichedKakaoForm.provider, "KAKAO");
assert.equal(enrichedKakaoForm.category, "attraction");
assert.equal(enrichedKakaoForm.website, "");
assert.equal(enrichedKakaoForm.latitude, "35.1532000");

const summaryFacts = adminSummary.buildAdminPlaceSummaryFacts(googleDetails.normalizedPlace);
assert.equal(summaryFacts.provider, "google");
assert.equal(summaryFacts.priceLevel, 0);
assert.deepEqual([...summaryFacts.types], ["tourist_attraction", "beach"]);
assert.doesNotThrow(() => adminSummary.validateAdminPlaceSummary(
  "광안리해수욕장은 부산광역시 수영구에 위치한 해변입니다. Google Maps 기준 평점 4.6점과 리뷰 321개가 확인됩니다.",
  summaryFacts,
));
assert.throws(() => adminSummary.validateAdminPlaceSummary(
  "광안리해수욕장은 현지인 맛집으로 유명합니다. 평점이 높아 실패 없는 장소입니다.",
  summaryFacts,
), /근거 없는 표현/);
assert.throws(() => adminSummary.validateAdminPlaceSummary(
  "가격 정보 없는 카페입니다. 가격대는 2단계입니다.",
  adminSummary.buildAdminPlaceSummaryFacts(googleWithoutPrice.normalizedPlace),
), /가격 정보가 없는/);
assert.throws(() => adminSummary.validateAdminPlaceSummary(
  "광안리해수욕장은 부산에 있습니다. 매일 23시에 마감합니다.",
  { ...summaryFacts, openingHours: undefined },
), /영업시간 정보가 없는|없는 수치/);

const submissionWorkflowSource = readFileSync(new URL("../components/AdminSubmissionWorkflow.tsx", import.meta.url), "utf8");
assert.match(submissionWorkflowSource, /admin_summary:\s*""/);
assert.doesNotMatch(submissionWorkflowSource, /admin_summary:\s*reason/);
assert.match(submissionWorkflowSource, /recommendation_reason \|\| selected\.notes|selected\.recommendation_reason \|\| selected\.notes/);

const mapLinkRouteSource = readFileSync(new URL("../app/api/admin/map-link/route.ts", import.meta.url), "utf8");
assert.match(mapLinkRouteSource, /summaryResult\.reason[\s\S]*adminSummaryError/);
assert.match(mapLinkRouteSource, /\.\.\.resolution,[\s\S]*adminSummary,[\s\S]*adminSummaryError/);
assert.match(mapLinkRouteSource, /generatePlaceAiContent/);
assert.match(mapLinkRouteSource, /locale_targets: \["ko"\]/);
assert.match(mapLinkRouteSource, /koreanContentError/);
assert.match(mapLinkRouteSource, /Promise\.allSettled\(\[summaryPromise, koreanContentPromise\]\)/);

const adminSummarySource = readFileSync(new URL("../lib/place-ai/admin-summary.ts", import.meta.url), "utf8");
const placeGeneratorSource = readFileSync(new URL("../lib/place-ai/generator.ts", import.meta.url), "utf8");
assert.match(adminSummarySource, /reasoning:\s*\{ effort: "low" \}/);
assert.match(placeGeneratorSource, /effort: "low"/);
assert.doesNotMatch(`${adminSummarySource}\n${placeGeneratorSource}`, /effort: "minimal"/);

for (const editorFile of ["AdminPlaceManager.tsx", "AdminSubmissionWorkflow.tsx"]) {
  const editorSource = readFileSync(new URL(`../components/${editorFile}`, import.meta.url), "utf8");
  const translationCalls = editorSource.match(/\/api\/admin\/translate-place/g) ?? [];
  assert.ok(translationCalls.length >= 2, `${editorFile} must translate names and addresses during full AI generation and on manual retry`);
  assert.doesNotMatch(editorSource, /name_zh:\s*enriched\.name_zh \|\| title/);
  assert.match(editorSource, /koreanContent\?\.description/);
}

const placeStoreSource = readFileSync(new URL("../lib/place-store.ts", import.meta.url), "utf8");
assert.match(placeStoreSource, /translation\.description, translation\.travel_tip, translation\.address/);

const validPayload = {
  name_ko: "광안리",
  name_zh: "",
  category: "attraction",
  latitude: 35.1532,
  longitude: 129.1186,
  price_level: 2,
  price_min: null,
  price_max: null,
};
assert.doesNotThrow(() => validation.validatePlacePayloadForSave(validPayload));
assert.throws(() => validation.validatePlacePayloadForSave({ ...validPayload, latitude: null }), /좌표가 없어/);
assert.throws(() => validation.validatePlacePayloadForSave({ ...validPayload, latitude: Number.NaN }), /좌표가 없어/);
assert.throws(() => validation.validatePlacePayloadForSave({ ...validPayload, latitude: 0, longitude: 0 }), /좌표가 없어/);
assert.throws(() => validation.validatePlacePayloadForSave({ ...validPayload, latitude: 95 }), /좌표가 없어/);

const duplicatePayload = {
  ...validPayload,
  address_ko: "부산 수영구 광안해변로",
  address_zh: "",
  address: "",
  source: { provider: "GOOGLE", external_id: googlePlaceId, source_url: googleIdUrl },
};
const existingPlace = {
  id: "existing-place",
  name_ko: "광안리",
  name_zh: "",
  address_ko: "부산 수영구 광안해변로",
  address_zh: "",
  latitude: 35.15321,
  longitude: 129.11861,
  sources: [{ provider: "GOOGLE", external_id: googlePlaceId }],
};
const exactMatches = duplicates.findPlaceDuplicateMatches(duplicatePayload, [existingPlace]);
assert.equal(exactMatches[0].level, "exact");
assert.equal(exactMatches[0].reason, "provider_id");
const nearbyMatches = duplicates.findPlaceDuplicateMatches({ ...duplicatePayload, source: undefined }, [existingPlace]);
assert.equal(nearbyMatches[0].reason, "coordinates");

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
