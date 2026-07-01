import type { AnvilTemplate, TemplatePreview } from "@/types/template";
import type { AppLocale } from "@/lib/i18n/routing";
import { getApiBaseUrl } from "@/lib/api";

// Preview assets are pre-generated per-locale by the API and served
// statically at /static/template-previews/{id}/{locale}/. The web app derives
// the URLs from the template id + current UI locale by convention, so the
// templates API doesn't need to know about previews. An explicit
// `template.preview` (if ever provided) wins over the convention entirely.
export function getTemplatePreview(
  template: AnvilTemplate,
  locale: AppLocale,
): TemplatePreview {
  if (template.preview) {
    return template.preview;
  }
  const base = `${getApiBaseUrl()}/static/template-previews/${template.id}/${locale}`;
  return {
    pdfUrl: `${base}/preview.pdf`,
    thumbnailUrl: `${base}/thumbnail.png`,
    manifestUrl: `${base}/manifest.json`,
  };
}
