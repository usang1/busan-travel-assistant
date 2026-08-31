type OpenAiOperation = "AI 장소 요약 생성" | "AI 여행정보 생성" | "AI 번역" | "장소 정보 웹 검색 보완";

type PublicOpenAiError = Error & {
  status: number;
  expose: true;
  code?: string;
};

export function toPublicOpenAiError(error: unknown, operation: OpenAiOperation): PublicOpenAiError {
  if (isExposedError(error)) return error;

  const record = asRecord(error);
  const providerStatus = typeof record?.status === "number" ? record.status : undefined;
  const name = typeof record?.name === "string" ? record.name.toLowerCase() : "";
  const code = typeof record?.code === "string" ? record.code : undefined;

  if (providerStatus === 401 || providerStatus === 403) {
    return publicError("OpenAI API Key가 유효하지 않거나 모델 사용 권한이 없습니다. Vercel 환경변수와 OpenAI 프로젝트 권한을 확인해 주세요.", 502, code);
  }
  if (providerStatus === 429) {
    return publicError("OpenAI 요청 한도 또는 결제 한도에 도달했습니다. OpenAI 프로젝트의 Usage와 Billing을 확인해 주세요.", 429, code);
  }
  if (providerStatus === 400 || providerStatus === 404) {
    return publicError("OpenAI 모델 또는 요청 설정이 올바르지 않습니다. OPENAI_PLACE_MODEL과 배포 버전을 확인해 주세요.", 502, code);
  }
  if (name.includes("timeout") || code === "ETIMEDOUT" || code === "ECONNABORTED") {
    return publicError("OpenAI 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.", 504, code);
  }

  return publicError(`${operation}에 실패했습니다. Vercel 로그와 OpenAI 프로젝트 상태를 확인해 주세요.`, 502, code);
}

export function publicOpenAiValidationError(message: string) {
  return publicError(message, 502, "validation_failed");
}

function publicError(message: string, status: number, code?: string): PublicOpenAiError {
  return Object.assign(new Error(message), { status, expose: true as const, code });
}

function isExposedError(error: unknown): error is PublicOpenAiError {
  const record = asRecord(error);
  return error instanceof Error && record?.expose === true && typeof record.status === "number";
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? value as Record<string, unknown> : null;
}
