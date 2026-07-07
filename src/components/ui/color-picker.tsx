"use client"

import Color from "color"
import { PipetteIcon } from "lucide-react"
import { Slider } from "radix-ui"
import {
  type ComponentProps,
  createContext,
  type HTMLAttributes,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface ColorPickerContextValue {
  hue: number
  saturation: number
  lightness: number
  alpha: number
  mode: string
  setHue: (hue: number) => void
  setSaturation: (saturation: number) => void
  setLightness: (lightness: number) => void
  setAlpha: (alpha: number) => void
  setMode: (mode: string) => void
}

const ColorPickerContext = createContext<ColorPickerContextValue | undefined>(undefined)

export const useColorPicker = () => {
  const context = useContext(ColorPickerContext)

  if (!context) {
    throw new Error("useColorPicker must be used within a ColorPickerProvider")
  }

  return context
}

export type ColorPickerProps = HTMLAttributes<HTMLDivElement> & {
  value?: Parameters<typeof Color>[0]
  defaultValue?: Parameters<typeof Color>[0]
  onChange?: (value: Parameters<typeof Color.rgb>[0]) => void
}

export const ColorPicker = ({
  value,
  defaultValue = "#000000",
  onChange,
  className,
  ...props
}: ColorPickerProps) => {
  // Falls back to defaultValue only when no controlled value is given at
  // all — NOT with `||`, which would treat a legitimate zero component
  // (e.g. saturation/lightness of an achromatic black/gray/white value) as
  // "missing" and silently substitute a synthetic non-zero default. That
  // mismatch between this initial state and the resync effect below (which
  // correctly reads the real 0) is what caused an infinite render loop the
  // first time a caller (function-plot-dialog) passed a black/gray default.
  const initialColor = value ? Color(value) : Color(defaultValue)

  const [hue, setHue] = useState(() => initialColor.hue())
  const [saturation, setSaturation] = useState(() => initialColor.saturationl())
  const [lightness, setLightness] = useState(() => initialColor.lightness())
  const [alpha, setAlpha] = useState(() => initialColor.alpha() * 100)
  const [mode, setMode] = useState("hex")

  // Update color when controlled value changes
  useEffect(() => {
    if (value) {
      const color = Color(value)
      const [h, s, l] = color.hsl().array()

      setHue(h)
      setSaturation(s)
      setLightness(l)
      setAlpha(color.alpha() * 100)
    }
  }, [value])

  // Notify parent of changes
  useEffect(() => {
    if (onChange) {
      const color = Color.hsl(hue, saturation, lightness).alpha(alpha / 100)
      const rgba = color.rgb().array()

      onChange([rgba[0], rgba[1], rgba[2], alpha / 100])
    }
    // `onChange` is intentionally omitted: callers often pass an inline
    // closure that gets a new identity every render, and including it here
    // would re-fire this effect (and thus call onChange again) on every
    // parent re-render, not just on an actual color change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hue, saturation, lightness, alpha])

  return (
    <ColorPickerContext.Provider
      value={{
        hue,
        saturation,
        lightness,
        alpha,
        mode,
        setHue,
        setSaturation,
        setLightness,
        setAlpha,
        setMode,
      }}
    >
      <div className={cn("flex size-full flex-col gap-4", className)} {...(props as any)} />
    </ColorPickerContext.Provider>
  )
}

export type ColorPickerSelectionProps = HTMLAttributes<HTMLDivElement>

export const ColorPickerSelection = memo(({ className, ...props }: ColorPickerSelectionProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [positionX, setPositionX] = useState(0)
  const [positionY, setPositionY] = useState(0)
  const { hue, setSaturation, setLightness } = useColorPicker()

  const backgroundGradient = useMemo(() => {
    return `linear-gradient(0deg, rgba(0,0,0,1), rgba(0,0,0,0)),
            linear-gradient(90deg, rgba(255,255,255,1), rgba(255,255,255,0)),
            hsl(${hue}, 100%, 50%)`
  }, [hue])

  // Applies a client coordinate to saturation/lightness unconditionally —
  // deliberately NOT gated on `isDragging`. onPointerDown below calls
  // setIsDragging(true) and then this in the same synchronous tick; React
  // state updates aren't visible until the next render, so a version of
  // this gated on `isDragging` would read the pre-update (false) value from
  // its closure and bail out, meaning a plain click (pointerdown+pointerup
  // with no movement in between, e.g. from an automated click or a fast
  // real click) would never actually change the color — only an explicit
  // drag would. Splitting the coordinate math out from the isDragging gate
  // fixes that: the initial click always applies immediately, and the
  // window-level pointermove listener (only attached while isDragging is
  // true, via the effect below) continues to update it during a drag.
  const applyPointerPosition = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) {
        return
      }
      const rect = containerRef.current.getBoundingClientRect()
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
      setPositionX(x)
      setPositionY(y)
      setSaturation(x * 100)
      const topLightness = x < 0.01 ? 100 : 50 + 50 * (1 - x)
      const lightness = topLightness * (1 - y)

      setLightness(lightness)
    },
    [setSaturation, setLightness],
  )

  const handlePointerMove = useCallback(
    (event: PointerEvent) => {
      applyPointerPosition(event.clientX, event.clientY)
    },
    [applyPointerPosition],
  )

  useEffect(() => {
    const handlePointerUp = () => setIsDragging(false)

    if (isDragging) {
      window.addEventListener("pointermove", handlePointerMove)
      window.addEventListener("pointerup", handlePointerUp)
    }

    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
    }
  }, [isDragging, handlePointerMove])

  return (
    <div
      className={cn("relative size-full cursor-crosshair rounded", className)}
      onPointerDown={e => {
        e.preventDefault()
        setIsDragging(true)
        applyPointerPosition(e.clientX, e.clientY)
      }}
      ref={containerRef}
      style={{
        background: backgroundGradient,
      }}
      {...(props as any)}
    >
      <div
        className="-translate-x-1/2 -translate-y-1/2 pointer-events-none absolute h-4 w-4 rounded-full border-2 border-white"
        style={{
          left: `${positionX * 100}%`,
          top: `${positionY * 100}%`,
          boxShadow: "0 0 0 1px rgba(0,0,0,0.5)",
        }}
      />
    </div>
  )
})

