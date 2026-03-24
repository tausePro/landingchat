"use client"

import { useState, useEffect } from "react"

function getGreeting(): string {
    const hour = new Date().getHours()
    if (hour < 12) return "Buenos días"
    if (hour < 18) return "Buenas tardes"
    return "Buenas noches"
}

export function Greeting({ userName }: { userName: string }) {
    const [greeting, setGreeting] = useState("Hola")

    useEffect(() => {
        setGreeting(getGreeting())
    }, [])

    return (
        <>
            {greeting}, {userName} ✦
        </>
    )
}
