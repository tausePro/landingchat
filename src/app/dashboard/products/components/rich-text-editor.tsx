"use client"

import { useState, useRef, useCallback, useEffect } from "react"

interface RichTextEditorProps {
    value: string
    onChange: (value: string) => void
    placeholder?: string
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
    const editorRef = useRef<HTMLDivElement>(null)
    const isUserTyping = useRef(false)
    const [isEmpty, setIsEmpty] = useState(!value)

    // Sync external value changes (initial load, AI enhancement) into the editor
    // Skip when the user is actively typing to avoid cursor jump
    useEffect(() => {
        if (editorRef.current && !isUserTyping.current) {
            if (editorRef.current.innerHTML !== value) {
                editorRef.current.innerHTML = value || ""
                setIsEmpty(!(editorRef.current.textContent || "").trim())
            }
        }
    }, [value])

    // Apply formatting command
    const handleFormat = (command: string, val?: string) => {
        document.execCommand(command, false, val)
        editorRef.current?.focus()
        syncToParent()
    }

    // Sync editor content to parent state
    const syncToParent = useCallback(() => {
        if (editorRef.current) {
            const html = editorRef.current.innerHTML
            const text = editorRef.current.textContent || ""
            setIsEmpty(!text.trim())
            onChange(html)
        }
    }, [onChange])

    // Handle user input — mark as typing so useEffect doesn't reset content
    const handleInput = useCallback(() => {
        isUserTyping.current = true
        syncToParent()
        // Reset flag after React finishes re-rendering
        requestAnimationFrame(() => {
            isUserTyping.current = false
        })
    }, [syncToParent])

    // Handle paste - strip formatting for clean paste
    const handlePaste = (e: React.ClipboardEvent) => {
        e.preventDefault()
        const text = e.clipboardData.getData('text/plain')
        document.execCommand('insertText', false, text)
        handleInput()
    }

    return (
        <div className="rounded-lg border border-border-light dark:border-border-dark bg-background-light dark:bg-background-dark overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center gap-1 border-b border-border-light dark:border-border-dark p-2 bg-gray-50 dark:bg-gray-800/50">
                <button
                    type="button"
                    onClick={() => handleFormat('bold')}
                    className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    title="Negrita (Ctrl+B)"
                >
                    <span className="material-symbols-outlined text-xl">format_bold</span>
                </button>
                <button
                    type="button"
                    onClick={() => handleFormat('italic')}
                    className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    title="Cursiva (Ctrl+I)"
                >
                    <span className="material-symbols-outlined text-xl">format_italic</span>
                </button>
                <button
                    type="button"
                    onClick={() => handleFormat('underline')}
                    className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    title="Subrayado (Ctrl+U)"
                >
                    <span className="material-symbols-outlined text-xl">format_underlined</span>
                </button>
                <div className="w-px h-6 bg-border-light dark:bg-border-dark mx-1" />
                <button
                    type="button"
                    onClick={() => handleFormat('insertUnorderedList')}
                    className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    title="Lista con viñetas"
                >
                    <span className="material-symbols-outlined text-xl">format_list_bulleted</span>
                </button>
                <button
                    type="button"
                    onClick={() => handleFormat('insertOrderedList')}
                    className="p-1.5 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                    title="Lista numerada"
                >
                    <span className="material-symbols-outlined text-xl">format_list_numbered</span>
                </button>
            </div>

            {/* Editor Area */}
            <div className="relative">
                <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={handleInput}
                    onBlur={syncToParent}
                    onPaste={handlePaste}
                    className="min-h-32 p-3 outline-none prose prose-sm dark:prose-invert max-w-none [&>*]:my-1 [&>ul]:list-disc [&>ul]:ml-4 [&>ol]:list-decimal [&>ol]:ml-4"
                />
                {isEmpty && (
                    <div className="absolute top-3 left-3 text-text-light-secondary dark:text-text-dark-secondary pointer-events-none">
                        {placeholder}
                    </div>
                )}
            </div>
        </div>
    )
}
