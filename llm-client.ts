// SAIE Multi-Provider LLM Client
// Auto-detects which AI API key is available and uses it
// Supports: Anthropic, OpenAI, Google Gemini, Nvidia NIM, Groq, DeepSeek

import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

// ─── Provider Detection ──────────────────────────────────────────────

export type LLMProvider = 'anthropic' | 'openai' | 'gemini' | 'nvidia' | 'groq' | 'deepseek' | 'ollama' | null

interface ProviderConfig {
  provider: LLMProvider
  apiKey: string
  baseUrl: string
  model: string
  maxTokens: number
}

interface LLMResponse {
  content: string
  provider: string
  model: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
}

// Load .env file manually (no dotenv dependency)
function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  const envPath = join(process.cwd(), '.env')
  
  if (existsSync(envPath)) {
    const content = readFileSync(envPath, 'utf-8')
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eqIndex = trimmed.indexOf('=')
      if (eqIndex > 0) {
        const key = trimmed.slice(0, eqIndex).trim()
        const value = trimmed.slice(eqIndex + 1).trim().replace(/^["']|["']$/g, '')
        env[key] = value
      }
    }
  }
  
  // Also check process.env
  for (const [key, value] of Object.entries(process.env)) {
    if (value) env[key] = value
  }
  
  return env
}

let cachedEnv: Record<string, string> | null = null

function getEnv(): Record<string, string> {
  if (!cachedEnv) cachedEnv = loadEnv()
  return cachedEnv
}

// ─── Provider Detection (Priority Order) ─────────────────────────────

const PROVIDER_PRIORITY: { provider: LLMProvider; envKeys: string[]; baseUrl: string; defaultModel: string; maxTokens: number }[] = [
  {
    provider: 'anthropic',
    envKeys: ['ANTHROPIC_API_KEY'],
    baseUrl: 'https://api.anthropic.com/v1',
    defaultModel: 'claude-sonnet-4-20250514',
    maxTokens: 4096,
  },
  {
    provider: 'openai',
    envKeys: ['OPENAI_API_KEY'],
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    maxTokens: 4096,
  },
  {
    provider: 'gemini',
    envKeys: ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GEMINI_API_KEY'],
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    defaultModel: 'gemini-2.0-flash',
    maxTokens: 4096,
  },
  {
    provider: 'nvidia',
    envKeys: ['NVIDIA_API_KEY', 'NVIDIA_NIM_API_KEY', 'NVCF_API_KEY'],
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    defaultModel: 'meta/llama-3.1-70b-instruct',
    maxTokens: 4096,
  },
  {
    provider: 'groq',
    envKeys: ['GROQ_API_KEY'],
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'llama-3.1-70b-versatile',
    maxTokens: 4096,
  },
  {
    provider: 'deepseek',
    envKeys: ['DEEPSEEK_API_KEY'],
    baseUrl: 'https://api.deepseek.com/v1',
    defaultModel: 'deepseek-chat',
    maxTokens: 4096,
  },
  {
    provider: 'ollama',
    envKeys: ['OLLAMA_HOST'],
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3.1:70b',
    maxTokens: 4096,
  },
]

let detectedProvider: LLMProvider = undefined
let providerConfig: ProviderConfig | null = null

export function detectProvider(): ProviderConfig | null {
  if (providerConfig) return providerConfig
  
  const env = getEnv()
  
  for (const p of PROVIDER_PRIORITY) {
    for (const key of p.envKeys) {
      if (env[key]) {
        providerConfig = {
          provider: p.provider,
          apiKey: env[key],
          baseUrl: p.baseUrl,
          model: env[`${p.provider?.toUpperCase()}_MODEL`] || p.defaultModel,
          maxTokens: p.maxTokens,
        }
        detectedProvider = p.provider
        console.log(`[LLM] Detected provider: ${p.provider} (model: ${providerConfig.model})`)
        return providerConfig
      }
    }
  }
  
  console.log('[LLM] No API key found — running in content-analysis mode (no AI calls)')
  return null
}

export function getProviderName(): string {
  return detectedProvider || 'content-analysis'
}

// ─── OpenAI-Compatible API Call (Anthropic, OpenAI, Nvidia, Groq, DeepSeek) ──

async function callOpenAICompatible(
  config: ProviderConfig,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 2048,
): Promise<LLMResponse> {
  const startTime = Date.now()
  
  // Anthropic uses messages API with x-api-key header
  if (config.provider === 'anthropic') {
    const response = await fetch(`${config.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })
    
    if (!response.ok) {
      const errText = await response.text()
      throw new Error(`Anthropic API error ${response.status}: ${errText.slice(0, 200)}`)
    }
    
    const data = await response.json()
    return {
      content: data.content?.[0]?.text || '',
      provider: 'anthropic',
      model: config.model,
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
      latencyMs: Date.now() - startTime,
    }
  }
  
  // OpenAI-compatible (OpenAI, Nvidia, Groq, DeepSeek, Ollama)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (config.apiKey && !config.apiKey.startsWith('http')) {
    headers['Authorization'] = `Bearer ${config.apiKey}`
  }

  const response = await fetch(`${config.baseUrl}/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: config.model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  })
  
  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`${config.provider} API error ${response.status}: ${errText.slice(0, 200)}`)
  }
  
  const data = await response.json()
  return {
    content: data.choices?.[0]?.message?.content || '',
    provider: config.provider!,
    model: config.model,
    inputTokens: data.usage?.prompt_tokens || 0,
    outputTokens: data.usage?.completion_tokens || 0,
    latencyMs: Date.now() - startTime,
  }
}

