import axios, { AxiosRequestConfig } from "axios";
import { ModelConfig } from "../models/modelConfig";
import { ProxySetting } from "../models/proxySetting";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompletionOptions {
  maxTokens: number;
  temperature: number;
  timeoutMs?: number;
  allowReasoningContent?: boolean;
}

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: unknown;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  }>;
  error?: {
    message?: string;
    type?: string;
  };
}

const DEFAULT_TIMEOUT_MS = 120000;

function redactApiKey(message: string, apiKey: string | undefined): string {
  return apiKey ? message.split(apiKey).join("[REDACTED]") : message;
}

export function normalizeChatCompletionsUrl(baseUrl: string): string {
  const value = baseUrl.trim();
  if (!value) {
    throw new Error("请先配置模型 Base URL");
  }

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("模型 Base URL 不是有效 URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("模型 Base URL 仅支持 http 或 https");
  }

  url.hash = "";
  const pathname = url.pathname.replace(/\/+$/, "");
  url.pathname = pathname.toLowerCase().endsWith("/chat/completions")
    ? pathname
    : `${pathname}/chat/completions`;
  return url.toString();
}

export async function requestChatCompletion(
  config: ModelConfig,
  apiKey: string | undefined,
  messages: ChatMessage[],
  options: ChatCompletionOptions,
  proxy?: ProxySetting
): Promise<string> {
  const modelName = config.modelName.trim();
  if (!modelName) {
    throw new Error("请先配置 Model Name");
  }
  if (!messages.length) {
    throw new Error("模型请求缺少 messages");
  }

  const endpoint = normalizeChatCompletionsUrl(config.baseUrl);
  const headers: { [key: string]: string } = {};
  headers["Content-Type"] = "application/json";
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const requestConfig: AxiosRequestConfig = {
    headers,
    timeout: options.timeoutMs || DEFAULT_TIMEOUT_MS,
    proxy: proxy
      ? {
          host: proxy.host,
          port: proxy.port,
          protocol: proxy.protocol,
        }
      : false,
  };

  try {
    const requestBody: { [key: string]: unknown } = {
      model: modelName,
      messages,
      temperature: options.temperature,
      stream: false,
    };
    requestBody["max_tokens"] = options.maxTokens;
    const response = await axios.post<ChatCompletionResponse>(
      endpoint,
      requestBody,
      requestConfig
    );

    const responseError = response.data?.error?.message;
    if (responseError) {
      throw new Error(`模型接口返回错误：${redactApiKey(responseError, apiKey)}`);
    }

    const choice = response.data?.choices?.[0];
    const message = choice?.message;
    if (!message) {
      throw new Error("接口响应缺少 choices[0].message，不兼容 /chat/completions");
    }

    const content = message.content;
    if (typeof content === "string" && content.trim()) {
      return content.trim();
    }

    const reasoningContent = message["reasoning_content"];
    if (typeof reasoningContent === "string" && reasoningContent.trim()) {
      if (options.allowReasoningContent) {
        return reasoningContent.trim();
      }
      throw new Error(
        "模型返回了 reasoning_content，但最终 content 为空；请提高输出 token 上限或关闭模型思考模式"
      );
    }

    const finishReasonValue = choice?.["finish_reason"];
    const finishReason = typeof finishReasonValue === "string"
      ? `（finish_reason: ${finishReasonValue}）`
      : "";
    throw new Error(
      `接口已返回 choices[0].message，但 content 和 reasoning_content 均为空${finishReason}`
    );
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const responseData = error.response?.data as ChatCompletionResponse | undefined;
      const apiMessage = responseData?.error?.message;
      if (status) {
        const detail = apiMessage ? `：${redactApiKey(apiMessage, apiKey)}` : "";
        throw new Error(`模型接口请求失败（HTTP ${status}）${detail}`);
      }
      throw new Error(`模型接口请求失败：${redactApiKey(error.message, apiKey)}`);
    }
    if (error instanceof Error) {
      throw new Error(redactApiKey(error.message, apiKey));
    }
    throw error;
  }
}

export async function testChatCompletions(
  config: ModelConfig,
  apiKey: string | undefined,
  proxy?: ProxySetting
): Promise<string> {
  return requestChatCompletion(
    config,
    apiKey,
    [{ role: "user", content: "Return exactly OK." }],
    {
      maxTokens: 256,
      temperature: 0,
      timeoutMs: 30000,
      allowReasoningContent: true,
    },
    proxy
  );
}
