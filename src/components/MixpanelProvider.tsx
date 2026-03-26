"use client";

import { useEffect } from "react";
import mixpanel from "mixpanel-browser";

const MIXPANEL_TOKEN = "ab0478c15b0c8af6cc5eca4d82b2a7ae";

let initialized = false;

export function MixpanelProvider() {
  useEffect(() => {
    if (initialized) return;
    initialized = true;

    mixpanel.init(MIXPANEL_TOKEN, {
      autocapture: true,
      track_pageview: "full-url",
      record_sessions_percent: 100,
    });
  }, []);

  return null;
}
