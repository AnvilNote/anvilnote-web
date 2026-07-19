"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Eye, EyeOff, ExternalLink, Info, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { WritingStyle } from "@anvilnote/ai-writer/contracts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { SettingsRow, SettingsSection } from "./settings-section";
import {
  AIClientError,
  aiClient,
  type AIProviderMetadata,
  type AIRuntimeCapability,
  type AISecretStatus,
} from "@/lib/ai/runtime-client";
import { useSettingsStore } from "@/lib/stores/settings-store";

const WRITING_STYLES: WritingStyle[] = [
  "auto",
  "neutral",
  "natural",
  "preserve-source",
];

function displayUsdPerMillion(value: number): string {
  return `US$${value.toFixed(2)}`;
}

function safeMessageKey(error: unknown): string {
  return error instanceof AIClientError ? error.shape.messageKey : "ai.errors.unknown_error";
}

export function AISettingsSection() {
  const t = useTranslations("ai");
  const settings = useSettingsStore();
  const [metadata, setMetadata] = useState<AIProviderMetadata | null>(null);
  const [capability, setCapability] = useState<AIRuntimeCapability | null>(null);
  const [credential, setCredential] = useState<AISecretStatus | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      aiClient.getProviders(),
      aiClient.getCapabilities(),
      aiClient.getCredentialStatus(),
    ])
      .then(([nextMetadata, nextCapability, nextCredential]) => {
        if (!active) return;
        setMetadata(nextMetadata);
        setCapability(nextCapability);
        setCredential(nextCredential);
        const selectedModel = nextMetadata.providers
          .flatMap((provider) => provider.models)
          .find((model) => model.id === settings.aiModelId && model.enabled);
        if (!selectedModel) settings.setAIModelId(nextMetadata.defaultModelId);
      })
      .catch((error) => {
        if (active) toast.error(t(safeMessageKey(error).replace(/^ai\./, "") as never));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [settings, t]);

  const provider = metadata?.providers.find(
    (candidate) => candidate.id === settings.aiProviderId && candidate.enabled,
  );
  const model = provider?.models.find(
    (candidate) => candidate.id === settings.aiModelId && candidate.enabled,
  );
  const guide = provider?.setupGuide;
  const canSave = Boolean(apiKey.trim()) && capability?.smartModeAvailable !== false;

  const storageText = useMemo(() => {
    if (!credential || !capability) return null;
    if (credential.storage === "os-secure-storage") return t("settings.secureDevice");
    if (credential.storage === "session-only") return t("settings.sessionOnly");
    return t("settings.storageUnavailable");
  }, [capability, credential, t]);

  async function saveKey() {
    if (!canSave) return;
    setSaving(true);
    try {
      const next = await aiClient.saveCredential(apiKey);
      setCredential(next);
      setApiKey("");
      setShowKey(false);
      toast.success(t("settings.keySaved"));
    } catch (error) {
      toast.error(t(safeMessageKey(error).replace(/^ai\./, "") as never));
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    if (!apiKey.trim() && !credential?.configured) return;
    setTesting(true);
    try {
      const result = await aiClient.testConnection({
        providerId: "openai",
        model: settings.aiModelId,
        ...(apiKey.trim() ? { apiKey } : {}),
      });
      toast[result.status === "success" ? "success" : "error"](
        t(result.messageKey.replace(/^ai\./, "") as never),
      );
    } catch (error) {
      toast.error(t(safeMessageKey(error).replace(/^ai\./, "") as never));
    } finally {
      setTesting(false);
    }
  }

  async function removeKey() {
    try {
      setCredential(await aiClient.removeCredential());
      setRemoveOpen(false);
      toast.success(t("settings.keyRemoved"));
    } catch (error) {
      toast.error(t(safeMessageKey(error).replace(/^ai\./, "") as never));
    }
  }

  return (
    <SettingsSection
      title={t("settings.title")}
      description={t("settings.description")}
    >
      <SettingsRow
        label={t("settings.provider")}
        control={
          <Select value="openai" disabled={loading}>
            <SelectTrigger className="w-48" aria-label={t("settings.provider")}>
              <SelectValue placeholder={t("settings.loading")} />
            </SelectTrigger>
            <SelectContent>
              {metadata?.providers
                .filter((candidate) => candidate.enabled)
                .map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {candidate.displayName}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        }
      />

      <SettingsRow
        label={t("settings.model")}
        control={
          <Select
            value={settings.aiModelId}
            disabled={loading}
            onValueChange={settings.setAIModelId}
          >
            <SelectTrigger className="w-48" aria-label={t("settings.model")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {provider?.models
                .filter((candidate) => candidate.enabled)
                .map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {candidate.displayName}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        }
      />

      <div className="space-y-3 rounded-lg border px-4 py-3">
        <div className="space-y-0.5">
          <p className="text-sm font-medium">{t("settings.apiKey")}</p>
          {credential?.configured ? (
            <p className="text-xs text-muted-foreground">
              {t("settings.configuredEnding", { lastFour: credential.lastFour ?? "••••" })}
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">{t("settings.notConfigured")}</p>
          )}
          {storageText ? <p className="text-xs text-muted-foreground">{storageText}</p> : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative min-w-0 flex-1">
            <Input
              aria-label={t("settings.apiKey")}
              autoComplete="off"
              className="pr-10"
              disabled={credential?.storage === "unavailable"}
              maxLength={4096}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={credential?.configured ? t("settings.replacePlaceholder") : "sk-…"}
              type={showKey ? "text" : "password"}
              value={apiKey}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="absolute right-1 top-1/2 -translate-y-1/2"
              aria-label={showKey ? t("settings.hideInput") : t("settings.showInput")}
              onClick={() => setShowKey((value) => !value)}
            >
              {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={testing || (!apiKey.trim() && !credential?.configured)}
            onClick={() => void testConnection()}
          >
            {testing ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("settings.testConnection")}
          </Button>
          <Button
            type="button"
            disabled={!canSave || saving}
            aria-label={t("settings.saveKey")}
            onClick={() => void saveKey()}
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : null}
            {t("settings.saveKey")}
          </Button>
        </div>
        <div className="flex items-center justify-between gap-3">
          {guide ? (
            <Dialog>
              <DialogTrigger asChild>
                <Button type="button" variant="link" size="sm" className="h-auto px-0">
                  <Info className="size-4" />
                  {t("settings.howToCreateKey")}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>{t(guide.titleKey.replace(/^ai\./, "") as never)}</DialogTitle>
                  <DialogDescription>
                    {t(guide.descriptionKey.replace(/^ai\./, "") as never)}
                  </DialogDescription>
                </DialogHeader>
                <ol className="space-y-3 pl-5 text-sm">
                  {guide.steps.map((step, index) => (
                    <li key={step.titleKey} className="list-decimal">
                      <p className="font-medium">
                        {t(step.titleKey.replace(/^ai\./, "") as never)}
                      </p>
                      <p className="text-muted-foreground">
                        {t(step.descriptionKey.replace(/^ai\./, "") as never)}
                      </p>
                      {step.suggestedValue ? (
                        <code className="mt-1 block rounded bg-muted px-2 py-1 text-xs">
                          {step.suggestedValue}
                        </code>
                      ) : null}
                      {index === 2 ? (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {t("settings.deviceNameExample")}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ol>
                <Separator />
                <ul className="space-y-2 text-xs text-muted-foreground">
                  {guide.notices.map((notice) => (
                    <li key={notice.messageKey}>
                      {t(notice.messageKey.replace(/^ai\./, "") as never)}
                    </li>
                  ))}
                </ul>
                <DialogFooter>
                  <Button asChild variant="outline">
                    <a href={guide.documentationUrl} target="_blank" rel="noopener noreferrer">
                      {t("settings.openPlatform")}
                      <ExternalLink className="size-4" />
                    </a>
                  </Button>
                  <DialogClose asChild>
                    <Button>{t("common.close")}</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : <span />}
          {credential?.configured ? (
            <Dialog open={removeOpen} onOpenChange={setRemoveOpen}>
              <DialogTrigger asChild>
                <Button type="button" variant="ghost" size="sm">
                  <Trash2 className="size-4" />
                  {t("settings.removeKey")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("settings.removeKeyTitle")}</DialogTitle>
                  <DialogDescription>{t("settings.removeKeyDescription")}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild><Button variant="outline">{t("common.cancel")}</Button></DialogClose>
                  <Button variant="destructive" onClick={() => void removeKey()}>
                    {t("settings.removeKey")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null}
        </div>
      </div>

      <SettingsRow
        label={t("settings.humanizer")}
        hint={t("settings.humanizerHint")}
        control={
          <Switch
            aria-label={t("settings.humanizer")}
            checked={settings.aiHumanizerEnabled}
            onCheckedChange={settings.setAIHumanizerEnabled}
          />
        }
      />
      <SettingsRow
        label={t("settings.defaultStyle")}
        control={
          <Select
            value={settings.aiWritingStyle}
            onValueChange={(value) => settings.setAIWritingStyle(value as WritingStyle)}
          >
            <SelectTrigger className="w-48" aria-label={t("settings.defaultStyle")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {WRITING_STYLES.map((style) => (
                <SelectItem key={style} value={style}>{t(`writingStyle.${style}` as never)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {model?.pricing ? (
        <div className="space-y-3 rounded-lg border px-4 py-3 text-sm">
          <div>
            <p className="font-medium">{t("settings.estimatedPricing")}</p>
            <p className="text-xs text-muted-foreground">{model.displayName}</p>
          </div>
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-xs">
            <dt>{t("settings.inputPricing")}</dt>
            <dd>{displayUsdPerMillion(model.pricing.inputPerMillionTokens)}</dd>
            <dt>{t("settings.cachedInputPricing")}</dt>
            <dd>{displayUsdPerMillion(model.pricing.cachedInputPerMillionTokens)}</dd>
            <dt>{t("settings.outputPricing")}</dt>
            <dd>{displayUsdPerMillion(model.pricing.outputPerMillionTokens)}</dd>
          </dl>
          <p className="text-xs text-muted-foreground">
            {t("settings.pricingUpdated", { date: metadata?.pricing.version ?? "" })}
          </p>
          <p className="text-xs text-muted-foreground">{t("settings.pricingDisclaimer")}</p>
        </div>
      ) : null}
    </SettingsSection>
  );
}