ColorPickerSelection.displayName = "ColorPickerSelection"

export type ColorPickerHueProps = ComponentProps<typeof Slider.Root>

export const ColorPickerHue = ({ className, ...props }: ColorPickerHueProps) => {
  const { hue, setHue } = useColorPicker()

  return (
    <Slider.Root
      className={cn("relative flex h-4 w-full touch-none", className)}
      max={360}
      onValueChange={([hue]) => setHue(hue)}
      step={1}
      value={[hue]}
      {...(props as any)}
    >
      <Slider.Track className="relative my-0.5 h-3 w-full grow rounded-full bg-[linear-gradient(90deg,#FF0000,#FFFF00,#00FF00,#00FFFF,#0000FF,#FF00FF,#FF0000)]">
        <Slider.Range className="absolute h-full" />
      </Slider.Track>
      <Slider.Thumb className="block h-4 w-4 rounded-full border border-primary/50 bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" />
    </Slider.Root>
  )
}

export type ColorPickerAlphaProps = ComponentProps<typeof Slider.Root>

export const ColorPickerAlpha = ({ className, ...props }: ColorPickerAlphaProps) => {
  const { alpha, setAlpha } = useColorPicker()

  return (
    <Slider.Root
      className={cn("relative flex h-4 w-full touch-none", className)}
      max={100}
      onValueChange={([alpha]) => setAlpha(alpha)}
      step={1}
      value={[alpha]}
      {...(props as any)}
    >
      <Slider.Track
        className="relative my-0.5 h-3 w-full grow rounded-full"
        style={{
          background:
            'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uCTZhw1gGGYhAGBZIA/nYDCgBDAm9BGDWAAJyRCgLaBCAAgXwixzAS0pgAAAABJRU5ErkJggg==") left center',
        }}
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent to-black/50" />
        <Slider.Range className="absolute h-full rounded-full bg-transparent" />
      </Slider.Track>
      <Slider.Thumb className="block h-4 w-4 rounded-full border border-primary/50 bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" />
    </Slider.Root>
  )
}

export type ColorPickerEyeDropperProps = ComponentProps<typeof Button>

