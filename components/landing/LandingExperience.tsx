"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import {
  ArrowDown,
  ArrowRight,
  Bookmark,
  Check,
  Clock3,
  Compass,
  Languages,
  Map,
  MapPin,
  Menu,
  Search,
  ShieldCheck,
  Store,
  Utensils,
  WalletCards,
} from "lucide-react";
import { landingCopy } from "@/components/landing/landing-copy";
import type { LandingPlace } from "@/components/landing/types";
import { localeMeta, locales, type Locale, withLocale } from "@/lib/i18n";
import styles from "./LandingExperience.module.css";

type Props = { locale: Locale; places: LandingPlace[]; children?: ReactNode };

export function LandingExperience({ locale, places, children }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);
  const copy = landingCopy[locale];
  const featured = places[0];

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;

    const update = () => {
      frame = 0;
      const rootRect = root.getBoundingClientRect();
      const total = Math.max(1, root.offsetHeight - window.innerHeight);
      const overall = Math.min(1, Math.max(0, -rootRect.top / total));
      root.style.setProperty("--landing-progress", overall.toFixed(4));
      root.toggleAttribute("data-scrolled", overall > 0.025);

      root.querySelectorAll<HTMLElement>("[data-scroll-scene]").forEach((scene) => {
        const rect = scene.getBoundingClientRect();
        const distance = Math.max(1, rect.height - window.innerHeight);
        const progress = reduceMotion ? 1 : Math.min(1, Math.max(0, -rect.top / distance));
        scene.style.setProperty("--scene-progress", progress.toFixed(4));
      });
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    window.addEventListener("orientationchange", schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      window.removeEventListener("orientationchange", schedule);
    };
  }, []);

  return (
    <div ref={rootRef} className={styles.root}>
      <LandingHeader locale={locale} />
      <div className={styles.progress} aria-hidden="true"><span /></div>
      <Hero locale={locale} imageUrl={featured?.imageUrl ?? ""} />
      {children ? <section id="explore-home" className={styles.homeBridge}>{children}</section> : null}
      <Discover locale={locale} places={places} />
      <Decide locale={locale} place={featured} />
      <Plan locale={locale} places={places} />
      <Business locale={locale} place={featured} />
      <FinalCta locale={locale} />
      <footer className={styles.footer}>
        <p>{copy.footer}</p>
        <nav aria-label="Legal">
          <Link href={withLocale("/service-info", locale)}>{copy.service}</Link>
          <Link href={withLocale("/privacy", locale)}>{copy.privacy}</Link>
          <Link href={withLocale("/terms", locale)}>{copy.terms}</Link>
        </nav>
      </footer>
    </div>
  );
}

function LandingHeader({ locale }: { locale: Locale }) {
  const copy = landingCopy[locale];
  return (
    <header className={styles.header}>
      <Link href={withLocale("/", locale)} className={styles.wordmark} aria-label="Spotzari home">
        <span className={styles.logoMark}><Image src={locale === "zh" ? "/brand/spotzari-zh.png" : "/brand/spotzari-ko.png"} alt="" width={34} height={34} priority /></span>
        <span>spotzari</span>
      </Link>
      <nav className={styles.desktopNav} aria-label="Landing">
        <a href="#discover">{copy.navAbout}</a>
        <Link href={withLocale("/explore", locale)}>{copy.navExplore}</Link>
        <Link href={withLocale("/business-application", locale)}>{copy.navBusiness}</Link>
      </nav>
      <div className={styles.languageMenu}>
        <Languages size={16} aria-hidden="true" />
        <select aria-label="Language" value={locale} onChange={(event) => { window.location.href = withLocale("/", event.target.value as Locale); }}>
          {locales.map((item) => <option key={item} value={item}>{localeMeta[item].nativeLabel}</option>)}
        </select>
      </div>
    </header>
  );
}

