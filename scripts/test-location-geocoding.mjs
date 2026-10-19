import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";
import ts from "typescript";

function loadModule(env, fetcher) {
  const source = readFileSync(new URL("../lib/location-geocoding.ts", import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false },
  });
  const module = { exports: {} };
  const require = (specifier) => {
    if (specifier === "server-only") return {};
    if (specifier === "@/lib/location") {
      return { isValidCoordinates: ({ latitude, longitude }) => Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 };
    }
    throw new Error(`Unexpected import: ${specifier}`);
  };
  new Script(outputText).runInNewContext({ module, exports: module.exports, require, process: { env }, fetch: fetcher, URL, AbortController, setTimeout, clearTimeout, Error });
  return module.exports;
}

const requests = [];
const naver = loadModule(
  { NAVER_MAPS_API_KEY_ID: "key-id", NAVER_MAPS_API_KEY: "secret" },
  async (url, init) => {
    requests.push({ url: String(url), headers: init.headers });
    if (String(url).includes("map-reversegeocode")) {
      return response({ results: [
        { name: "roadaddr", region: { area1: { name: "부산광역시" }, area2: { name: "수영구" }, area3: { name: "광안동" }, area4: { name: "" } }, land: { name: "광안해변로", number1: "219", number2: "", addition0: { value: "테스트빌딩" } } },
        { name: "addr", region: { area1: { name: "부산광역시" }, area2: { name: "수영구" }, area3: { name: "광안동" }, area4: { name: "" } }, land: { name: "", number1: "192", number2: "20" } },
      ] });
    }
    return response({ addresses: [{ x: "129.1186000", y: "35.1532000", roadAddress: "부산광역시 수영구 광안해변로 219", jibunAddress: "부산광역시 수영구 광안동 192-20" }] });
  },
);

const forward = await naver.geocodeAddressOnServer("광안해변로 219");
assert.equal(forward[0].provider, "naver");
assert.equal(forward[0].latitude, 35.1532);
assert.equal(requests[0].headers["x-ncp-apigw-api-key-id"], "key-id");
assert.equal(requests[0].headers["x-ncp-apigw-api-key"], "secret");
const reverse = await naver.reverseGeocodeOnServer({ latitude: 35.1532, longitude: 129.1186 });
assert.equal(reverse.provider, "naver");
assert.match(reverse.roadAddress, /광안해변로 219 테스트빌딩/);

let call = 0;
const fallback = loadModule(
  { NAVER_MAPS_API_KEY_ID: "key-id", NAVER_MAPS_API_KEY: "secret", KAKAO_REST_API_KEY: "kakao" },
  async () => {
    call += 1;
    if (call === 1) return response({}, 403);
    return response({ documents: [{ x: "129.1186", y: "35.1532", address_name: "부산 수영구 광안동", road_address: { address_name: "부산 수영구 광안해변로 219" }, address: { address_name: "부산 수영구 광안동" } }] });
  },
);
assert.equal((await fallback.geocodeAddressOnServer("광안해변로 219"))[0].provider, "kakao");

const unconfigured = loadModule({}, async () => { throw new Error("must not fetch"); });
await assert.rejects(() => unconfigured.geocodeAddressOnServer("광안해변로 219"), /주소 좌표 변환 API가 설정되어 있지 않습니다/);

console.log("Location geocoding tests passed: Naver forward/reverse, credential headers, Kakao fallback, and missing-provider diagnostics.");

function response(body, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}
