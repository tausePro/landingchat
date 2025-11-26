"use client"

import { useState } from "react"
import { Textarea } from "@/components/ui/textarea"

interface RichTextEditorProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
    const [isBold, setIsBold] = useState(false)
    const [isItalic, setIsItalic] = useState(false)

    const handleFormat = (format: string) => {
        // For now, we'll keep it simple without actual formatting
        // In a production app, you'd want to use a library like Tiptap or Quill
        console.log(`Format: ${format}`)
    }

    return (
        <div className="rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark">
            <div className="flex items-center gap-2 border-b border-border-light dark:border-border-dark p-2 text-muted-foreground">
                <button
                    type="button"
                    onClick={() => handleFormat('bold')}
                    className={`p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${isBold ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
                >
                    <span className="material-symbols-outlined text-xl">format_bold</span>
                </button>
                <button
                    type="button"
                    onClick={() => handleFormat('italic')}
                    className={`p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 ${isItalic ? 'bg-gray-200 dark:bg-gray-700' : ''}`}
                >
                    <span className="material-symbols-outlined text-xl">format_italic</span>
                </button>
                <button
                    type="button"
                    onClick={() => handleFormat('underline')}
                    className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                    <span className="material-symbols-outlined text-xl">format_underlined</span>
                </button>
                <button
                    type="button"
                    onClick={() => handleFormat('bullet')}
                    className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                    <span className="material-symbols-outlined text-xl">format_list_bulleted</span>
                </button>
                <button
                    type="button"
                    onClick={() => handleFormat('number')}
                    className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                    <span className="material-symbols-outlined text-xl">format_list_numbered</span>
                </button>
            </div>
            <Textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                className="w-full rounded-none rounded-b-lg bg-transparent border-transparent focus:ring-0 min-h-32 resize-none"
            />
        </div>
    )
}
