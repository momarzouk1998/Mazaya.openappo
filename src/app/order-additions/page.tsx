"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

export default function OrderAdditionsPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace("/internal-transport")
  }, [router])
  return null
}
