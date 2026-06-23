import { useEffect, useState } from "react"
import AuthGate from "@/components/AuthGate"
import InventoryDashboard from "@/components/InventoryDashboard"
import INoteDetailPage from "@/components/inote/INoteDetailPage"

function getINoteFromLocation() {
  const params = new URLSearchParams(window.location.search)
  return String(params.get("inote") || params.get("i_note") || "").trim()
}

function App() {
  const [selectedINote, setSelectedINote] = useState(getINoteFromLocation())

  useEffect(() => {
    const syncLocation = () => setSelectedINote(getINoteFromLocation())
    window.addEventListener("popstate", syncLocation)
    return () => window.removeEventListener("popstate", syncLocation)
  }, [])

  return (
    <AuthGate>
      {({ user, onLogout }) => selectedINote ? (
        <INoteDetailPage
          noteNo={selectedINote}
          onBack={() => {
            const nextUrl = new URL(window.location.href)
            nextUrl.searchParams.delete("inote")
            nextUrl.searchParams.delete("i_note")
            window.history.pushState({}, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`)
            setSelectedINote("")
          }}
        />
      ) : (
        <InventoryDashboard currentUser={user} onLogout={onLogout} />
      )}
    </AuthGate>
  )
}

export default App