// ─── Google Gemini API Call ──────────────────────────────────────────

async function callGemini(
  config: ProviderConfig,
  systemPrompt: string,
  userPrompt: string,
  maxTokens: number = 2048,
): Promise<LLMResponse> {
  const startTime = Date.now()
  
  const response = await fetch(
    `${config.baseUrl}/models/${config.model}:generateContent?key=${config.apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: 0.3,
        },
      }),
    },
  )
  
  if (!response.ok) {
    const errText = await response.text()
    throw new Error(`Gemini API error ${response.status}: ${errText.slice(0, 200)}`)
  }
  
  const data = await response.json()
  return {
    content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
    provider: 'gemini',
    model: config.model,
    inputTokens: data.usageMetadata?.promptTokenCount || 0,
    outputTokens: data.usageMetadata?.candidatesTokenCount || 0,
    latencyMs: Date.now() - startTime,
  }
}

// ─── Unified Call Interface ──────────────────────────────────────────

export async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  options: { maxTokens?: number; retries?: number } = {},
): Promise<LLMResponse | null> {
  const config = detectProvider()
  if (!config) return null
  
  const { maxTokens = 2048, retries = 2 } = options
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      if (config.provider === 'gemini') {
        return await callGemini(config, systemPrompt, userPrompt, maxTokens)
      } else {
        return await callOpenAICompatible(config, systemPrompt, userPrompt, maxTokens)
      }
    } catch (err: any) {
      console.error(`[LLM] ${config.provider} attempt ${attempt + 1} failed: ${err.message}`)
      if (attempt === retries) {
        console.error(`[LLM] All ${retries + 1} attempts failed for ${config.provider}`)
        return null
      }
      // Exponential backoff
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)))
    }
  }
  
  return null
}

// ─── Content-Based Analysis (Fallback When No API Key) ───────────────

export interface AnalysisResult {
  summary: string
  keyFindings: string[]
  opportunities: string[]
  risks: string[]
  recommendations: string[]
  confidence: number
  provider: string
}

export async function analyzeWithLLM(
  title: string,
  content: string,
  context: string = 'SAP automation intelligence',
): Promise<AnalysisResult> {
  const response = await callLLM(
    `You are a senior SAP automation consultant analyzing web content for automation opportunities.
Analyze the content and provide:
1. A concise 2-3 sentence summary
2. Key findings (3-5 bullet points)
3. Automation opportunities (2-4 specific opportunities)
4. Potential risks or concerns (1-3 points)
5. Strategic recommendations (2-3 actionable items)
6. Confidence level (0.0-1.0) based on content quality and evidence

Respond in valid JSON with these fields: summary, keyFindings[], opportunities[], risks[], recommendations[], confidence`,
    `Analyze this ${context} content:

TITLE: ${title}

CONTENT:
${content.slice(0, 3000)}`,
    { maxTokens: 1024 },
  )
  
  if (response?.content) {
    try {
      // Try to parse JSON from response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        return {
          summary: parsed.summary || '',
          keyFindings: parsed.keyFindings || [],
          opportunities: parsed.opportunities || [],
          risks: parsed.risks || [],
          recommendations: parsed.recommendations || [],
          confidence: parsed.confidence || 0.5,
          provider: response.provider,
        }
      }
    } catch {}
    
    // Fallback: treat response as plain text summary
    return {
      summary: response.content.slice(0, 500),
      keyFindings: [],
      opportunities: [],
      risks: [],
      recommendations: [],
      confidence: 0.5,
      provider: response.provider,
    }
  }
  
  // No API key — return null to trigger content-based fallback
  return {
    summary: 'Analysis requires an AI API key (Anthropic, OpenAI, Gemini, Nvidia, or Groq)',
    keyFindings: [],
    opportunities: [],
    risks: [],
    recommendations: ['Add an API key to .env for AI-powered analysis'],
    confidence: 0,
    provider: 'none',
  }
}

// ─── Status ──────────────────────────────────────────────────────────

export function getLLMStatus(): {
  available: boolean
  provider: string
  model: string
  envKey: string | null
} {
  const config = detectProvider()
  if (!config) {
    return { available: false, provider: 'none', model: 'none', envKey: null }
  }
  
  const envKeyMap: Record<string, string> = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    gemini: 'GEMINI_API_KEY',
    nvidia: 'NVIDIA_API_KEY',
    groq: 'GROQ_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
    ollama: 'OLLAMA_HOST',
  }
  
  return {
    available: true,
    provider: config.provider || 'unknown',
    model: config.model,
    envKey: envKeyMap[config.provider || ''] || null,
  }
}
