import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../lib/home-intent-links.ts", import.meta.url), "utf8");
const tagSource = readFileSync(new URL("../lib/home-intent-tags.ts", import.meta.url), "utf8");
const homeDiscoverySource = readFileSync(new URL("../components/HomeDiscoveryPage.tsx", import.meta.url), "utf8");
const guideExplorerSource = readFileSync(new URL("../components/GuideExplorer.tsx", import.meta.url), "utf8");
const guideCopySource = readFileSync(new URL("../lib/guide-copy.ts", import.meta.url), "utf8");

const output = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    verbatimModuleSyntax: false,
  },
}).outputText;
const module = { exports: {} };
const tagOutput = ts.transpileModule(tagSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    verbatimModuleSyntax: false,
  },
}).outputText;
const tagModule = { exports: {} };
new Function("module", "exports", "require", tagOutput)(tagModule, tagModule.exports, () => {
  throw new Error("home-intent-tags.ts must not have runtime imports");
});

new Function("module", "exports", "require", output)(module, module.exports, (specifier) => {
  if (specifier === "@/lib/home-intent-tags") return tagModule.exports;
  if (specifier === "@/lib/busan-districts") {
    return {
      getBusanDistrictKey(place) {
        return place.district ?? null;
      },
      getBusanDistrictLabel(key, locale) {
        const labels = {
          "suyeong-gu": { ko: "수영구", zh: "水营区", en: "Suyeong-gu", ja: "水営区" },
        };
        return labels[key]?.[locale] ?? "";
      },
    };
  }
  if (specifier === "@/lib/i18n") {
    return {
      withLocale(path, locale) {
        return path === "/" ? `/${locale}` : `/${locale}${path}`;
      },
    };
  }

  if (specifier === "@/lib/place-publishing") {
    return {
      isPublicPlace(place) {
        return place.is_active === true && (place.status === "PUBLISHED" || place.status === "ACTIVE");
      },
    };
  }

  if (specifier === "@/lib/place-china/discovery") {
    return {
      getChinaFilterByQueryKey(queryKey) {
        const filters = {
          firstBusan: (place) => place.firstBusan === true,
          rainyDay: (place) => place.rainyDay === true,
          solo: (place) => place.solo === true,
          openNight: (place) => place.openNight === true,
        };
        const match = filters[queryKey];
        return match ? { queryKey, match } : undefined;
      },
    };
  }

  throw new Error(`Unexpected runtime import from home-intent-links.ts: ${specifier}`);
});

const { homeIntentCards, resolveHomeIntentCards } = module.exports;
const { buildHomeIntentTags, getHomeIntentKeysFromTags, getHomeIntentLabel, homeIntentTagOptions } = tagModule.exports;

function guide(overrides) {
  return {
    id: overrides.slug,
    slug: overrides.slug,
    status: "PUBLISHED",
    guide_type: "SITUATION",
    title_ko: "",
    title_zh: "",
    title_en: "",
    title_ja: "",
    description_ko: "",
    description_zh: "",
    description_en: "",
    description_ja: "",
    area: "광안리",
    recommended_for: { ko: "", zh: "", en: "", ja: "" },
    weather_type: "ANY",
    sort_order: 0,
    is_featured: false,
    cover_image: "",
    estimated_duration: null,
    created_at: "",
    updated_at: "",
    published_at: "",
    ...overrides,
  };
}

function place(overrides) {
  return {
    id: overrides.id,
    category: "restaurant",
    is_active: true,
    status: "PUBLISHED",
    ...overrides,
  };
}

function byKey(cards, key) {
  return cards.find((card) => card.key === key);
}

const noGuides = resolveHomeIntentCards({
  locale: "ko",
  guides: [],
  places: [
    place({ id: "restaurant", category: "restaurant" }),
    place({ id: "luggage", category: "luggage" }),
  ],
});
assert.equal(byKey(noGuides, "food").destination, "places");
assert.equal(byKey(noGuides, "food").href, "/ko/places?category=restaurant");
assert.equal(byKey(noGuides, "luggage").destination, "places");
assert.equal(byKey(noGuides, "firstGwangalli").destination, "pending");

const specificGuide = resolveHomeIntentCards({
  locale: "ko",
  guides: [guide({ slug: "rain-guide", title_ko: "부산 비 오는 날 실내 가이드" })],
  places: [place({ id: "rain-place", rainyDay: true })],
});
assert.equal(byKey(specificGuide, "rainyDay").destination, "guide");
assert.equal(byKey(specificGuide, "rainyDay").href, "/ko/guides/rain-guide");

const allGuides = resolveHomeIntentCards({
  locale: "en",
  guides: [
    guide({ slug: "first", title_en: "First time in Gwangalli" }),
    guide({ slug: "food", title_en: "Gwangalli food" }),
    guide({ slug: "rain", title_en: "Rainy day in Busan" }),
    guide({ slug: "solo", title_en: "Solo Busan travel" }),
    guide({ slug: "night", title_en: "After 10 PM night guide" }),
    guide({ slug: "bags", title_en: "Luggage storage" }),
  ],
  places: [],
});
assert.deepEqual(allGuides.map((card) => card.destination), ["guide", "guide", "guide", "guide", "guide", "guide"]);

const guideLookupFailed = resolveHomeIntentCards({
  locale: "ja",
  guides: [],
  places: [place({ id: "solo", solo: true })],
});
assert.equal(byKey(guideLookupFailed, "solo").destination, "places");
assert.equal(byKey(guideLookupFailed, "solo").href, "/ja/places?solo=true");

