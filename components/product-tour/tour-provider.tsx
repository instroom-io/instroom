"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { useProductTour } from "@/hooks/useProductTour"
import { SCENES, type TourStep } from "@/components/product-tour/steps"
import { TourOverlay } from "@/components/product-tour/tour-overlay"

const START_DELAY_MS = 300

type TourContextProps = {
  step: TourStep | null
  sceneIndex: number
  sceneTotal: number
  isLastStep: boolean
  canGoBack: boolean
  next: () => void
  prev: () => void
  skip: () => void
}

const TourContext = React.createContext<TourContextProps | null>(null)

export function useTour() {
  const context = React.useContext(TourContext)
  if (!context) {
    throw new Error("useTour must be used within a TourProvider.")
  }
  return context
}

export function TourProvider({ children }: { children: React.ReactNode }) {
  const { loading, seenScenes, fetchFailed, markSceneSeen } = useProductTour()
  const pathname = usePathname() ?? ""
  const [settled, setSettled] = React.useState(false)
  const [stepIndex, setStepIndex] = React.useState(0)
  const activeSceneKeyRef = React.useRef<string | null>(null)

  // A fresh session gets bounced through a few routes before it settles —
  // session load, then /dashboard/manage-influencers, then often
  // /dashboard/brand/create once the (async) brand list resolves and finds
  // none. Restarting this timer on every pathname change means the tour
  // only ever locks onto the route the user actually settles on, however
  // long that chain takes — it only needs to happen once, ever, since every
  // later scene (visited whenever the user gets to that page) starts from
  // an already-settled route.
  React.useEffect(() => {
    if (settled) return
    const timer = setTimeout(() => setSettled(true), START_DELAY_MS)
    return () => clearTimeout(timer)
  }, [pathname, settled])

  // Which scene applies right now: the first one (in priority order) that
  // hasn't been seen/skipped yet and has at least one step reachable from
  // the current route. Scenes for other pages simply stay quiet until the
  // user navigates there — there's no forced hand-off between them.
  const activeScene = React.useMemo(() => {
    if (loading || fetchFailed || !settled) return null
    return (
      SCENES.find(
        (scene) => !seenScenes.has(scene.key) && scene.steps.some((s) => s.matchesRoute(pathname))
      ) ?? null
    )
  }, [loading, fetchFailed, settled, seenScenes, pathname])

  // Reset stepIndex whenever the active scene changes — e.g. onboarding
  // moving from its wizard steps to its shell steps, or one page's scene
  // finishing and another page's scene taking over.
  React.useEffect(() => {
    const key = activeScene?.key ?? null
    if (key === activeSceneKeyRef.current) return
    activeSceneKeyRef.current = key
    if (!activeScene) return
    const idx = activeScene.steps.findIndex((s) => s.matchesRoute(pathname))
    setStepIndex(idx === -1 ? 0 : idx)
  }, [activeScene, pathname])

  const finishScene = React.useCallback(() => {
    if (activeSceneKeyRef.current) markSceneSeen(activeSceneKeyRef.current)
  }, [markSceneSeen])

  const next = React.useCallback(() => {
    const scene = activeScene
    if (!scene) return
    setStepIndex((i) => {
      if (i + 1 >= scene.steps.length) {
        finishScene()
        return i
      }
      return i + 1
    })
  }, [activeScene, finishScene])

  const prev = React.useCallback(() => {
    setStepIndex((i) => Math.max(0, i - 1))
  }, [])

  const currentStep = activeScene?.steps[stepIndex] ?? null
  const visibleStep = currentStep && currentStep.matchesRoute(pathname) ? currentStep : null
  const previousStep = activeScene && stepIndex > 0 ? activeScene.steps[stepIndex - 1] : null
  const canGoBack = !!visibleStep && !!previousStep && previousStep.matchesRoute(pathname)

  const value = React.useMemo<TourContextProps>(
    () => ({
      step: visibleStep,
      sceneIndex: stepIndex,
      sceneTotal: activeScene?.steps.length ?? 0,
      isLastStep: !!activeScene && stepIndex === activeScene.steps.length - 1,
      canGoBack,
      next,
      prev,
      skip: finishScene,
    }),
    [visibleStep, stepIndex, activeScene, canGoBack, next, prev, finishScene]
  )

  return (
    <TourContext.Provider value={value}>
      {children}
      <TourOverlay />
    </TourContext.Provider>
  )
}
