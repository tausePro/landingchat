import { getChatsForConsole } from "../actions"
import { ChatConsole } from "./chat-console"

export default async function ConsolePage() {
    const result = await getChatsForConsole()

    const initialData = result.success
        ? result.data
        : { chats: [], counts: { all: 0, active: 0, pending: 0, closed: 0, whatsapp: 0, web: 0 } }

    return <ChatConsole initialData={initialData} />
}
