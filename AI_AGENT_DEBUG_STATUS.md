# AI Agent Integration - Debug Status

## 🎯 Objective
Integrate Anthropic Claude AI as the chat agent "brain" to replace keyword-based search with intelligent conversation, tool use, and autonomous actions (show products, add to cart, etc.).

## ✅ What's Working
1. **Infrastructure Created**:
   - ✅ Anthropic client wrapper (`src/lib/ai/anthropic.ts`)
   - ✅ Tools definitions with Zod validation (`src/lib/ai/tools.ts`)
   - ✅ Context builders for prompts (`src/lib/ai/context.ts`)
   - ✅ Tool executor (`src/lib/ai/tool-executor.ts`)
   - ✅ Main chat agent service (`src/lib/ai/chat-agent.ts`)
   - ✅ API endpoint `/api/ai-chat` (`src/app/api/ai-chat/route.ts`)
   
2. **Frontend Updated**:
   - ✅ Chat page uses `/api/ai-chat` instead of keyword search
   - ✅ Cart store supports quantity parameter
   
3. **Database**:
   - ✅ Agent "Alejandra" created successfully via `/api/setup-agent`
   - ✅ Schema fixed: using `agents` table (not `agent_templates`)
   - ✅ Column names corrected: `assigned_agent_id` (not `agent_id`)
   - ✅ Removed non-existent `channel` field from chat insert

4. **API Flow**:
   - ✅ `/api/ai-chat` route exists and responds (no 404)
   - ✅ Chat creation works (no "Failed to create chat" error)
   - ✅ Request reaches `processMessage` function

## ❌ Current Problem
**Symptom**: User sees fallback message "Lo siento, tuve un problema procesando tu mensaje..."

**What This Means**:
- The `processMessage` function in `src/lib/ai/chat-agent.ts` is throwing an error
- The error is caught by the try-catch block (line 252)
- The fallback response is returned to the user

**What We DON'T Know**:
- **Exact error location**: Which step in `processMessage` is failing?
- **Error message**: What is the actual error being thrown?
- **Error cause**: Is it Claude API, database query, context building, or something else?

## 🔍 Debugging Steps Taken
1. Added `console.log` at every major step in `processMessage`:
   - Loading agent configuration
   - Loading organization
   - Loading products
   - Loading conversation history
   - Loading customer context
   - Loading cart
   - Building system prompt
   - Calling Claude API
   
2. Enhanced error logging in catch block:
   - `console.error("[processMessage] ERROR:", error)`
   - `console.error("[processMessage] Error stack:", error.stack)`
   - `console.error("[processMessage] Error details:", ...)`

3. **Issue**: Terminal logs (`npm run dev`) are **empty** - no logs appearing despite console.log statements

## 🤔 Possible Causes
1. **Anthropic API Key Issue**:
   - Invalid or missing API key
   - API key not loaded from `.env.local`
   - Wrong model name (fixed to `claude-3-5-sonnet-20240620`)

2. **Context Building Error**:
   - `buildSystemPrompt` failing due to agent data structure mismatch
   - Missing required fields in agent configuration

3. **Database Query Error**:
   - RLS (Row Level Security) blocking queries
   - Missing or null data causing errors

4. **Tool Definitions Error**:
   - Zod schema validation failing
   - Tools array malformed

## 📋 Next Steps for Debugging
1. **Check if logs are appearing in terminal** - User needs to verify
2. **If logs appear**: Identify which step fails (last successful log)
3. **If logs DON'T appear**: 
   - Check if `.env.local` is being loaded
   - Test Claude API directly with curl/Postman
   - Add try-catch around each major step individually

## 🔑 Key Files
- **Main Service**: `src/lib/ai/chat-agent.ts` (line 33-262)
- **API Endpoint**: `src/app/api/ai-chat/route.ts`
- **Tools**: `src/lib/ai/tools.ts`
- **Context**: `src/lib/ai/context.ts`
- **Anthropic Client**: `src/lib/ai/anthropic.ts`

## 🗄️ Database Schema (Verified)
```sql
-- agents table
CREATE TABLE agents (
  id uuid PRIMARY KEY,
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  name text NOT NULL,
  type text CHECK (type IN ('human', 'bot')) NOT NULL,
  role text CHECK (role IN ('sales', 'support', 'admin')) DEFAULT 'support',
  status text CHECK (status IN ('available', 'busy', 'offline', 'vacation')) DEFAULT 'offline',
  avatar_url text,
  configuration jsonb DEFAULT '{}'::jsonb,
  system_prompt text, -- ADDED via fix_agents_table.sql
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- chats table
CREATE TABLE chats (
  id uuid PRIMARY KEY,
  organization_id uuid REFERENCES organizations(id) NOT NULL,
  assigned_agent_id uuid REFERENCES agents(id), -- NOT agent_id!
  customer_name text,
  status text CHECK (status IN ('active', 'closed', 'pending')) DEFAULT 'active',
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
```

## 🔐 Environment Variables
```env
ANTHROPIC_API_KEY=sk-ant-... (user confirmed it's set)
```

## 📝 Test Commands
```bash
# Test setup-agent (WORKS ✅)
curl http://localhost:3000/api/setup-agent

# Test ai-chat (FAILS ❌ - returns fallback message)
curl -X POST http://localhost:3000/api/ai-chat \
  -H "Content-Type: application/json" \
  -d '{"message": "hola", "slug": "org-tause-main"}'
```

## 🆘 Help Needed
**Please help identify**:
1. Why are console.log statements not appearing in terminal?
2. What is the actual error being thrown in `processMessage`?
3. Is the Claude API being called successfully?

**Suggested Approach**:
1. Review `src/lib/ai/chat-agent.ts` for potential errors
2. Check if `buildSystemPrompt` in `src/lib/ai/context.ts` handles the agent structure correctly
3. Verify Anthropic SDK usage in `src/lib/ai/anthropic.ts`
4. Test individual components in isolation
