import { useEffect, useState } from "react"
import { Plus } from "lucide-react"
import { ActionButton, SectionShell } from "@/components/dashboard-ui"
import Modal from "@/components/Modal"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { getTypeOptions } from "@/data/inventoryCatalog"
import { createUser, deleteUser, loadUsers, resetUserPassword, updateUser } from "@/lib/backend"

const emptyUserForm = { fullName: "", username: "", password: "", role: "user", allowedTypes: [] }

function UserManagementSection({ currentUser, catalog }) {
  const [users, setUsers] = useState([])
  const [form, setForm] = useState(emptyUserForm)
  const [resetPasswords, setResetPasswords] = useState({})
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [addUserOpen, setAddUserOpen] = useState(false)
  const typeOptions = getTypeOptions(catalog)

  async function refreshUsers() {
    setLoading(true)
    try {
      setUsers(await loadUsers())
    } catch (err) {
      setError(err?.payload?.error || "Failed to load users.")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refreshUsers()
  }, [])

  function clearAlerts() {
    setMessage("")
    setError("")
  }

  async function submitUser(event) {
    event.preventDefault()
    clearAlerts()
    if (form.role === "user" && form.allowedTypes.length === 0) {
      setError("Select at least one allowed asset type.")
      return
    }
    setAdding(true)
    try {
      await createUser(form)
      setForm(emptyUserForm)
      setMessage("User added successfully.")
      setAddUserOpen(false)
      await refreshUsers()
    } catch (err) {
      setError(err?.payload?.error || "Failed to add user.")
    } finally {
      setAdding(false)
    }
  }

  async function changeRole(user, role) {
    clearAlerts()
    try {
      await updateUser(user.username, {
        role,
        allowedTypes: role === "admin" ? [] : user.allowedTypes?.length ? user.allowedTypes : [typeOptions[0]?.value].filter(Boolean),
      })
      setMessage("Role updated.")
      await refreshUsers()
    } catch (err) {
      setError(err?.payload?.error || "Failed to update role.")
    }
  }

  async function toggleActive(user) {
    clearAlerts()
    try {
      await updateUser(user.username, { active: !user.active })
      setMessage(user.active ? "User disabled." : "User enabled.")
      await refreshUsers()
    } catch (err) {
      setError(err?.payload?.error || "Failed to update user status.")
    }
  }

  async function resetPassword(user) {
    clearAlerts()
    const password = resetPasswords[user.username] || ""
    if (password.length < 8) {
      setError("New password must be at least 8 characters.")
      return
    }
    try {
      await resetUserPassword(user.username, password)
      setResetPasswords((current) => ({ ...current, [user.username]: "" }))
      setMessage("Password reset successfully.")
    } catch (err) {
      setError(err?.payload?.error || "Failed to reset password.")
    }
  }

  async function removeUser(user) {
    clearAlerts()
    const confirmed = window.confirm(`Delete user ${user.username}? This cannot be undone.`)
    if (!confirmed) return
    try {
      await deleteUser(user.username)
      setMessage("User deleted.")
      await refreshUsers()
    } catch (err) {
      setError(err?.payload?.error || "Failed to delete user.")
    }
  }

  return (
    <SectionShell
      title="User Management"
      description="Admin-only user access, roles, password resets, and account status."
      action={
        <ActionButton
          onClick={() => {
            clearAlerts()
            setAddUserOpen(true)
          }}
          className="!bg-orange-600 hover:!bg-orange-700 !text-white"
        >
          <Plus className="size-4" />
          Add User
        </ActionButton>
      }
    >
      <div className="h-full min-h-0">
        <div className="min-h-0 overflow-auto rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">Users</h3>
            {message ? <div className="mt-1 text-xs text-emerald-700">{message}</div> : null}
            {error ? <div className="mt-1 text-xs text-rose-700">{error}</div> : null}
          </div>
          <table className="min-w-[820px] w-full divide-y divide-slate-100 text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Reset Password</th>
                <th className="px-4 py-3 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>Loading users...</td>
                </tr>
              ) : users.length ? users.map((user) => {
                const isSelf = user.username === currentUser?.username
                return (
                  <tr key={user.username} className="align-top">
                    <td className="px-4 py-4">
                      <div className="font-semibold text-slate-900">{user.fullName || "-"}</div>
                      <div className="text-xs text-slate-500">{user.username}</div>
                    </td>
                    <td className="px-4 py-4">
                      <select
                        value={user.role}
                        onChange={(event) => changeRole(user, event.target.value)}
                        className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none"
                        disabled={isSelf}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${user.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {user.active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2">
                        <input
                          type="password"
                          value={resetPasswords[user.username] || ""}
                          onChange={(event) => setResetPasswords((current) => ({ ...current, [user.username]: event.target.value }))}
                          className="h-9 w-40 rounded-xl border border-slate-200 px-3 text-sm outline-none"
                          placeholder="New password"
                        />
                        <button
                          type="button"
                          onClick={() => resetPassword(user)}
                          className="rounded-xl bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800"
                        >
                          Reset
                        </button>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => toggleActive(user)}
                          disabled={isSelf}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {user.active ? "Disable" : "Enable"}
                        </button>
                        <button
                          type="button"
                          onClick={() => removeUser(user)}
                          disabled={isSelf}
                          className="rounded-xl bg-rose-500 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              }) : (
                <tr>
                  <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>No users found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={addUserOpen}
        onClose={() => {
          setAddUserOpen(false)
          setForm(emptyUserForm)
        }}
        title="Add User"
        description="Create a new login and assign an access role."
        widthClass="max-w-2xl"
      >
        <form onSubmit={submitUser} className="space-y-4">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Full Name</span>
            <input
              value={form.fullName}
              onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-orange-400"
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Email / Username</span>
            <input
              type="email"
              value={form.username}
              onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-orange-400"
              required
            />
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Password</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              className="h-11 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-orange-400"
              minLength={8}
              required
            />
            <span className="text-xs text-slate-500">Use at least 8 characters.</span>
          </label>
          <label className="grid gap-2">
            <span className="text-sm font-medium text-slate-700">Role</span>
            <Select
              value={form.role}
              onValueChange={(value) => setForm((current) => ({ ...current, role: value, allowedTypes: value === "admin" ? [] : current.allowedTypes }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </label>
          {form.role === "user" ? (
            <div className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Allowed Inventory Type</span>
              <Select
                value={form.allowedTypes[0] || ""}
                onValueChange={(value) => setForm((current) => ({ ...current, allowedTypes: [value] }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select inventory type" />
                </SelectTrigger>
                <SelectContent>
                  {typeOptions.map((type) => (
                    <SelectItem key={type.value} value={type.value}>{type.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-slate-500">User can manage only the selected inventory type.</span>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
              Admin users can access all inventory types.
            </div>
          )}
          {error ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
          <div className="flex justify-end gap-3">
            <ActionButton
              type="button"
              className="bg-slate-200 text-slate-900 hover:bg-slate-300"
              onClick={() => {
                setAddUserOpen(false)
                setForm(emptyUserForm)
              }}
            >
              Cancel
            </ActionButton>
            <ActionButton type="submit" disabled={adding} className="bg-orange-600 text-white hover:bg-orange-700">
              {adding ? "Adding..." : "Add User"}
            </ActionButton>
          </div>
        </form>
      </Modal>
    </SectionShell>
  )
}

export default UserManagementSection
