"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function FinancesHubPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/overhead")
  }, [router])
  return null
}
