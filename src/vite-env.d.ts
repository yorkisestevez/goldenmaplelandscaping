/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GA4_ID?: string;
  readonly VITE_META_PIXEL_ID?: string;
  readonly VITE_GOOGLE_ADS_ID?: string;
  readonly VITE_GOOGLE_ADS_LEAD_LABEL?: string;
  readonly VITE_SEARCH_CONSOLE_TOKEN?: string;
  readonly VITE_BOOKING_URL?: string;
  readonly VITE_CRM_BASE_URL?: string;
  readonly VITE_CLARITY_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
