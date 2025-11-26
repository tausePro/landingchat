"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"

export function ModeToggle() {
    const { theme, setTheme } = useTheme()

    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="text-text-light-secondary dark:text-text-dark-secondary hover:text-primary dark:hover:text-primary"
        >
            <span className="material-symbols-outlined text-2xl rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0">
                light_mode
            </span>
            <span className="absolute material-symbols-outlined text-2xl rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100">
                dark_mode
            </span>
            <span className="sr-only">Toggle theme</span>
        </Button>
    )
}
