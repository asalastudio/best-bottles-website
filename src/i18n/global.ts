import type { AppLocale } from "./config";
import en from "../../messages/en.json";

declare module "next-intl" {
    interface AppConfig {
        Locale: AppLocale;
        Messages: typeof en;
    }
}