export const ColorPickerEyeDropper = ({ className, ...props }: ColorPickerEyeDropperProps) => {
  const { setHue, setSaturation, setLightness, setAlpha } = useColorPicker()

  const handleEyeDropper = async () => {
    try {
      // @ts-expect-error - EyeDropper API is experimental
      const eyeDropper = new EyeDropper()
      const result = await eyeDropper.open()
      const color = Color(result.sRGBHex)
      const [h, s, l] = color.hsl().array()

      setHue(h)
      setSaturation(s)
      setLightness(l)
      setAlpha(100)
    } catch (error) {
      console.error("EyeDropper failed:", error)
    }
  }

  return (
    <Button
      className={cn("shrink-0 text-muted-foreground", className)}
      onClick={handleEyeDropper}
      size="icon"
      type="button"
      variant="outline"
      {...(props as any)}
    >
      <PipetteIcon size={16} />
    </Button>
  )
}

export type ColorPickerOutputProps = ComponentProps<typeof SelectTrigger>

const formats = ["hex", "rgb", "css", "hsl"]

export const ColorPickerOutput = ({ className, ...props }: ColorPickerOutputProps) => {
  const { mode, setMode } = useColorPicker()

  return (
    <Select onValueChange={setMode} value={mode}>
      <SelectTrigger className="h-8 w-20 shrink-0 text-xs" {...(props as any)}>
        <SelectValue placeholder="Mode" />
      </SelectTrigger>
      <SelectContent>
        {formats.map(format => (
          <SelectItem className="text-xs" key={format} value={format}>
            {format.toUpperCase()}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

type PercentageInputProps = Omit<ComponentProps<typeof Input>, "value" | "onChange"> & {
  value: number
  onChange?: (value: number) => void
}

const PercentageInput = ({ className, value, onChange, ...props }: PercentageInputProps) => {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])

  return (
    <div className="relative">
      <Input
        readOnly={!onChange}
        type="text"
        value={draft}
        onChange={
          onChange
            ? e => {
                const next = e.target.value
                setDraft(next)
                const parsed = Number(next)
                if (next !== "" && Number.isFinite(parsed) && parsed >= 0 && parsed <= 100) {
                  onChange(parsed)
                }
              }
            : undefined
        }
        {...(props as any)}
        className={cn(
          "h-8 w-[3.25rem] rounded-l-none bg-secondary px-2 text-xs shadow-none",
          className,
        )}
      />
      <span className="-translate-y-1/2 absolute top-1/2 right-2 text-muted-foreground text-xs">
        %
      </span>
    </div>
  )
}

export type ColorPickerFormatProps = HTMLAttributes<HTMLDivElement>

// Every mode's inputs were `readOnly` — the hue/saturation square and hue
// slider were the ONLY way to change a color, typing a hex/rgb/css/hsl
// value directly did nothing. Fixed by making each mode's input(s)
// editable, parsing back into the shared hue/saturation/lightness state.
//
// Each input tracks its own local "draft" string, separate from the
// derived display value: parsing happens on every keystroke, but an
// in-progress value that doesn't parse yet (e.g. "#12", or a partially
// erased number) must not be forced back to the last-valid formatted
// string mid-edit — that would fight the user's cursor and make deleting
// characters feel broken (same class of bug as this session's earlier
// NaN-as-empty-sentinel fix for plain number inputs, adapted here to
// "invalid parses don't overwrite the draft, only valid ones update the
// picker's real color state"). Draft state resyncs from the derived value
// via useEffect whenever the color changes through some OTHER means (the
// saturation square, the hue/alpha sliders, an eyedropper pick) so those
// still visibly update these fields.
export const ColorPickerFormat = ({ className, ...props }: ColorPickerFormatProps) => {
  const { hue, saturation, lightness, alpha, mode, setHue, setSaturation, setLightness, setAlpha } =
    useColorPicker()
  const color = Color.hsl(hue, saturation, lightness, alpha / 100)

  const applyColor = useCallback(
    (next: ReturnType<typeof Color>) => {
      const [h, s, l] = next.hsl().array()
      setHue(h)
      setSaturation(s)
      setLightness(l)
    },
    [setHue, setSaturation, setLightness],
  )

  const hex = color.hex()
  const [hexDraft, setHexDraft] = useState(hex)
  useEffect(() => setHexDraft(hex), [hex])

  const rgb = color.rgb().array().map(value => Math.round(value))
  const [rgbDraft, setRgbDraft] = useState(rgb.map(String))
  useEffect(() => setRgbDraft(rgb.map(String)), [rgb.join(",")])

  const cssValue = `rgba(${rgb.join(", ")}, ${alpha}%)`
  const [cssDraft, setCssDraft] = useState(cssValue)
  useEffect(() => setCssDraft(cssValue), [cssValue])

  const hsl = color.hsl().array().map(value => Math.round(value))
  const [hslDraft, setHslDraft] = useState(hsl.map(String))
  useEffect(() => setHslDraft(hsl.map(String)), [hsl.join(",")])

  if (mode === "hex") {
    return (
      <div
        className={cn(
          "-space-x-px relative flex w-full items-center rounded-md shadow-sm",
          className,
        )}
        {...(props as any)}
      >
        <Input
          className="h-8 rounded-r-none bg-secondary px-2 text-xs shadow-none"
          onChange={e => {
            const next = e.target.value
            setHexDraft(next)
            try {
              applyColor(Color(next.startsWith("#") ? next : `#${next}`))
            } catch {
              // Incomplete/invalid hex while typing — keep the draft, don't
              // touch the picker's real color yet.
            }
          }}
          type="text"
          value={hexDraft}
        />
        <PercentageInput value={alpha} onChange={setAlpha} />
      </div>
    )
  }

  if (mode === "rgb") {
    return (
      <div
        className={cn("-space-x-px flex items-center rounded-md shadow-sm", className)}
        {...(props as any)}
      >
        {rgbDraft.map((value, index) => (
          <Input
            className={cn(
              "h-8 rounded-r-none bg-secondary px-2 text-xs shadow-none",
              index && "rounded-l-none",
              className,
            )}
            key={index}
            onChange={e => {
              const next = [...rgbDraft]
              next[index] = e.target.value
              setRgbDraft(next)
              const parsed = next.map(Number)
              if (parsed.every(n => Number.isFinite(n) && n >= 0 && n <= 255)) {
                applyColor(Color.rgb(parsed[0], parsed[1], parsed[2]).alpha(alpha / 100))
              }
            }}
            type="text"
            value={value}
          />
        ))}
        <PercentageInput value={alpha} onChange={setAlpha} />
      </div>
    )
  }

  if (mode === "css") {
    return (
      <div className={cn("w-full rounded-md shadow-sm", className)} {...(props as any)}>
        <Input
          className="h-8 w-full bg-secondary px-2 text-xs shadow-none"
          onChange={e => {
            const next = e.target.value
            setCssDraft(next)
            try {
              const parsed = Color(next)
              applyColor(parsed)
              setAlpha(parsed.alpha() * 100)
            } catch {
              // Incomplete/invalid css string while typing.
            }
          }}
          type="text"
          value={cssDraft}
          {...(props as any)}
        />
      </div>
    )
  }

  if (mode === "hsl") {
    return (
      <div
        className={cn("-space-x-px flex items-center rounded-md shadow-sm", className)}
        {...(props as any)}
      >
        {hslDraft.map((value, index) => (
          <Input
            className={cn(
              "h-8 rounded-r-none bg-secondary px-2 text-xs shadow-none",
              index && "rounded-l-none",
              className,
            )}
            key={index}
            onChange={e => {
              const next = [...hslDraft]
              next[index] = e.target.value
              setHslDraft(next)
              const parsed = next.map(Number)
              const maxes = [360, 100, 100]
              if (parsed.every((n, i) => Number.isFinite(n) && n >= 0 && n <= maxes[i])) {
                setHue(parsed[0])
                setSaturation(parsed[1])
                setLightness(parsed[2])
              }
            }}
            type="text"
            value={value}
          />
        ))}
        <PercentageInput value={alpha} onChange={setAlpha} />
      </div>
    )
  }

  return null
}

// Demo
export function Demo() {
  return (
    <div className="fixed inset-0 flex items-center justify-center p-8">
      <ColorPicker defaultValue="#6366f1" className="h-auto w-64">
        <ColorPickerSelection className="h-40 rounded-lg" />
        <ColorPickerHue />
        <ColorPickerAlpha />
        <div className="flex items-center gap-2">
          <ColorPickerEyeDropper />
          <ColorPickerOutput />
          <ColorPickerFormat />
        </div>
      </ColorPicker>
    </div>
  )
}
