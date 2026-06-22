"use client"

import { useEffect, useState, useRef, useCallback, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { AlertCircle, Trash2, Mail, Zap } from "lucide-react"
import Script from "next/script"
import Link from "next/link"
import { useSession } from "next-auth/react"

interface Collaborator {
  id: string
  email: string
  name: string | null
  image: string | null
  role: string
  joinedAt?: string
}

interface BuySeatsModalState {
  isOpen: boolean
  maxSeatsAvailable: number
  pricePerSeat: number
  currentExtraSeats: number
  maxTotalSeats: number
}

declare global {
  interface Window {
    paypal?: any
  }
}

function CollaboratorsContent() {
  const searchParams = useSearchParams()
  const [brandId, setBrandId] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  const [owner, setOwner] = useState<Collaborator | null>(null)
  const [members, setMembers] = useState<Collaborator[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")
  const [inviteEmail, setInviteEmail] = useState("")
  const [inviteRole, setInviteRole] = useState("manager")
  const [inviting, setInviting] = useState(false)
  const [removing, setRemoving] = useState<string | null>(null)

  const [buySeatsModal, setBuySeatsModal] = useState<BuySeatsModalState>({
    isOpen: false,
    maxSeatsAvailable: 0,
    pricePerSeat: 0,
    currentExtraSeats: 0,
    maxTotalSeats: 0,
  })
  const [seatsToAdd, setSeatsToAdd] = useState(1)
  const [buyingSeats, setBuyingSeats] = useState(false)
  const [paypalLoaded, setPaypalLoaded] = useState(false)
  const paypalRef = useRef<HTMLDivElement>(null)

  const { data: session } = useSession()

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const id = searchParams.get("brandId")
    setBrandId(id)
  }, [searchParams])

  useEffect(() => {
    if (!buySeatsModal.isOpen || !paypalLoaded || !paypalRef.current) return
    if (paypalRef.current.innerHTML !== "") return

    if (window.paypal) {
      const button = window.paypal.Buttons({
        style: { shape: "pill", color: "blue", layout: "vertical", label: "pay" },
        createOrder: async (data: any, actions: any) => {
          try {
            const totalAmount = (buySeatsModal.pricePerSeat * seatsToAdd).toFixed(2)
            const response = await fetch("/api/paypal/create-order", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                amount: totalAmount,
                description: `${seatsToAdd} extra seat(s) for collaborators`,
              }),
            })
            if (!response.ok) {
              const errorData = await response.json()
              throw new Error(errorData.error || "Failed to create payment order")
            }
            const orderData = await response.json()
            if (!orderData.id) throw new Error("No order ID returned from server")
            return orderData.id
          } catch (error) {
            setError(error instanceof Error ? error.message : "Failed to create payment order")
            throw error
          }
        },
        onApprove: async (data: any, actions: any) => {
          try {
            setBuyingSeats(true)
            const response = await fetch("/api/subscription/buy-extra-seats", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ quantity: seatsToAdd, paypalOrderId: data.orderID }),
            })
            const result = await response.json()
            if (!response.ok) {
              const errorMsg = result.details ? `${result.error}: ${result.details}` : result.error
              setError(errorMsg || "Failed to complete purchase")
              setBuyingSeats(false)
              return
            }
            setBuySeatsModal({ ...buySeatsModal, isOpen: false })
            setSeatsToAdd(1)
            setError("")
            if (inviteEmail) {
              const form = new Event("submit")
              handleInvite(form as any)
            }
          } catch (err) {
            setError(err instanceof Error ? err.message : "An error occurred")
            setBuyingSeats(false)
          }
        },
        onError: (err: any) => {
          setError("Payment failed. Please try again.")
          setBuyingSeats(false)
        },
      })
      button.render(paypalRef.current)
    }
  }, [buySeatsModal.isOpen, buySeatsModal.pricePerSeat, paypalLoaded])

  useEffect(() => {
    const fetchCollaborators = async () => {
      if (!brandId) return
      try {
        setLoading(true)
        setError("")
        const res = await fetch(`/api/brand/${brandId}/collaborators`)
        const data = await res.json()
        if (!res.ok) {
          if (res.status === 403) setError("You don't have permission to manage collaborators for this brand.")
          else if (res.status === 404) setError("Brand not found.")
          else setError(data.error || "Failed to fetch collaborators")
          return
        }
        setOwner(data.owner)
        setMembers(data.members || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred while fetching collaborators")
      } finally {
        setLoading(false)
      }
    }
    fetchCollaborators()
  }, [brandId])

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!inviteEmail.trim() || !brandId) return
    try {
      setInviting(true)
      setError("")
      const limitCheckRes = await fetch(`/api/brand/${brandId}/collaborators/check-limit`)
      const limitData = await limitCheckRes.json()
      if (!limitCheckRes.ok) {
        setError(limitData.error || "Failed to check collaborator limit")
        return
      }
      if (limitData.canBuyMore) {
        setBuySeatsModal({
          isOpen: true,
          maxSeatsAvailable: limitData.maxSeatsAvailable,
          pricePerSeat: limitData.pricePerSeat,
          currentExtraSeats: limitData.currentExtraSeats,
          maxTotalSeats: limitData.maxTotalSeats,
        })
        setInviting(false)
        return
      }
      if (!limitData.allowed) {
        setError("You've reached your collaborator limit. Upgrade your plan to add more collaborators.")
        setInviting(false)
        return
      }
      const res = await fetch(`/api/brand/${brandId}/collaborators/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to invite collaborator")
        return
      }
      const refetch = await fetch(`/api/brand/${brandId}/collaborators`)
      const refreshed = await refetch.json()
      setMembers(refreshed.members || [])
      setInviteEmail("")
      setInviteRole("manager")
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setInviting(false)
    }
  }

  const handleRemove = async (userId: string) => {
    if (!brandId || !confirm("Remove this collaborator?")) return
    try {
      setRemoving(userId)
      setError("")
      const res = await fetch(`/api/brand/${brandId}/collaborators/${userId}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Failed to remove collaborator")
        return
      }
      setMembers(members.filter((m) => m.id !== userId))
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setRemoving(null)
    }
  }

  if (!mounted) return null

  if (!brandId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="w-full max-w-md">
          <CardHeader><CardTitle>No Brand Selected</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Please select a brand to manage collaborators.</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div style={{ padding: "28px 36px", maxWidth: 1040 }}>
      <div style={{ fontSize: 18, fontWeight: 600, color: "#1E1E1E", marginBottom: 4 }}>
        Team &amp; Collaborators
      </div>
      <div style={{ fontSize: 12, color: "#888", marginBottom: 24 }}>
        Manage who has access to your brand
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-xl bg-red-50 p-4 text-sm text-red-700 border border-red-200">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span className="font-medium">{error}</span>
        </div>
      )}

      {/* 3-column grid: left narrow for owner+invite, right wide for members */}
      <div style={{ display: "grid", gridTemplateColumns: "420px 1fr", gap: 20, alignItems: "start" }}>

        {/* Left Column */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Owner */}
          {owner && (
            <div style={sectionCard}>
              <div style={sectionHeader}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1E1E1E" }}>Brand owner</div>
              </div>
              <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={owner.image || ""} alt={owner.name || ""} />
                    <AvatarFallback style={{ background: "#1FAE5B", color: "#fff", fontWeight: 600 }}>
                      {(owner.name || owner.email).charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "#1E1E1E" }}>
                      {owner.name || owner.email}
                    </div>
                    <div style={{ fontSize: 11, color: "#888" }}>{owner.email}</div>
                  </div>
                </div>
                <span style={roleBadge}>Admin</span>
              </div>
            </div>
          )}

          {/* Invite Form */}
          <div style={sectionCard}>
            <div style={{ ...sectionHeader, display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={iconBox}><Mail className="h-4 w-4 text-[#1FAE5B]" /></div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1E1E1E" }}>Invite team member</div>
                <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>Send an invite by email</div>
              </div>
            </div>
            <form onSubmit={handleInvite} style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={fLabel}>Email address</label>
                <Input
                  type="email"
                  placeholder="collaborator@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  style={{ fontSize: 12, padding: "9px 12px", borderRadius: 8, border: "0.5px solid rgba(0,0,0,0.15)", marginTop: 4 }}
                  required
                />
              </div>
              <div>
                <label style={fLabel}>Role</label>
                <div style={{ marginTop: 4 }}>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger style={{ fontSize: 12, borderRadius: 8, border: "0.5px solid rgba(0,0,0,0.15)" }}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manager">Manager</SelectItem>
                      <SelectItem value="researcher">Researcher</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: 10, borderTop: "0.5px solid rgba(0,0,0,0.06)" }}>
                <button
                  type="submit"
                  disabled={inviting || !inviteEmail.trim()}
                  style={{
                    fontSize: 12, fontWeight: 500, padding: "8px 18px",
                    borderRadius: 9, background: "#1FAE5B", color: "#fff",
                    border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                    opacity: inviting || !inviteEmail.trim() ? 0.6 : 1,
                  }}
                >
                  <Mail className="h-3.5 w-3.5" />
                  {inviting ? "Sending..." : "Send invite"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column — Members list, stretches full height */}
        <div style={{ ...sectionCard, height: "100%" }}>
          <div style={sectionHeader}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#1E1E1E" }}>
              Team members ({members.length})
            </div>
          </div>

          <div style={{ padding: "20px" }}>
            {loading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 0" }}>
                <div style={{ fontSize: 12, color: "#888" }}>Loading team members...</div>
              </div>
            ) : members.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 0", textAlign: "center" }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#f0faf5", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
                  <Mail className="h-5 w-5 text-[#1FAE5B]" />
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#1E1E1E", marginBottom: 4 }}>No team members yet</div>
                <div style={{ fontSize: 11, color: "#888" }}>Invite collaborators on the left to get started</div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {members.map((member) => (
                  <div
                    key={member.id}
                    style={{
                      border: "0.5px solid rgba(0,0,0,0.07)",
                      borderRadius: 9,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "12px 14px",
                    }}
                    className="hover:bg-gray-50/60 transition-colors group"
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                      <Avatar className="h-9 w-9 flex-shrink-0">
                        <AvatarImage src={member.image || ""} alt={member.name || ""} />
                        <AvatarFallback style={{ background: "#f0faf5", color: "#0F6B3E", fontWeight: 600 }}>
                          {(member.name || member.email).charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#1E1E1E" }} className="truncate">
                          {member.name || member.email}
                        </div>
                        <div style={{ fontSize: 11, color: "#888" }} className="truncate">
                          {member.email}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                      <span style={{ ...roleBadge, textTransform: "capitalize" }}>{member.role}</span>
                      <button
                        onClick={() => handleRemove(member.id)}
                        disabled={removing === member.id}
                        style={{ color: "#E24B4A", padding: "6px", borderRadius: 6, border: "none", background: "transparent", cursor: "pointer" }}
                        className="opacity-0 group-hover:opacity-100 hover:bg-red-50 transition-all"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Buy Extra Seats Modal — unchanged */}
      {buySeatsModal.isOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div style={{ background: "#fff", border: "0.5px solid rgba(0,0,0,0.08)", borderRadius: 12, maxWidth: 420, width: "100%", overflow: "hidden" }}>
            <div style={{ ...sectionHeader, display: "flex", alignItems: "flex-start", gap: 12 }}>
              <div style={iconBox}><Zap className="h-4 w-4 text-[#1FAE5B]" /></div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1E1E1E" }}>Upgrade your seats</div>
                <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>Purchase additional seats to invite more team members</div>
              </div>
            </div>
            <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 20 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ border: "0.5px solid rgba(0,0,0,0.08)", borderRadius: 9, padding: "12px 14px" }}>
                  <div style={{ fontSize: 10, color: "#888", marginBottom: 4 }}>Seats purchased</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#1E1E1E" }}>{buySeatsModal.currentExtraSeats}</div>
                </div>
                <div style={{ border: "0.5px solid rgba(0,0,0,0.08)", borderRadius: 9, padding: "12px 14px" }}>
                  <div style={{ fontSize: 10, color: "#888", marginBottom: 4 }}>Max available</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: "#1E1E1E" }}>{buySeatsModal.maxTotalSeats}</div>
                </div>
              </div>
              <div>
                <label style={fLabel}>Number of seats</label>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
                  <button onClick={() => setSeatsToAdd(Math.max(1, seatsToAdd - 1))} disabled={seatsToAdd <= 1 || buyingSeats} style={{ border: "0.5px solid rgba(0,0,0,0.15)", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", cursor: "pointer" }}>−</button>
                  <input type="number" min="1" max={buySeatsModal.maxSeatsAvailable} value={seatsToAdd} onChange={(e) => setSeatsToAdd(Math.min(buySeatsModal.maxSeatsAvailable, Math.max(1, parseInt(e.target.value) || 1)))} style={{ fontSize: 12, padding: "8px 12px", borderRadius: 8, border: "0.5px solid rgba(0,0,0,0.15)", textAlign: "center", width: 64 }} disabled={buyingSeats} />
                  <button onClick={() => setSeatsToAdd(Math.min(buySeatsModal.maxSeatsAvailable, seatsToAdd + 1))} disabled={seatsToAdd + 1 > buySeatsModal.maxSeatsAvailable || buyingSeats} style={{ border: "0.5px solid rgba(0,0,0,0.15)", borderRadius: 8, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", background: "#fff", cursor: "pointer" }}>+</button>
                </div>
                <div style={{ fontSize: 10, color: "#888", marginTop: 6 }}>Up to {buySeatsModal.maxSeatsAvailable} more seat(s) available</div>
              </div>
              <div style={{ borderTop: "0.5px solid rgba(0,0,0,0.07)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#555" }}>
                  <span>Price per seat</span>
                  <span style={{ fontWeight: 600, color: "#1E1E1E" }}>${buySeatsModal.pricePerSeat.toFixed(2)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#555" }}>
                  <span>Quantity</span>
                  <span style={{ fontWeight: 600, color: "#1E1E1E" }}>{seatsToAdd} {seatsToAdd === 1 ? "seat" : "seats"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "0.5px solid rgba(0,0,0,0.06)", paddingTop: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#1E1E1E" }}>Total</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: "#1FAE5B" }}>${(buySeatsModal.pricePerSeat * seatsToAdd).toFixed(2)}</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Script src={`https://www.paypal.com/sdk/js?client-id=${process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID}&intent=capture`} strategy="afterInteractive" onLoad={() => setPaypalLoaded(true)} />
                <div ref={paypalRef} />
                <button onClick={() => { setBuySeatsModal({ ...buySeatsModal, isOpen: false }); if (paypalRef.current) paypalRef.current.innerHTML = "" }} disabled={buyingSeats} style={{ fontSize: 12, fontWeight: 500, padding: "8px 0", borderRadius: 9, border: "0.5px solid rgba(0,0,0,0.15)", background: "#fff", color: "#555", width: "100%", cursor: "pointer" }}>
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function CollaboratorsPage() {
  return (
    <Suspense>
      <CollaboratorsContent />
    </Suspense>
  )
}

// ── Shared styles ──────────────────────────────────────────────
const sectionCard: React.CSSProperties = {
  background: "#fff",
  border: "0.5px solid rgba(0,0,0,0.08)",
  borderRadius: 12,
  overflow: "hidden",
}
const sectionHeader: React.CSSProperties = {
  padding: "16px 20px",
  borderBottom: "0.5px solid rgba(0,0,0,0.07)",
}
const iconBox: React.CSSProperties = {
  width: 36,
  height: 36,
  borderRadius: 9,
  background: "#f0faf5",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
}
const roleBadge: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  color: "#0F6B3E",
  background: "#f0faf5",
  padding: "4px 10px",
  borderRadius: 999,
  whiteSpace: "nowrap",
}
const fLabel: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "#555",
  letterSpacing: "0.02em",
}