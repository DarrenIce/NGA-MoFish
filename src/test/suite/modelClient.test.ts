import * as assert from "assert";
import * as http from "http";
import { AddressInfo } from "net";
import {
  normalizeChatCompletionsUrl,
  testChatCompletions,
} from "../../services/modelClient";

function startServer(
  handler: (request: http.IncomingMessage, response: http.ServerResponse) => void
): Promise<{ server: http.Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address() as AddressInfo;
      resolve({
        server,
        baseUrl: `http://127.0.0.1:${address.port}`,
      });
    });
  });
}

function closeServer(server: http.Server): Promise<void> {
  return new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}

suite("OpenAI-compatible model client", () => {
  test("normalizes API roots and complete endpoints", () => {
    assert.strictEqual(
      normalizeChatCompletionsUrl("https://api.example.com/v1"),
      "https://api.example.com/v1/chat/completions"
    );
    assert.strictEqual(
      normalizeChatCompletionsUrl("https://api.example.com/v1/chat/completions"),
      "https://api.example.com/v1/chat/completions"
    );
    assert.strictEqual(
      normalizeChatCompletionsUrl("https://api.example.com/v1/chat/completions?api-version=1"),
      "https://api.example.com/v1/chat/completions?api-version=1"
    );
  });

  test("sends a real /chat/completions request and validates its content", async () => {
    let requestPath = "";
    let authorization = "";
    let requestBody = "";
    const { server, baseUrl } = await startServer((request, response) => {
      requestPath = request.url || "";
      authorization = String(request.headers.authorization || "");
      request.on("data", (chunk) => {
        requestBody += chunk.toString();
      });
      request.on("end", () => {
        response.setHeader("Content-Type", "application/json");
        response.writeHead(200);
        response.end(JSON.stringify({
          choices: [{ message: { content: "OK" } }],
        }));
      });
    });

    try {
      const content = await testChatCompletions(
        { baseUrl: `${baseUrl}/v1`, modelName: "mock-model" },
        "test-secret"
      );
      assert.strictEqual(content, "OK");
      assert.strictEqual(requestPath, "/v1/chat/completions");
      assert.strictEqual(authorization, "Bearer test-secret");
      const expectedBody: { [key: string]: unknown } = {
        model: "mock-model",
        messages: [{ role: "user", content: "Return exactly OK." }],
        temperature: 0,
        stream: false,
      };
      expectedBody["max_tokens"] = 256;
      assert.deepStrictEqual(JSON.parse(requestBody), expectedBody);
    } finally {
      await closeServer(server);
    }
  });

  test("accepts reasoning-only replies when testing endpoint compatibility", async () => {
    const { server, baseUrl } = await startServer((_request, response) => {
      const message: { [key: string]: unknown } = { content: "" };
      message["reasoning_content"] = "thinking";
      const choice: { [key: string]: unknown } = { message };
      choice["finish_reason"] = "length";
      response.setHeader("Content-Type", "application/json");
      response.writeHead(200);
      response.end(JSON.stringify({
        choices: [choice],
      }));
    });

    try {
      const result = await testChatCompletions(
        { baseUrl, modelName: "thinking-model" },
        undefined
      );
      assert.strictEqual(result, "thinking");
    } finally {
      await closeServer(server);
    }
  });

  test("rejects HTTP 200 responses without chat completion content", async () => {
    const { server, baseUrl } = await startServer((_request, response) => {
      response.setHeader("Content-Type", "application/json");
      response.writeHead(200);
      response.end(JSON.stringify({ choices: [] }));
    });

    try {
      let error: Error | undefined;
      try {
        await testChatCompletions(
          { baseUrl, modelName: "mock-model" },
          undefined
        );
      } catch (caught) {
        error = caught as Error;
      }
      assert.ok(error);
      assert.ok(error!.message.includes("choices[0].message"));
    } finally {
      await closeServer(server);
    }
  });

  test("redacts API keys from server error messages", async () => {
    const apiKey = "secret-that-must-not-leak";
    const { server, baseUrl } = await startServer((_request, response) => {
      response.setHeader("Content-Type", "application/json");
      response.writeHead(401);
      response.end(JSON.stringify({
        error: { message: `invalid key: ${apiKey}` },
      }));
    });

    try {
      let error: Error | undefined;
      try {
        await testChatCompletions(
          { baseUrl, modelName: "mock-model" },
          apiKey
        );
      } catch (caught) {
        error = caught as Error;
      }
      assert.ok(error);
      assert.strictEqual(error!.message.includes(apiKey), false);
      assert.ok(error!.message.includes("[REDACTED]"));
    } finally {
      await closeServer(server);
    }
  });
});
