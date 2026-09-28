"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { PersonStanding, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  applyA11yPrefs,
  DEFAULT_A11Y_PREFS,
  isDefaultA11yPrefs,
  loadA11yPrefs,
  saveA11yPrefs,
  type A11yPrefs,
  type TextSize,
} from "@/lib/a11y/prefs";

const SWITCHES: { key: Exclude<keyof A11yPrefs, "textSize">; label: string; description: string }[] = [
  { key: "highContrast", label: "High contrast", description: "Darker text and stronger borders." },
  { key: "reduceMotion", label: "Reduce motion", description: "Turns off animations and transitions." },
  { key: "underlineLinks", label: "Underline links", description: "Makes every link easy to spot." },
  { key: "readableSpacing", label: "Readable spacing", description: "More space between lines, letters and words." },
];

export function A11yMenu() {
  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              size="icon-lg"
              variant="outline"
              className="size-12 rounded-full shadow-lg"
              aria-label="Accessibility options"
            >
              <PersonStanding className="size-5" />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="left">Accessibility</TooltipContent>
      </Tooltip>
      <PopoverContent
        side="top"
        align="end"
        sideOffset={12}
        className="max-h-(--radix-popover-content-available-height) w-[min(22rem,calc(100vw-2rem))] gap-4 overflow-y-auto p-4"
      >
        <A11yPanel />
      </PopoverContent>
    </Popover>
  );
}

/** Mounted only while the popover is open, so reading storage here is client-only. */
function A11yPanel() {
  const [prefs, setPrefs] = useState<A11yPrefs>(() => loadA11yPrefs());
  const { theme, setTheme } = useTheme();

  function update(next: A11yPrefs) {
    setPrefs(next);
    applyA11yPrefs(document.documentElement, next);
    saveA11yPrefs(next);
  }

  return (
    <>
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-base font-semibold">Accessibility</h2>
        <p className="text-muted-foreground text-sm">Saved on this device for every page.</p>
      </div>

      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel id="a11y-text-size">Text size</FieldLabel>
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={0}
            aria-labelledby="a11y-text-size"
            value={prefs.textSize}
            onValueChange={(value) => {
              if (value) update({ ...prefs, textSize: value as TextSize });
            }}
            className="w-full"
          >
            <ToggleGroupItem value="default" className="flex-1">Default</ToggleGroupItem>
            <ToggleGroupItem value="large" className="flex-1">Large</ToggleGroupItem>
            <ToggleGroupItem value="larger" className="flex-1">Larger</ToggleGroupItem>
          </ToggleGroup>
        </Field>

        <Field>
          <FieldLabel id="a11y-theme">Theme</FieldLabel>
          <ToggleGroup
            type="single"
            variant="outline"
            spacing={0}
            aria-labelledby="a11y-theme"
            value={theme ?? "system"}
            onValueChange={(value) => {
              if (value) setTheme(value);
            }}
            className="w-full"
          >
            <ToggleGroupItem value="light" className="flex-1">Light</ToggleGroupItem>
            <ToggleGroupItem value="dark" className="flex-1">Dark</ToggleGroupItem>
            <ToggleGroupItem value="system" className="flex-1">System</ToggleGroupItem>
          </ToggleGroup>
        </Field>

        <FieldSeparator />

        {SWITCHES.map((s) => (
          <Field key={s.key} orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor={`a11y-${s.key}`}>{s.label}</FieldLabel>
              <FieldDescription>{s.description}</FieldDescription>
            </FieldContent>
            <Switch
              id={`a11y-${s.key}`}
              checked={prefs[s.key]}
              onCheckedChange={(checked) => update({ ...prefs, [s.key]: checked })}
            />
          </Field>
        ))}
      </FieldGroup>

      <Button
        variant="ghost"
        size="sm"
        className="self-start"
        disabled={isDefaultA11yPrefs(prefs)}
        onClick={() => update(DEFAULT_A11Y_PREFS)}
      >
        <RotateCcw data-icon="inline-start" />
        Reset To Defaults
      </Button>
    </>
  );
}
