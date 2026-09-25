"use client";
/* Step tiles: colored-pencil studies drawn with GPT Image 2.5 (2026-09-25) in the house pencil style
   (build-your-bottle-pencil-study, applicator sketches) after the approved component sheet. */
/* eslint-disable @next/next/no-img-element */
import type { HomepageData } from "@/sanity/lib/queries";
import LocaleLink from "@/components/LocaleLink";
import { useCopy } from "@/i18n/useCopy";
import styles from "./BuildYourBottleSteps.module.css";

const STEPS = [
    { image: "step-1", label: "buildStepBottle", alt: "buildStepBottleAlt" },
    { image: "step-2", label: "buildStepApplicator", alt: "buildStepApplicatorAlt" },
    { image: "step-3", label: "buildStepClosure", alt: "buildStepClosureAlt" },
    { image: "step-4", label: "buildStepComplete", alt: "buildStepCompleteAlt" },
] as const;

/** Jordan's comp (2026-09-25): four numbered steps and a start column, inside "Shop three ways" section 03. */
export default function BuildYourBottleSteps({ build, headingId }: { build?: HomepageData["buildYourBottle"]; headingId?: string }) {
    const t = useCopy("home");
    const href = build?.destination === "/collections" ? "/collections" : "/matrix";
    return (
        <div className={styles.block}>
            <div className={styles.head}>
                <h3 id={headingId}>{build?.heading || t("buildStepsHeading")}</h3>
                <p className={styles.eyebrow}>{t("buildStepsEyebrow")}</p>
            </div>
            <div className={styles.body}>
                <ol className={styles.steps}>
                    {STEPS.map((step, index) => (
                        <li key={step.image} className={styles.step}>
                            <LocaleLink href={href} className={styles.stepLink}>
                                <span className={styles.media}>
                                    <img src={`/assets/homepage/build-steps/${step.image}.webp`} alt={t(step.alt)} width={1440} height={900} loading="lazy" decoding="async" />
                                    <span className={styles.badge} aria-hidden="true">{index + 1}</span>
                                </span>
                                <span className={styles.label}>{t(step.label)}</span>
                            </LocaleLink>
                        </li>
                    ))}
                </ol>
                <div className={styles.cta}>
                    <p className={styles.tagline}>{t("buildStepsTagline")}</p>
                    <LocaleLink className={styles.button} href={href}>
                        {build?.buttonLabel || t("buildStepsCta")}<span aria-hidden="true" className={styles.arrow}>→</span>
                    </LocaleLink>
                </div>
            </div>
        </div>
    );
}
