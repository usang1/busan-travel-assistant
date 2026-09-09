import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../lib/home-intent-links.ts", import.meta.url), "utf8");
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

new Function("module", "exports", "require", output)(module, module.exports, (specifier) => {
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

assert.match(homeDiscoverySource, /resolveHomeIntentCards\(\{ guides, places, locale \}\)/);
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
