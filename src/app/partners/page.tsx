"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function PartnersHubPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/suppliers")
  }, [router])
  return null
}
