"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { RefreshCw } from "lucide-react"

interface CheckStatusButtonProps {
    orderId: string
    slug: string
}

export function CheckStatusButton({ orderId, slug }: CheckStatusButtonProps) {
    const router = useRouter()
    const [isChecking, setIsChecking] = useState(false)

    const handleCheck = async () => {
        setIsChecking(true)
        // Force a refresh of the page to get latest order status
        router.refresh()
        setTimeout(() => setIsChecking(false), 1000)
    }

    return (
        <button
            onClick={handleCheck}
            disabled={isChecking}
            className="px-6 py-3 rounded-lg bg-primary-light dark:bg-primary-dark text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
            <RefreshCw className={`size-5 ${isChecking ? 'animate-spin' : ''}`} />
            {isChecking ? 'Verificando...' : 'Verificar Estado'}
        </button>
    )
}
