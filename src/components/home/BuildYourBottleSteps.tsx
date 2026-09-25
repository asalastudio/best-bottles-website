"use client";
/* Step tiles are composited from real PSD-layer kit parts by scripts/homepage/build-your-bottle-steps.mjs. */
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

export default function BuildYourBottleSteps({ build }: { build?: HomepageData["buildYourBottle"] }) {
    const t = useCopy("home");
    const href = build?.destination === "/collections" ? "/collections" : "/matrix";
    return (
        <section className={styles.section} id="build-your-bottle" aria-labelledby="build-steps-heading">
            <div className={styles.head}>
                <h2 id="build-steps-heading">{build?.heading || t("buildStepsHeading")}</h2>
                <p className={styles.eyebrow}>{t("buildStepsEyebrow")}</p>
            </div>
            <div className={styles.body}>
                <ol className={styles.steps}>
                    {STEPS.map((step, index) => (
                        <li key={step.image} className={styles.step}>
                            <LocaleLink href={href} className={styles.stepLink}>
                                <span className={styles.media}>
                                    <img src={`/assets/homepage/build-steps/${step.image}.webp`} alt={t(step.alt)} width={960} height={600} loading="lazy" decoding="async" />
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
        </section>
    );
}
