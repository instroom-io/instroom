"use client"

import * as React from "react"
import { Sparkles } from "lucide-react"
import { useTour } from "@/components/product-tour/tour-provider"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const SPOTLIGHT_PADDING = 6
const MAX_VISIBLE_DOTS = 8

export function TourOverlay() {
  const { step, sceneIndex, sceneTotal, isLastStep, canGoBack, next, prev, skip } = useTour()
  const [rect, setRect] = React.useState<DOMRect | null>(null)

  React.useEffect(() => {
    if (!step) {
      setRect(null)
      return
    }

    let hasFound = false
    const updateRect = () => {
      const el = document.querySelector(`[data-tour="${step.target}"]`)
      setRect(el ? el.getBoundingClientRect() : null)
      hasFound = !!el
    }

    updateRect()
    window.addEventListener("resize", updateRect)
    window.addEventListener("scroll", updateRect, true)

    // Several pages (Pipeline, Post Tracker, ...) gate their whole toolbar
    // behind a data fetch and show a loading skeleton until it resolves, so
    // the target can legitimately take a few seconds to exist — a short
    // fixed retry window was firing the "give up" fallback below while the
    // page was still loading, silently marking the scene seen before
    // anything ever rendered. A MutationObserver instead reacts the instant
    // the real DOM shows up, however long that takes; the 10s fallback only
    // fires for a target that genuinely never appears (e.g. a toolbar
    // hidden for a read-only user), so a step still can't get stuck forever.
    const observer = new MutationObserver(updateRect)
    observer.observe(document.body, { childList: true, subtree: true })

    const giveUp = setTimeout(() => {
      if (!hasFound) next()
    }, 10000)

    return () => {
      window.removeEventListener("resize", updateRect)
      window.removeEventListener("scroll", updateRect, true)
      observer.disconnect()
      clearTimeout(giveUp)
    }
  }, [step, next])

  if (!step || !rect) return null

  return (
    <>
      {/* Spotlight: a brand-green ring right at the target's edge, plus the
          dimming shadow spread over the rest of the viewport — both layered
          into one box-shadow so neither overrides the other. Box-shadow never
          participates in hit-testing, so the page underneath stays clickable. */}
      <div
        aria-hidden
        className="pointer-events-none fixed z-50 rounded-xl transition-all duration-200"
        style={{
          top: rect.top - SPOTLIGHT_PADDING,
          left: rect.left - SPOTLIGHT_PADDING,
          width: rect.width + SPOTLIGHT_PADDING * 2,
          height: rect.height + SPOTLIGHT_PADDING * 2,
          boxShadow: "0 0 0 2px #1FAE5B, 0 0 0 9999px rgba(15,23,42,0.55)",
        }}
      />

      <Popover open>
        <PopoverAnchor asChild>
          <div
            className="pointer-events-none fixed"
            style={{
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
            }}
          />
        </PopoverAnchor>
        <PopoverContent
          side={step.placement ?? "right"}
          sideOffset={SPOTLIGHT_PADDING + 10}
          collisionPadding={16}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={skip}
          className="z-50 w-80 overflow-hidden rounded-2xl border border-[#1FAE5B]/15 bg-white p-0 shadow-2xl"
        >
          <div className="h-1 bg-gradient-to-r from-transparent via-[#1FAE5B] to-transparent" />

          <div className="p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1FAE5B]/10">
                <Sparkles className="h-3.5 w-3.5 text-[#1FAE5B]" />
              </span>
              <h3 className="text-base font-semibold text-gray-900">{step.title}</h3>
            </div>

            <p className="mt-2.5 text-sm leading-relaxed text-gray-600">{step.body}</p>

            {/* Progress and actions sit on their own rows — the onboarding
                scene alone runs to 11 steps, and cramming that many dots
                onto the same row as Skip/Back/Next collided the two
                (dots visually touching "Skip" with no gap) once the row ran
                out of width in this w-80 popover. */}
            <div className="mt-5 flex flex-col gap-3">
              <div className="flex items-center gap-1.5">
                <span className="sr-only">
                  Step {sceneIndex + 1} of {sceneTotal}
                </span>
                {sceneTotal <= MAX_VISIBLE_DOTS ? (
                  Array.from({ length: sceneTotal }).map((_, i) => (
                    <span
                      key={i}
                      aria-hidden
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full transition-colors",
                        i === sceneIndex ? "bg-[#1FAE5B]" : "bg-gray-300"
                      )}
                    />
                  ))
                ) : (
                  // A long scene (onboarding) reads better as a counter than
                  // as a dozen tiny dots competing for the same thin row.
                  <span aria-hidden className="text-xs font-medium text-gray-400">
                    {sceneIndex + 1} of {sceneTotal}
                  </span>
                )}
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={skip}
                  className="text-xs font-medium text-gray-500 transition-colors hover:text-[#1FAE5B]"
                >
                  Skip
                </button>
                {canGoBack && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={prev}
                    className="h-8 rounded-full border-gray-300 px-3 text-xs font-semibold text-gray-600 hover:border-gray-400 hover:bg-gray-50"
                  >
                    Back
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={next}
                  className="h-8 rounded-full bg-[#1FAE5B] px-4 text-xs font-semibold text-white hover:bg-[#17a04e]"
                >
                  {isLastStep ? "Finish" : "Next"}
                </Button>
              </div>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </>
  )
}
