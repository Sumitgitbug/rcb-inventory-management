import { useEffect, useState } from "react"
import { Lock, Mail, UserRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { getAuthStatus, loadCurrentUser, login, logout, setupAdmin } from "@/lib/backend"

function AuthGate({ children }) {
  const [loading, setLoading] = useState(true)
  const [setupRequired, setSetupRequired] = useState(false)
  const [user, setUser] = useState(null)
  const [form, setForm] = useState({ username: "", password: "", fullName: "" })
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function hydrateAuth() {
      try {
        const [status, currentUser] = await Promise.all([
          getAuthStatus(),
          loadCurrentUser(),
        ])
        if (cancelled) return
        setSetupRequired(Boolean(status?.setupRequired))
        setUser(currentUser)
      } catch (err) {
        if (!cancelled) {
          setSetupRequired(true)
          setError(err?.payload?.error || "Authentication service is not available.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    hydrateAuth()
    return () => { cancelled = true }
  }, [])

  async function handleSubmit(event) {
    event.preventDefault()
    setError("")
    setSubmitting(true)
    try {
      const nextUser = setupRequired
        ? await setupAdmin(form)
        : await login({ username: form.username, password: form.password })
      setUser(nextUser)
      setSetupRequired(false)
      setForm({ username: "", password: "", fullName: "" })
    } catch (err) {
      setError(err?.payload?.error || "Authentication failed.")
    } finally {
      setSubmitting(false)
    }
  }

  function handleLogout() {
    logout()
    setUser(null)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm font-medium text-slate-600">
        Loading secure inventory...
      </div>
    )
  }

  if (user) {
    return children({ user, onLogout: handleLogout })
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <div className="h-14 border-b border-slate-200 bg-white shadow-sm" />
      <main className="flex min-h-[calc(100vh-3.5rem)] items-start justify-center px-4 py-1">
        <Card className="w-full max-w-[560px] gap-0 overflow-hidden rounded-[18px] border-slate-200 bg-white py-0 shadow-xl shadow-slate-950/10">
          <CardHeader className="space-y-0 px-6 pb-4 pt-6 sm:px-12">
            <div className="mb-7 rounded-[6px] bg-gradient-to-r from-indigo-500 via-violet-500 to-pink-600 p-[3px]">
              <div className="rounded-[4px] bg-white px-3 py-2">
                <img
                  src="/rcb_logo.svg"
                  alt="UNESCO and Regional Centre for Biotechnology"
                  className="mx-auto h-auto max-h-[145px] w-full object-contain"
                />
              </div>
            </div>
            <div className="mb-6 text-center">
              <h1 className="text-[30px] font-bold tracking-tight text-zinc-900">Inventory Management</h1>
              <p className="mt-2 text-[15px] leading-6 text-slate-500">
                Secure access for managing organizational assets and stock records.
              </p>
            </div>
            <CardTitle className="text-[24px] font-bold tracking-tight text-zinc-800">
              {setupRequired ? "Create Admin Account" : "Welcome Back"}
            </CardTitle>
            <CardDescription className="mt-1.5 text-[15px] text-slate-500">
              {setupRequired
                ? "Create the first admin account for inventory access"
                : "Login with your registered email address"}
            </CardDescription>
          </CardHeader>

          <div className="border-t border-slate-100" />

          <CardContent className="px-6 pb-5 pt-5 sm:px-12">
            <form onSubmit={handleSubmit} className="space-y-4">
              {setupRequired ? (
                <div className="grid gap-2">
                  <Label htmlFor="fullName" className="text-[15px] font-medium text-zinc-800">
                    Full Name
                  </Label>
                  <div className="relative">
                    <UserRound className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
                    <Input
                      id="fullName"
                      value={form.fullName}
                      onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
                      className="h-[52px] rounded-[12px] border-slate-200 bg-white pl-12 text-[15px] shadow-none focus-visible:border-blue-500 focus-visible:ring-blue-500/20"
                      autoComplete="name"
                      placeholder="Your name"
                    />
                  </div>
                </div>
              ) : null}

              <div className="grid gap-2">
                <Label htmlFor="email" className="text-[15px] font-medium text-zinc-800">
                  Email Address
                </Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="email"
                    type="email"
                    value={form.username}
                    onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                    className="h-[52px] rounded-[12px] border-blue-500 bg-white pl-12 text-[15px] shadow-none placeholder:text-zinc-400 focus-visible:border-blue-500 focus-visible:ring-blue-500/20"
                    autoComplete="username"
                    placeholder="you@example.com"
                    required
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="password" className="text-[15px] font-medium text-zinc-800">
                    Password
                  </Label>
                  <button
                    type="button"
                    className="text-[14px] font-semibold text-blue-600 hover:text-blue-700"
                    onClick={() => setError("Please contact the inventory administrator to reset your password.")}
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="password"
                    type="password"
                    value={form.password}
                    onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                    className="h-[52px] rounded-[12px] border-slate-200 bg-white pl-12 text-[15px] shadow-none placeholder:text-zinc-400 focus-visible:border-blue-500 focus-visible:ring-blue-500/20"
                    autoComplete={setupRequired ? "new-password" : "current-password"}
                    minLength={setupRequired ? 8 : undefined}
                    placeholder="........"
                    required
                  />
                </div>
                {setupRequired ? <span className="text-xs text-slate-500">Use at least 8 characters.</span> : null}
              </div>

              {error ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                  {error}
                </div>
              ) : null}

              <Button
                type="submit"
                disabled={submitting}
                className="h-[50px] w-full rounded-[12px] bg-blue-600 text-[15px] font-semibold text-white shadow-lg shadow-blue-500/25 hover:bg-blue-700"
              >
                {submitting ? "Please wait..." : setupRequired ? "Create Admin" : "Login"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}

export default AuthGate
