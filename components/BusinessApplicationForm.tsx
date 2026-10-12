"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AuthRequiredPanel } from "@/components/AuthRequiredPanel";
import { useAuth } from "@/components/AuthProvider";
import {
  BUSINESS_APPLICATION_CONSENT_VERSION,
  BUSINESS_APPLICATION_NAME_MAX_LENGTH,
  businessApplicantRoles,
  formatKoreanMobilePhoneInput,
  normalizeApplicantName,
  normalizeKoreanMobilePhone,
  normalizeNaverPlaceUrl,
  validateBusinessApplicationInput,
  type BusinessApplicantRole,
  type BusinessApplicationField,
} from "@/lib/business-application";
import { withLocale, type Locale } from "@/lib/i18n";

type FormState = {
  placeUrl: string;
  applicantRole: BusinessApplicantRole | "";
  applicantName: string;
  contactPhone: string;
  privacyConsent: boolean;
};

const emptyForm: FormState = { placeUrl: "", applicantRole: "", applicantName: "", contactPhone: "", privacyConsent: false };

export function BusinessApplicationForm({ locale }: { locale: Locale }) {
  const { session, profile, loading } = useAuth();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [touched, setTouched] = useState<Partial<Record<BusinessApplicationField, boolean>>>({});
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [completed, setCompleted] = useState(false);
  const text = copy[locale];

  useEffect(() => {
    if (profile?.display_name) setForm((current) => ({ ...current, applicantName: current.applicantName || profile.display_name || "" }));
  }, [profile]);

  const fieldErrors = useMemo(() => ({
    placeUrl: form.placeUrl && normalizeNaverPlaceUrl(form.placeUrl) ? "" : text.errors.placeUrl,
    applicantRole: businessApplicantRoles.includes(form.applicantRole as BusinessApplicantRole) ? "" : text.errors.applicantRole,
    applicantName: normalizeApplicantName(form.applicantName) ? "" : text.errors.applicantName,
    contactPhone: normalizeKoreanMobilePhone(form.contactPhone) ? "" : text.errors.contactPhone,
    privacyConsent: form.privacyConsent ? "" : text.errors.privacyConsent,
  }), [form, text]);
  const isReady = Object.values(fieldErrors).every((error) => !error);

  if (loading) return <p className="border border-[#e8e4dd] bg-white p-5 text-sm font-bold text-[#6f746e]">{text.loading}</p>;
  if (!session) return <AuthRequiredPanel title={text.loginTitle} description={text.login} locale={locale} />;
  const accessToken = session.access_token;

  function update<Key extends keyof FormState>(key: Key, value: FormState[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
    setCompleted(false);
    setMessage("");
  }

  function touch(field: BusinessApplicationField) {
    setTouched((current) => ({ ...current, [field]: true }));
  }

  function errorFor(field: BusinessApplicationField) {
    return touched[field] ? fieldErrors[field] : "";
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving || completed) return;
    const validation = validateBusinessApplicationInput({ ...form, consentVersion: BUSINESS_APPLICATION_CONSENT_VERSION });
    if (!validation.ok) {
      setTouched({ placeUrl: true, applicantRole: true, applicantName: true, contactPhone: true, privacyConsent: true });
      document.getElementById(`business-${validation.field}`)?.focus();
      return;
    }

    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/business-applications", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ ...validation.data, privacyConsent: true, locale }),
      });
      const body = await response.json() as { code?: string; message?: string };
      if (!response.ok) {
        const apiErrors: Record<string, string> = text.apiErrors;
        setMessage(apiErrors[body.code ?? body.message ?? "application_failed"] ?? text.failed);
        return;
      }
      setCompleted(true);
      setMessage(text.success);
    } catch {
      setMessage(text.networkError);
    } finally {
      setSaving(false);
    }
  }

  const roles: Array<{ value: BusinessApplicantRole; label: string; detail: string }> = [
    { value: "owner", label: text.roles.owner, detail: text.roleDetails.owner },
    { value: "staff", label: text.roles.staff, detail: text.roleDetails.staff },
    { value: "agency", label: text.roles.agency, detail: text.roleDetails.agency },
  ];

  return (
    <div className="space-y-4">
      <ol aria-label={text.progressLabel} className="grid grid-cols-4 gap-1 border border-[#e8e4dd] bg-white p-3 sm:gap-2 sm:p-4">
        {text.steps.map((step, index) => <li key={step} className="min-w-0 text-center"><span className={`mx-auto flex size-7 items-center justify-center text-xs font-black ${index === 0 ? "bg-[#4f6652] text-white" : "bg-[#f1eee8] text-[#6f746e]"}`}>{index + 1}</span><span className="mt-1 block break-keep text-[11px] font-bold leading-4 text-[#626862] sm:text-xs">{step}</span></li>)}
      </ol>

      <form onSubmit={submit} noValidate className="border border-[#e8e4dd] bg-white p-5 shadow-[0_20px_60px_rgba(37,40,36,0.06)] sm:p-8">
        <div>
          <h2 className="text-xl font-black text-slate-950">{text.formTitle}</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">{text.description}</p>
        </div>

        <div className="mt-6 space-y-6">
          <Field label={text.placeUrl} required requiredLabel={text.required} error={errorFor("placeUrl")} errorId="business-placeUrl-error">
            <input id="business-placeUrl" type="url" inputMode="url" autoComplete="url" required value={form.placeUrl} onChange={(event) => update("placeUrl", event.target.value)} onBlur={() => touch("placeUrl")} aria-invalid={Boolean(errorFor("placeUrl"))} aria-describedby={errorFor("placeUrl") ? "business-placeUrl-help business-placeUrl-error" : "business-placeUrl-help"} placeholder="https://naver.me/..." className={inputClass(Boolean(errorFor("placeUrl")))} />
            <p id="business-placeUrl-help" className="mt-2 text-xs leading-5 text-slate-500">{text.placeUrlHelp}</p>
          </Field>

          <fieldset>
            <legend className="text-sm font-black text-slate-800">{text.applicantRole} <RequiredMark label={text.required} /></legend>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {roles.map((role) => <label key={role.value} className={`flex min-h-20 cursor-pointer items-start gap-3 p-3 ring-1 transition ${form.applicantRole === role.value ? "bg-[#edf2eb] ring-2 ring-[#4f6652]" : "bg-[#faf9f6] ring-[#e8e4dd] hover:bg-[#f1eee8]"}`}><input id={role.value === "owner" ? "business-applicantRole" : undefined} type="radio" name="applicantRole" value={role.value} checked={form.applicantRole === role.value} onChange={() => { update("applicantRole", role.value); touch("applicantRole"); }} className="mt-1 size-4 accent-[#4f6652]" /><span><span className="block text-sm font-black text-slate-900">{role.label}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{role.detail}</span></span></label>)}
            </div>
            {errorFor("applicantRole") ? <p id="business-applicantRole-error" role="alert" className="mt-2 text-sm font-bold text-rose-700">{errorFor("applicantRole")}</p> : null}
            {form.applicantRole === "agency" ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm leading-6 text-amber-900 ring-1 ring-amber-200">{text.agencyNotice}</p> : null}
          </fieldset>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label={text.applicantName} required requiredLabel={text.required} error={errorFor("applicantName")} errorId="business-applicantName-error">
              <input id="business-applicantName" required maxLength={BUSINESS_APPLICATION_NAME_MAX_LENGTH} autoComplete="name" value={form.applicantName} onChange={(event) => update("applicantName", event.target.value)} onBlur={() => touch("applicantName")} aria-invalid={Boolean(errorFor("applicantName"))} aria-describedby={errorFor("applicantName") ? "business-applicantName-error" : undefined} className={inputClass(Boolean(errorFor("applicantName")))} />
            </Field>
            <Field label={text.contactPhone} required requiredLabel={text.required} error={errorFor("contactPhone")} errorId="business-contactPhone-error">
              <input id="business-contactPhone" type="tel" inputMode="numeric" required autoComplete="tel" value={form.contactPhone} onChange={(event) => update("contactPhone", formatKoreanMobilePhoneInput(event.target.value))} onBlur={() => touch("contactPhone")} placeholder="010-1234-5678" aria-invalid={Boolean(errorFor("contactPhone"))} aria-describedby={errorFor("contactPhone") ? "business-contactPhone-error" : undefined} className={inputClass(Boolean(errorFor("contactPhone")))} />
            </Field>
          </div>

          <div className={`rounded-2xl p-4 ring-1 ${errorFor("privacyConsent") ? "bg-rose-50 ring-rose-300" : "bg-slate-50 ring-slate-200"}`}>
            <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm font-bold leading-6 text-slate-800"><input id="business-privacyConsent" type="checkbox" required checked={form.privacyConsent} onChange={(event) => { update("privacyConsent", event.target.checked); touch("privacyConsent"); }} aria-invalid={Boolean(errorFor("privacyConsent"))} aria-describedby={errorFor("privacyConsent") ? "business-privacyConsent-error business-privacy-details" : "business-privacy-details"} className="mt-1 size-5 shrink-0 accent-teal-700" /><span>{text.privacyConsent} <RequiredMark label={text.required} /></span></label>
            {errorFor("privacyConsent") ? <p id="business-privacyConsent-error" role="alert" className="mt-1 text-sm font-bold text-rose-700">{errorFor("privacyConsent")}</p> : null}
            <details id="business-privacy-details" className="mt-2 text-xs leading-5 text-slate-600"><summary className="cursor-pointer font-bold text-slate-700">{text.privacyDetailsTitle}</summary><dl className="mt-3 grid gap-2"><div><dt className="font-black">{text.privacyItemsLabel}</dt><dd>{text.privacyItems}</dd></div><div><dt className="font-black">{text.privacyPurposeLabel}</dt><dd>{text.privacyPurpose}</dd></div><div><dt className="font-black">{text.privacyRetentionLabel}</dt><dd>{text.privacyRetention}</dd></div><div><dt className="font-black">{text.privacyRefusalLabel}</dt><dd>{text.privacyRefusal}</dd></div></dl></details>
            <Link href={withLocale("/privacy", locale)} target="_blank" className="mt-3 inline-flex min-h-11 items-center text-sm font-black text-teal-800 underline underline-offset-4">{text.privacyLink}</Link>
          </div>
        </div>

        <button type="submit" disabled={!isReady || saving || completed} className="mt-6 flex min-h-12 w-full items-center justify-center bg-[#4f6652] px-4 font-black text-white transition hover:bg-[#405444] active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500">{saving ? text.saving : completed ? text.completed : text.submit}</button>
        {message ? <p role="status" aria-live="polite" className={`mt-4 rounded-xl p-3 text-sm font-bold ${completed ? "bg-teal-50 text-teal-900" : "bg-rose-50 text-rose-800"}`}>{message}</p> : null}
        {completed ? <Link href={withLocale("/business/dashboard", locale)} className="mt-3 inline-flex min-h-11 items-center text-sm font-black text-teal-800 underline underline-offset-4">{text.viewStatus}</Link> : null}
      </form>
    </div>
  );
}

