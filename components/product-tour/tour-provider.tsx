"use client"

import * as React from "react"
import { usePathname, useSearchParams } from "next/navigation"
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

function TourProviderInner({ children }: { children: React.ReactNode }) {
  const { loading, seenScenes, fetchFailed, markSceneSeen } = useProductTour()
  const pathname = usePathname() ?? ""
  // useSearchParams() is reactive to query-string-only changes (unlike
  // usePathname()), which matters here: BrandSelector appends ?brandId= to
  // the SAME path once it resolves, with no pathname change at all — reading
  // it once via window.location would miss that update entirely.
  const searchParams = useSearchParams()
  const hasBrandId = !!searchParams?.get("brandId")
  const [settled, setSettled] = React.useState(false)
  const [stepIndex, setStepIndex] = React.useState(0)
  const activeSceneKeyRef = React.useRef<string | null>(null)
  // Once the user has actually clicked something, their progress is real and
  // must never be overwritten by a route change. Before that, though, the
  // route is still fair game to auto-correct against — see the effect below.
  const hasInteractedRef = React.useRef(false)

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
        (scene) =>
          !seenScenes.has(scene.key) && scene.steps.some((s) => s.matchesRoute(pathname, hasBrandId))
      ) ?? null
    )
  }, [loading, fetchFailed, settled, seenScenes, pathname, hasBrandId])

  // Keep stepIndex synced to whichever of the scene's steps matches the
  // current route, for as long as the user hasn't touched the tour yet.
  //
  // This covers more than just "the scene changed" (e.g. onboarding moving
  // from its wizard steps to its shell steps): the app's own auth/redirect
  // logic can keep moving the route out from under us for a while after our
  // route-settle debounce already fired. A brand-new account, for instance,
  // redirects /dashboard -> /dashboard/manage-influencers -> (once
  // BrandSelector's own async brand-list fetch resolves and finds nothing)
  // -> /dashboard/brand/create. If that fetch takes longer than our settle
  // window, we'd lock onto "manage-influencers" first, which matches a
  // sidebar step (nav-influencers) and skips the wizard's 3 steps entirely
  // once locked in. Re-deriving stepIndex on every route change — forward or
  // backward through the steps array — until the user actually clicks
  // something means a later redirect can still correct us onto the wizard.
  React.useEffect(() => {
    const key = activeScene?.key ?? null
    if (key !== activeSceneKeyRef.current) {
      activeSceneKeyRef.current = key
      hasInteractedRef.current = false
    }
    if (!activeScene || hasInteractedRef.current) return
    const idx = activeScene.steps.findIndex((s) => s.matchesRoute(pathname, hasBrandId))
    if (idx !== -1) setStepIndex(idx)
  }, [activeScene, pathname, hasBrandId])

  const finishScene = React.useCallback(() => {
    hasInteractedRef.current = true
    if (activeSceneKeyRef.current) markSceneSeen(activeSceneKeyRef.current)
  }, [markSceneSeen])

  const next = React.useCallback(() => {
    hasInteractedRef.current = true
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
    hasInteractedRef.current = true
    setStepIndex((i) => Math.max(0, i - 1))
  }, [])

  const currentStep = activeScene?.steps[stepIndex] ?? null
  const visibleStep = currentStep && currentStep.matchesRoute(pathname, hasBrandId) ? currentStep : null
  const previousStep = activeScene && stepIndex > 0 ? activeScene.steps[stepIndex - 1] : null
  const canGoBack = !!visibleStep && !!previousStep && previousStep.matchesRoute(pathname, hasBrandId)

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

export function TourProvider({ children }: { children: React.ReactNode }) {
  return (
    <React.Suspense fallback={children}>
      <TourProviderInner>{children}</TourProviderInner>
    </React.Suspense>
  )
}
