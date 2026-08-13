"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function WalletsHubPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/factory-wallet")
  }, [router])
  return null
}