function Field({ label, required, requiredLabel, error, errorId, children }: { label: string; required?: boolean; requiredLabel: string; error?: string; errorId: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-sm font-black text-slate-800">{label} {required ? <RequiredMark label={requiredLabel} /> : null}</span><div className="mt-2">{children}</div>{error ? <p id={errorId} role="alert" className="mt-2 text-sm font-bold text-rose-700">{error}</p> : null}</label>;
}

function RequiredMark({ label }: { label: string }) { return <span className="text-rose-600" aria-label={label}>*</span>; }
function inputClass(invalid: boolean) { return `min-h-12 w-full bg-white px-4 py-3 text-base text-slate-950 outline-none ring-1 transition placeholder:text-slate-400 focus:ring-2 ${invalid ? "ring-rose-400 focus:ring-rose-500" : "ring-[#d8d3cb] focus:ring-[#4f6652]"}`; }

const copy = {
  ko: {
    formTitle: "신청 정보", description: "간단한 정보만 입력하면 관리자 검토 후 등록 절차를 안내해 드립니다.", loginTitle: "Spotzari 입점신청", login: "로그인 후 입점신청을 제출할 수 있습니다.", loading: "계정 정보를 확인하고 있습니다.", progressLabel: "입점 등록 절차", steps: ["입점신청", "관리자 검토", "업체 정보 입력", "최종 승인"], required: "필수", placeUrl: "네이버 플레이스 URL", placeUrlHelp: "네이버 플레이스 상세 URL 또는 https://naver.me/ 단축 링크를 입력해 주세요. 링크 입력만으로 업체 소유권이 인증되지는 않습니다.", applicantRole: "신청자 역할", roles: { owner: "대표자 / 사업주", staff: "직원 / 매니저", agency: "마케팅 대행사" }, roleDetails: { owner: "가게 대표 또는 사업주", staff: "가게 소속 실무 담당자", agency: "위임받은 외부 대행사" }, agencyNotice: "마케팅 대행사는 해당 업체의 관리 권한을 위임받아야 합니다. 필요 시 추가 증빙을 요청할 수 있습니다.", applicantName: "신청자 이름", contactPhone: "휴대전화 번호", privacyConsent: "입점신청 처리를 위한 개인정보 수집·이용에 동의합니다.", privacyDetailsTitle: "개인정보 수집·이용 안내 보기", privacyItemsLabel: "수집 항목", privacyItems: "신청자 이름, 휴대전화 번호, 신청자 역할, 네이버 플레이스 URL, 회원 ID", privacyPurposeLabel: "이용 목적", privacyPurpose: "입점신청 검토, 본인 및 위임 관계 확인, 처리 결과 안내", privacyRetentionLabel: "보유 기간", privacyRetention: "입점신청 처리 종료 후 1년. 단, 관련 법령에 별도 보존 의무가 있는 경우 해당 기간 동안 보관합니다.", privacyRefusalLabel: "동의 거부", privacyRefusal: "동의를 거부할 수 있으나 입점신청 접수가 제한됩니다.", privacyLink: "개인정보처리방침 확인", submit: "입점신청 제출하기", saving: "제출 중…", completed: "신청 완료", success: "입점신청이 접수되었습니다. 관리자 검토 후 다음 절차를 안내해 드립니다.", viewStatus: "신청 상태 확인하기", failed: "신청을 접수하지 못했습니다. 입력 내용을 확인한 후 다시 시도해 주세요.", networkError: "네트워크 연결을 확인한 후 다시 시도해 주세요.", errors: { placeUrl: "올바른 네이버 플레이스 상세 URL을 입력해 주세요.", applicantRole: "신청자 역할을 선택해 주세요.", applicantName: `이름을 공백 없이 ${BUSINESS_APPLICATION_NAME_MAX_LENGTH}자 이내로 입력해 주세요.`, contactPhone: "010으로 시작하는 휴대전화 번호를 입력해 주세요.", privacyConsent: "개인정보 수집·이용 동의가 필요합니다." }, apiErrors: { duplicate_application: "이미 검토 중인 동일 업체의 입점신청이 있습니다.", rate_limited: "짧은 시간에 너무 많은 신청이 접수되었습니다. 잠시 후 다시 시도해 주세요.", login_required: "로그인이 만료되었습니다. 다시 로그인해 주세요.", invalid_place_url: "네이버 플레이스 URL을 확인해 주세요.", invalid_contact_phone: "휴대전화 번호 형식을 확인해 주세요.", migration_required: "신청 시스템 업데이트가 필요합니다. 관리자에게 문의해 주세요.", cross_site_blocked: "안전하지 않은 요청이 차단되었습니다. 페이지를 새로고침해 주세요." },
  },
  zh: {
    formTitle: "申请信息", description: "填写基本信息后，管理员将审核并通知后续登记步骤。", loginTitle: "Spotzari 商家入驻", login: "登录后可提交入驻申请。", loading: "正在确认账号信息。", progressLabel: "商家入驻流程", steps: ["提交申请", "管理员审核", "填写商家信息", "最终批准"], required: "必填", placeUrl: "Naver Place 链接", placeUrlHelp: "请输入 Naver Place 详情页或 https://naver.me/ 短链接。仅提供链接并不代表已验证店铺所有权。", applicantRole: "申请人身份", roles: { owner: "店主 / 经营者", staff: "员工 / 经理", agency: "营销代理商" }, roleDetails: { owner: "店铺代表或经营者", staff: "店铺内部负责人", agency: "经授权的外部代理商" }, agencyNotice: "营销代理商必须获得该商家的管理授权，必要时可能要求补充证明。", applicantName: "申请人姓名", contactPhone: "韩国手机号码", privacyConsent: "我同意为处理入驻申请而收集和使用个人信息。", privacyDetailsTitle: "查看个人信息收集与使用说明", privacyItemsLabel: "收集项目", privacyItems: "姓名、手机号码、申请人身份、Naver Place 链接、会员 ID", privacyPurposeLabel: "使用目的", privacyPurpose: "审核入驻申请、确认本人及授权关系、通知处理结果", privacyRetentionLabel: "保存期限", privacyRetention: "申请处理结束后保存1年；法律另有要求时按法定期限保存。", privacyRefusalLabel: "拒绝同意", privacyRefusal: "您可以拒绝，但将无法提交入驻申请。", privacyLink: "查看隐私政策", submit: "提交入驻申请", saving: "正在提交…", completed: "申请完成", success: "入驻申请已提交。管理员审核后将通知下一步。", viewStatus: "查看申请状态", failed: "提交失败，请检查输入后重试。", networkError: "请检查网络连接后重试。", errors: { placeUrl: "请输入有效的 Naver Place 详情链接。", applicantRole: "请选择申请人身份。", applicantName: `请输入不超过 ${BUSINESS_APPLICATION_NAME_MAX_LENGTH} 个字符的姓名。`, contactPhone: "请输入以010开头的韩国手机号码。", privacyConsent: "必须同意个人信息收集与使用。" }, apiErrors: { duplicate_application: "同一商家的申请正在审核中。", rate_limited: "短时间内提交次数过多，请稍后重试。", login_required: "登录已过期，请重新登录。", invalid_place_url: "请检查 Naver Place 链接。", invalid_contact_phone: "请检查手机号码格式。", migration_required: "申请系统需要更新，请联系管理员。", cross_site_blocked: "不安全的请求已被阻止，请刷新页面。" },
  },
  en: {
    formTitle: "Application details", description: "Share a few details and an administrator will review your application and explain the next steps.", loginTitle: "Spotzari business application", login: "Sign in to submit a business application.", loading: "Checking your account.", progressLabel: "Business listing process", steps: ["Apply", "Admin review", "Complete listing", "Final approval"], required: "required", placeUrl: "Naver Place URL", placeUrlHelp: "Enter a Naver Place detail URL or a https://naver.me/ short link. A URL alone does not verify ownership.", applicantRole: "Applicant role", roles: { owner: "Owner / operator", staff: "Staff / manager", agency: "Marketing agency" }, roleDetails: { owner: "Business owner or representative", staff: "An internal business manager", agency: "An authorized external agency" }, agencyNotice: "Marketing agencies must be authorized to manage the business. Additional proof may be requested.", applicantName: "Applicant name", contactPhone: "Korean mobile number", privacyConsent: "I consent to the collection and use of personal information to process this application.", privacyDetailsTitle: "View collection and use details", privacyItemsLabel: "Information collected", privacyItems: "Name, mobile number, applicant role, Naver Place URL, and account ID", privacyPurposeLabel: "Purpose", privacyPurpose: "Application review, identity or authorization checks, and application updates", privacyRetentionLabel: "Retention", privacyRetention: "One year after the application process ends, unless a longer period is required by law.", privacyRefusalLabel: "Refusal", privacyRefusal: "You may refuse, but you will not be able to submit an application.", privacyLink: "View Privacy Policy", submit: "Submit application", saving: "Submitting…", completed: "Submitted", success: "Your application has been received. We will provide the next steps after review.", viewStatus: "View application status", failed: "We could not submit your application. Check the fields and try again.", networkError: "Check your connection and try again.", errors: { placeUrl: "Enter a valid Naver Place detail URL.", applicantRole: "Select your role.", applicantName: `Enter a name of ${BUSINESS_APPLICATION_NAME_MAX_LENGTH} characters or fewer.`, contactPhone: "Enter a Korean mobile number beginning with 010.", privacyConsent: "Consent to personal information collection and use is required." }, apiErrors: { duplicate_application: "An application for this business is already under review.", rate_limited: "Too many applications were submitted recently. Try again later.", login_required: "Your session has expired. Sign in again.", invalid_place_url: "Check the Naver Place URL.", invalid_contact_phone: "Check the mobile number format.", migration_required: "The application system needs an update. Contact an administrator.", cross_site_blocked: "An unsafe request was blocked. Refresh the page." },
  },
  ja: {
    formTitle: "申請情報", description: "簡単な情報を入力すると、管理者の確認後に登録手続きをご案内します。", loginTitle: "Spotzari 店舗掲載申請", login: "ログイン後、掲載申請を送信できます。", loading: "アカウントを確認しています。", progressLabel: "店舗掲載の流れ", steps: ["掲載申請", "管理者確認", "店舗情報入力", "最終承認"], required: "必須", placeUrl: "Naver Place URL", placeUrlHelp: "Naver Placeの詳細URLまたは https://naver.me/ の短縮リンクを入力してください。URLのみでは店舗の所有権は確認されません。", applicantRole: "申請者の立場", roles: { owner: "代表者 / 事業主", staff: "スタッフ / マネージャー", agency: "マーケティング代理店" }, roleDetails: { owner: "店舗の代表者または事業主", staff: "店舗所属の担当者", agency: "委任された外部代理店" }, agencyNotice: "代理店は店舗から管理権限の委任を受ける必要があります。必要に応じて追加証明をお願いする場合があります。", applicantName: "申請者名", contactPhone: "韓国の携帯電話番号", privacyConsent: "掲載申請の処理に必要な個人情報の収集・利用に同意します。", privacyDetailsTitle: "個人情報の収集・利用案内を見る", privacyItemsLabel: "収集項目", privacyItems: "氏名、携帯電話番号、申請者の立場、Naver Place URL、会員ID", privacyPurposeLabel: "利用目的", privacyPurpose: "掲載申請の審査、本人・委任関係の確認、処理結果の案内", privacyRetentionLabel: "保有期間", privacyRetention: "申請処理終了後1年間。法令に別途保存義務がある場合はその期間保管します。", privacyRefusalLabel: "同意の拒否", privacyRefusal: "同意を拒否できますが、掲載申請は送信できません。", privacyLink: "プライバシーポリシーを確認", submit: "掲載申請を送信", saving: "送信中…", completed: "申請完了", success: "掲載申請を受け付けました。管理者確認後、次の手続きをご案内します。", viewStatus: "申請状況を確認", failed: "申請を送信できませんでした。入力内容を確認して再試行してください。", networkError: "ネットワーク接続を確認して再試行してください。", errors: { placeUrl: "有効なNaver Place詳細URLを入力してください。", applicantRole: "申請者の立場を選択してください。", applicantName: `${BUSINESS_APPLICATION_NAME_MAX_LENGTH}文字以内で氏名を入力してください。`, contactPhone: "010から始まる韓国の携帯電話番号を入力してください。", privacyConsent: "個人情報の収集・利用への同意が必要です。" }, apiErrors: { duplicate_application: "同じ店舗の申請がすでに審査中です。", rate_limited: "短時間に多数の申請が送信されました。しばらくしてから再試行してください。", login_required: "ログインの有効期限が切れました。再度ログインしてください。", invalid_place_url: "Naver Place URLを確認してください。", invalid_contact_phone: "携帯電話番号の形式を確認してください。", migration_required: "申請システムの更新が必要です。管理者にお問い合わせください。", cross_site_blocked: "安全でないリクエストがブロックされました。ページを更新してください。" },
  },
} satisfies Record<Locale, {
  formTitle: string; description: string; loginTitle: string; login: string; loading: string; progressLabel: string; steps: string[]; required: string;
  placeUrl: string; placeUrlHelp: string; applicantRole: string; roles: Record<BusinessApplicantRole, string>; roleDetails: Record<BusinessApplicantRole, string>; agencyNotice: string;
  applicantName: string; contactPhone: string; privacyConsent: string; privacyDetailsTitle: string; privacyItemsLabel: string; privacyItems: string; privacyPurposeLabel: string; privacyPurpose: string;
  privacyRetentionLabel: string; privacyRetention: string; privacyRefusalLabel: string; privacyRefusal: string; privacyLink: string; submit: string; saving: string; completed: string; success: string; viewStatus: string;
  failed: string; networkError: string; errors: Record<BusinessApplicationField, string>; apiErrors: Record<string, string>;
}>;