function Hero({ locale, imageUrl }: { locale: Locale; imageUrl: string }) {
  const copy = landingCopy[locale];
  return (
    <section className={`${styles.scene} ${styles.heroScene}`} data-scroll-scene>
      <div className={styles.sticky}>
        <div className={styles.heroBackdrop}>
          {imageUrl ? <Image src={imageUrl} alt="" fill priority sizes="100vw" className={styles.heroImage} /> : null}
          <div className={styles.heroShade} />
        </div>
        <div className={styles.heroContent}>
          <p className={styles.eyebrow}>{copy.heroEyebrow}</p>
          <h1>{copy.heroTitle}<span>{copy.heroBrand}</span></h1>
          <p className={styles.heroBody}>{copy.heroBody}</p>
          <div className={styles.heroActions}>
            <Link href={withLocale("/explore", locale)} className={styles.primaryButton}>{copy.heroExplore}<ArrowRight size={17} /></Link>
            <a href="#explore-home" className={styles.secondaryButton}>{copy.heroMore}<ArrowDown size={17} /></a>
          </div>
        </div>
        <div className={styles.heroInterface} aria-hidden="true">
          <div className={styles.searchBar}><Search size={18} /><span>{copy.heroSearch}</span></div>
          <div className={styles.miniMap}>
            <span className={styles.mapRoadOne} /><span className={styles.mapRoadTwo} />
            <i className={styles.markerOne}><MapPin size={17} /></i>
            <i className={styles.markerTwo}><MapPin size={17} /></i>
            <i className={styles.markerThree}><MapPin size={17} /></i>
            <b><Map size={16} />{copy.heroMap}</b>
          </div>
        </div>
        <div className={styles.scrollCue} aria-hidden="true"><span />Scroll</div>
      </div>
    </section>
  );
}

function Discover({ locale, places }: { locale: Locale; places: LandingPlace[] }) {
  const copy = landingCopy[locale];
  return (
    <section id="discover" className={`${styles.scene} ${styles.discoverScene}`} data-scroll-scene>
      <div className={styles.sticky}>
        <SectionHeading kicker={copy.discoverKicker} title={copy.discoverTitle} body={copy.discoverBody} />
        <div className={styles.discoveryCanvas}>
          <div className={styles.categoryRail} aria-hidden="true"><span className={styles.activeCategory}><Compass size={15} />All</span><span>Food</span><span>Cafe</span><span>Place</span></div>
          <div className={styles.cardStage}>
            {places.length ? places.slice(0, 3).map((place, index) => (
              <article key={place.id} className={styles.placeCard} style={{ "--card-index": index } as CSSProperties}>
                <div className={styles.cardImage}>
                  {place.imageUrl ? <Image src={place.imageUrl} alt="" fill sizes="(max-width: 768px) 78vw, 330px" className="object-cover" /> : <div className={styles.photoFallback}><MapPin /></div>}
                  <span>{place.category}</span>
                </div>
                <div className={styles.cardBody}><p>{place.secondaryName}</p><h3><Link href={withLocale(`/places/${place.slug}`, locale)}>{place.name}</Link></h3><small><MapPin size={13} />{place.address}</small><span className={styles.savePill}><Bookmark size={15} />{copy.saved}</span></div>
              </article>
            )) : <div className={styles.emptyCard}>{copy.noPlaces}</div>}
          </div>
          <MapPanel places={places} label={copy.mapReady} />
        </div>
      </div>
    </section>
  );
}

function MapPanel({ places, label }: { places: LandingPlace[]; label: string }) {
  return (
    <div className={styles.mapPanel} aria-hidden="true">
      <div className={styles.mapGrid} />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M-5 78 C20 64, 28 92, 51 58 S78 20, 106 35" /><path d="M10 -4 C22 28, 46 20, 55 48 S75 82, 90 105" /></svg>
      {places.slice(0, 3).map((place, index) => <span key={place.id} className={styles.mapMarker} style={{ "--marker-index": index } as CSSProperties}><MapPin size={18} /><b>{place.name}</b></span>)}
      <p><Map size={16} />{label}</p>
    </div>
  );
}

function Decide({ locale, place }: { locale: Locale; place?: LandingPlace }) {
  const copy = landingCopy[locale];
  const factIcons = { menu: Utensils, price: WalletCards, hours: Clock3, waiting: Clock3, solo: Check, transit: MapPin } as const;
  return (
    <section className={`${styles.scene} ${styles.decideScene}`} data-scroll-scene>
      <div className={styles.sticky}>
        <SectionHeading kicker={copy.decideKicker} title={copy.decideTitle} body={copy.decideBody} />
        <div className={styles.decisionStage}>
          <div className={styles.phone}>
            <div className={styles.phoneTop}><span /><b>{copy.detail}</b><Menu size={17} /></div>
            <div className={styles.phonePhoto}>{place?.imageUrl ? <Image src={place.imageUrl} alt="" fill sizes="320px" className="object-cover" /> : <MapPin size={38} />}</div>
            <div className={styles.phoneBody}><small>{place?.category ?? "Spotzari"}</small><h3>{place?.name ?? copy.noPlaces}</h3><p>{place?.address}</p>
              <div className={styles.factList}>{place?.facts.slice(0, 4).map((fact) => { const Icon = factIcons[fact.key]; return <div key={fact.key}><Icon size={16} /><span><small>{fact.label}</small><b>{fact.value}</b></span></div>; })}</div>
            </div>
          </div>
          <aside className={`${styles.callout} ${styles.calloutOne}`}><span><ShieldCheck size={18} /></span><div><b>{copy.confirmed}</b><p>{copy.verified}</p></div></aside>
          <aside className={`${styles.callout} ${styles.calloutTwo}`}><span><Clock3 size={18} /></span><div><b>{copy.unknown}</b><p>{copy.decideBody}</p></div></aside>
          <aside className={`${styles.callout} ${styles.calloutThree}`}><span><Utensils size={18} /></span><div><b>{place?.facts[0]?.label ?? copy.confirmed}</b><p>{place?.facts[0]?.value ?? copy.unknown}</p></div></aside>
        </div>
      </div>
    </section>
  );
}

