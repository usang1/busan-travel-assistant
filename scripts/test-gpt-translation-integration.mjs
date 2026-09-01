import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const translatorTool = readFileSync(new URL("../components/TranslatorTool.tsx", import.meta.url), "utf8");
const route = readFileSync(new URL("../app/api/translate-to-korean/route.ts", import.meta.url), "utf8");
const openAiTranslation = readFileSync(new URL("../lib/openai-korean-translation.ts", import.meta.url), "utf8");

assert.doesNotMatch(translatorTool, /demoTranslate|데모 번역|실제 AI API는 아직 연결하지 않았습니다/);
assert.match(translatorTool, /fetch\("\/api\/translate-to-korean"/);
assert.match(translatorTool, /body\.translation\.trim\(\)/);
assert.match(translatorTool, /role="alert"/);

assert.match(route, /translateToKorean\(sourceText, requestId\)/);
assert.match(route, /Cache-Control": "no-store"/);
assert.match(route, /\[translation:gpt-failed\]/);
assert.doesNotMatch(route, /console\.(?:error|info)\([^)]*sourceText/);

assert.match(openAiTranslation, /import "server-only"/);
assert.match(openAiTranslation, /process\.env\.OPENAI_API_KEY/);
assert.match(openAiTranslation, /process\.env\.OPENAI_TRANSLATION_MODEL/);
assert.match(openAiTranslation, /process\.env\.OPENAI_PLACE_MODEL/);
assert.match(openAiTranslation, /https:\/\/api\.openai\.com\/v1\/responses/);
assert.match(openAiTranslation, /Authorization: `Bearer \$\{apiKey\}`/);
assert.match(openAiTranslation, /type: "json_schema"/);
assert.match(openAiTranslation, /store: false/);
assert.doesNotMatch(openAiTranslation, /NEXT_PUBLIC_OPENAI|sk-[A-Za-z0-9]/);

const compiledTranslation = ts.transpileModule(openAiTranslation, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const translationModule = { exports: {} };

new Function("module", "exports", "require", compiledTranslation)(translationModule, translationModule.exports, (specifier) => {
  if (specifier === "server-only") return {};
  throw new Error(`Unexpected runtime import: ${specifier}`);
});

const previousApiKey = process.env.OPENAI_API_KEY;
const previousTranslationModel = process.env.OPENAI_TRANSLATION_MODEL;
const previousFetch = globalThis.fetch;
const previousConsoleInfo = console.info;
let capturedRequest = null;

try {
  process.env.OPENAI_API_KEY = "test-api-key";
  process.env.OPENAI_TRANSLATION_MODEL = "gpt-translation-test";
  console.info = () => undefined;
  globalThis.fetch = async (url, options) => {
    capturedRequest = { url, options };
    return new Response(JSON.stringify({
      id: "resp_translation_test",
      model: "gpt-translation-test",
      output_text: JSON.stringify({
        translation: "여기에 짐을 맡길 수 있나요?",
        detectedLanguage: "zh",
      }),
    }), { status: 200, headers: { "Content-Type": "application/json" } });
  };

  const result = await translationModule.exports.translateToKorean("请问这里可以寄存行李吗？", "request-test");
  const requestBody = JSON.parse(capturedRequest.options.body);

  assert.equal(capturedRequest.url, "https://api.openai.com/v1/responses");
  assert.equal(capturedRequest.options.headers.Authorization, "Bearer test-api-key");
  assert.equal(requestBody.model, "gpt-translation-test");
  assert.equal(requestBody.store, false);
  assert.equal(requestBody.input[1].content, "请问这里可以寄存行李吗？");
  assert.equal(result.translation, "여기에 짐을 맡길 수 있나요?");
  assert.equal(result.detectedLanguage, "zh");
} finally {
  if (previousApiKey === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = previousApiKey;
  if (previousTranslationModel === undefined) delete process.env.OPENAI_TRANSLATION_MODEL;
  else process.env.OPENAI_TRANSLATION_MODEL = previousTranslationModel;
  globalThis.fetch = previousFetch;
  console.info = previousConsoleInfo;
}

console.log("GPT translation integration tests passed (server-only key, Responses API, structured output, and client error handling).");
