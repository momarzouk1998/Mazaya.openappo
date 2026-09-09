"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function InventoryHubPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/boards")
  }, [router])
  return null
}