function Plan({ locale, places }: { locale: Locale; places: LandingPlace[] }) {
  const copy = landingCopy[locale];
  const routePlaces = places.slice(0, 3);
  return (
    <section className={`${styles.scene} ${styles.planScene}`} data-scroll-scene>
      <div className={styles.sticky}>
        <SectionHeading kicker={copy.planKicker} title={copy.planTitle} body={copy.planBody} />
        <div className={styles.routeBoard}>
          <div className={styles.routeMap}><div className={styles.mapGrid} />
            <svg viewBox="0 0 100 100" preserveAspectRatio="none"><path className={styles.routePath} pathLength="1" d="M16 72 C26 52, 37 62, 47 45 S66 25, 82 32" /></svg>
            {routePlaces.map((place, index) => <span key={place.id} className={styles.routeMarker} style={{ "--marker-index": index } as CSSProperties}><i>{index + 1}</i><b>{place.name}</b></span>)}
          </div>
          <div className={styles.itineraryPanel}><p><Compass size={16} />{copy.planBadge}</p>{routePlaces.map((place, index) => <div key={place.id} style={{ "--card-index": index } as CSSProperties}><span>{index + 1}</span><section><small>{copy.stop} {index + 1}</small><b>{place.name}</b><em>{place.category}</em></section></div>)}<strong><Check size={16} />{copy.routeComplete}</strong></div>
        </div>
      </div>
    </section>
  );
}

function Business({ locale, place }: { locale: Locale; place?: LandingPlace }) {
  const copy = landingCopy[locale];
  return (
    <section className={`${styles.scene} ${styles.businessScene}`} data-scroll-scene>
      <div className={styles.sticky}>
        <div className={styles.businessLayout}>
          <div className={styles.businessCopy}><p>{copy.businessKicker}</p><h2>{copy.businessTitle}</h2><span>{copy.businessBody}</span><ol><li><i>1</i>{copy.businessStep1}</li><li><i>2</i>{copy.businessStep2}</li><li><i>3</i>{copy.businessStep3}</li></ol><Link href={withLocale("/business-application", locale)} className={styles.primaryButton}>{copy.businessCta}<ArrowRight size={17} /></Link></div>
          <div className={styles.businessCard}>
            <div className={styles.businessPhoto}>{place?.imageUrl ? <Image src={place.imageUrl} alt="" fill sizes="520px" className="object-cover" /> : <Store size={44} />}</div>
            <div><small>{place?.category ?? "Spotzari"}</small><h3>{place?.name ?? copy.businessTitle}</h3><p>{place?.address ?? copy.businessBody}</p>{place?.facts.slice(0, 3).map((fact) => <span key={fact.key}><Check size={14} />{fact.label} · {fact.value}</span>)}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

function FinalCta({ locale }: { locale: Locale }) {
  const copy = landingCopy[locale];
  return (
    <section className={styles.finalCta}>
      <div className={styles.finalMap} aria-hidden="true"><span /><span /><span /><svg viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M-10 82 C15 60, 35 94, 53 55 S81 15, 110 32" /></svg></div>
      <div><p>{copy.finalKicker}</p><h2>{copy.finalTitle}</h2><span>{copy.finalBody}</span><section><Link href={withLocale("/explore", locale)} className={styles.lightButton}>{copy.finalExplore}<ArrowRight size={17} /></Link><Link href={withLocale("/business-application", locale)} className={styles.outlineButton}>{copy.finalBusiness}<Store size={17} /></Link></section></div>
    </section>
  );
}

function SectionHeading({ kicker, title, body }: { kicker: string; title: string; body: string }) {
  return <div className={styles.sectionHeading}><p>{kicker}</p><h2>{title}</h2><span>{body}</span></div>;
}