const tagMatchedPlace = resolveHomeIntentCards({
  locale: "ko",
  guides: [],
  places: [
    place({
      id: "tag-first-gwangalli",
      category: "attraction",
      tags: [{ label_zh: "광안리 처음", label_ko: "광안리 처음", slug: "gwangalli-first" }],
    }),
  ],
});
assert.equal(byKey(tagMatchedPlace, "firstGwangalli").destination, "places");
assert.equal(byKey(tagMatchedPlace, "firstGwangalli").href, "/ko/places?search=%EA%B4%91%EC%95%88%EB%A6%AC%20%EC%B2%98%EC%9D%8C");

const mappedIntentTags = buildHomeIntentTags(["firstGwangalli", "lateNight"]);
assert.deepEqual([...getHomeIntentKeysFromTags(mappedIntentTags)], ["firstGwangalli", "lateNight"]);
assert.equal(homeIntentTagOptions.length, 6);
assert.equal(getHomeIntentLabel("firstGwangalli", "ko", "해운대구"), "해운대구 처음 가면?");
assert.equal(getHomeIntentLabel("food", "ko", "해운대구"), "해운대구 맛집");
assert.equal(getHomeIntentLabel("firstGwangalli", "ko"), "광안리 처음 가면?");
const mappedIntentPlace = resolveHomeIntentCards({
  locale: "ko",
  guides: [guide({ slug: "night-guide", title_ko: "밤 10시 이후 가이드" })],
  places: [place({ id: "mapped-night", category: "restaurant", tags: buildHomeIntentTags(["lateNight"]) })],
});
assert.equal(byKey(mappedIntentPlace, "lateNight").destination, "places");
assert.equal(byKey(mappedIntentPlace, "lateNight").href, "/ko/places?intent=lateNight");

const districtIntentPlace = resolveHomeIntentCards({
  locale: "ko",
  district: "suyeong-gu",
  guides: [],
  places: [
    place({ id: "suyeong-night", district: "suyeong-gu", tags: buildHomeIntentTags(["lateNight"]) }),
    place({ id: "haeundae-night", district: "haeundae-gu", tags: buildHomeIntentTags(["lateNight"]) }),
  ],
});
assert.equal(byKey(districtIntentPlace, "lateNight").destination, "places");
assert.equal(byKey(districtIntentPlace, "lateNight").href, "/ko/places?intent=lateNight&region=suyeong-gu");
assert.equal(byKey(districtIntentPlace, "firstGwangalli").label, "수영구 처음 가면?");
assert.equal(byKey(districtIntentPlace, "food").label, "수영구 맛집");
assert.equal(byKey(districtIntentPlace, "rainyDay").label, "비 오는 날 갈 곳");
assert.equal(byKey(districtIntentPlace, "solo").label, "혼자 가기 좋은 곳");
assert.equal(byKey(districtIntentPlace, "luggage").label, "짐 보관 가능한 곳");

const noContent = resolveHomeIntentCards({ locale: "zh", guides: [], places: [] });
assert.equal(noContent.every((card) => card.destination === "pending" && card.href === null), true);

const unpublishedContent = resolveHomeIntentCards({
  locale: "ko",
  guides: [guide({ slug: "draft-food", status: "DRAFT", title_ko: "광안리 맛집" })],
  places: [place({ id: "draft-place", category: "restaurant", status: "DRAFT", is_active: false })],
});
assert.equal(byKey(unpublishedContent, "food").destination, "pending");

for (const locale of ["ko", "zh", "en", "ja"]) {
  assert.equal(homeIntentCards[locale].length, 6);
  const cards = resolveHomeIntentCards({
    locale,
    guides: [guide({ slug: `${locale}-food`, [`title_${locale}`]: byKey(homeIntentCards[locale], "food").search })],
    places: [place({ id: `${locale}-luggage`, category: "luggage" })],
  });
  assert.equal(byKey(cards, "food").href, `/${locale}/guides/${locale}-food`);
  assert.equal(byKey(cards, "luggage").href, `/${locale}/places?category=luggage`);
}

assert.match(homeDiscoverySource, /resolveHomeIntentCards\(\{ guides: \[\], places, locale, district: selectedDistrict \}\)/);
assert.match(homeDiscoverySource, /cityRegionGroups\.map/);
assert.match(homeDiscoverySource, /key: "seoul"[\s\S]*seoulDistricts\.map/);
assert.match(homeDiscoverySource, /key: "jeju"[\s\S]*jejuRegions\.map/);
assert.match(homeDiscoverySource, /encodeURIComponent\(`서울 \$\{district\.labels\.ko\}`\)/);
assert.match(homeDiscoverySource, /encodeURIComponent\(region\.searchKo\)/);
assert.match(homeDiscoverySource, /busanDistrictOptions\.map/);
assert.match(homeDiscoverySource, /lg:grid-cols-3/);
assert.match(homeDiscoverySource, /focus:outline-none focus:ring-4 focus:ring-teal-100/);
assert.doesNotMatch(homeDiscoverySource, /\/guides\?search=/);
assert.match(guideExplorerSource, /<EmptyState/);
assert.match(guideExplorerSource, /router\.replace\(pathname, \{ scroll: false \}\)/);
assert.match(guideExplorerSource, /withLocale\("\/places", locale\)/);
assert.match(guideCopySource, /emptyDescription/);
assert.match(guideCopySource, /clearFilters/);
assert.match(guideCopySource, /explorePlaces/);

console.log("Home intent link tests passed (guide/place/pending routing, locale links, and guide empty CTAs).");
