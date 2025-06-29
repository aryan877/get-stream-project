import OpenAI from "openai";
import type { AssistantStream } from "openai/lib/AssistantStream";
import type { Channel, Event, MessageResponse, StreamChat } from "stream-chat";

export class OpenAIResponseHandler {
  private message_text = "";
  private chunk_counter = 0;
  private run_id = "";
  private is_done = false;

  constructor(
    private readonly openai: OpenAI,
    private readonly openAiThread: OpenAI.Beta.Threads.Thread,
    private readonly assistantStream: AssistantStream,
    private readonly chatClient: StreamChat,
    private readonly channel: Channel,
    private readonly message: MessageResponse,
    private readonly onDispose: () => void
  ) {
    this.chatClient.on("ai_indicator.stop", this.handleStopGenerating);
  }

  run = async () => {
    await this.observeStream(this.assistantStream);
    await this.dispose();
  };

  dispose = async () => {
    if (this.is_done) {
      return;
    }
    this.is_done = true;
    this.chatClient.off("ai_indicator.stop", this.handleStopGenerating);
    try {
      await this.chatClient.partialUpdateMessage(this.message.id, {
        set: { generating: false },
      });
    } catch (e) {
      console.error("Could not clear generating status on dispose", e);
    }
    this.onDispose();
  };

  private handleStopGenerating = async (event: Event) => {
    if (this.is_done || event.message_id !== this.message.id) {
      return;
    }

    console.log("Stop generating for message", this.message.id);
    if (!this.openai || !this.openAiThread || !this.run_id) {
      return;
    }

    try {
      await this.openai.beta.threads.runs.cancel(
        this.openAiThread.id,
        this.run_id
      );
    } catch (e) {
      console.error("Error cancelling run", e);
    }

    await this.chatClient.partialUpdateMessage(this.message.id, {
      set: { generating: false },
    });
    await this.channel.sendEvent({
      type: "ai_indicator.clear",
      cid: this.message.cid,
      message_id: this.message.id,
    });
    await this.dispose();
  };

  private observeStream = async (stream: AssistantStream) => {
    const { cid, id } = this.message;

    stream
      .on("textCreated", () => {
        console.log("Sending AI_STATE_GENERATING indicator");
        this.channel.sendEvent({
          type: "ai_indicator.update",
          ai_state: "AI_STATE_GENERATING",
          cid: cid,
          message_id: id,
        });
      })
      .on("textDelta", (textDelta) => {
        this.message_text += textDelta.value || "";
        if (
          this.chunk_counter % 15 === 0 ||
          (this.chunk_counter < 8 && this.chunk_counter % 2 === 0)
        ) {
          const text = this.message_text;
          this.chatClient.partialUpdateMessage(id, {
            set: { text, generating: true },
          });
        }
        this.chunk_counter += 1;
      })
      .on("textDone", (text) => {
        const finalText = this.message_text;
        this.chatClient.partialUpdateMessage(id, {
          set: { text: finalText, generating: false },
        });
        this.channel.sendEvent({
          type: "ai_indicator.clear",
          cid: cid,
          message_id: id,
        });
      })
      .on("runStepCreated", (runStep) => {
        if (runStep.run_id) {
          this.run_id = runStep.run_id;
        }
        if (runStep.type === "message_creation") {
          console.log("Sending AI_STATE_GENERATING indicator");
          this.channel.sendEvent({
            type: "ai_indicator.update",
            ai_state: "AI_STATE_GENERATING",
            cid: cid,
            message_id: id,
          });
        }
      })
      .on("end", async () => {
        console.log("Stream ended, checking for required actions");
        const currentRun = stream.currentRun();

        if (
          currentRun &&
          currentRun.status === "requires_action" &&
          currentRun.required_action?.type === "submit_tool_outputs"
        ) {
          console.log("Sending AI_STATE_EXTERNAL_SOURCES indicator");
          await this.channel.sendEvent({
            type: "ai_indicator.update",
            ai_state: "AI_STATE_EXTERNAL_SOURCES",
            cid: cid,
            message_id: id,
          });

          const toolCalls =
            currentRun.required_action.submit_tool_outputs.tool_calls;
          const toolOutputs = [];

          for (const toolCall of toolCalls) {
            if (toolCall.function.name === "web_search") {
              try {
                const args = JSON.parse(toolCall.function.arguments);
                const searchResult = await this.performWebSearch(args.query);
                toolOutputs.push({
                  tool_call_id: toolCall.id,
                  output: searchResult,
                });
              } catch (e) {
                console.error(
                  "Error parsing tool arguments or performing web search",
                  e
                );
                toolOutputs.push({
                  tool_call_id: toolCall.id,
                  output: JSON.stringify({ error: "failed to call tool" }),
                });
              }
            }
          }

          if (toolOutputs.length > 0) {
            // Create a new stream for tool output submission
            const toolStream =
              this.openai.beta.threads.runs.submitToolOutputsStream(
                this.openAiThread.id,
                currentRun.id,
                { tool_outputs: toolOutputs }
              );

            // Recursively observe the new stream
            await this.observeStream(toolStream);
          }
        }
      })
      .on("error", async (error) => {
        console.error("Stream error:", error);
        await this.handleError(error);
      });

    // Wait for the stream to complete
    try {
      await stream.finalMessages();
    } catch (error) {
      console.error("Error waiting for final messages:", error);
      await this.handleError(error as Error);
    }
  };

  private handleError = async (error: Error) => {
    if (this.is_done) {
      return;
    }
    await this.channel.sendEvent({
      type: "ai_indicator.update",
      ai_state: "AI_STATE_ERROR",
      cid: this.message.cid,
      message_id: this.message.id,
    });
    await this.chatClient.partialUpdateMessage(this.message.id, {
      set: {
        text: error.message ?? "Error generating the message",
        message: error.toString(),
        generating: false,
      },
    });
    await this.dispose();
  };

  private performWebSearch = async (query: string): Promise<string> => {
    const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

    if (!TAVILY_API_KEY) {
      return JSON.stringify({
        error: "Web search is not available. API key not configured.",
      });
    }

    console.log(`Performing web search for: "${query}"`);

    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${TAVILY_API_KEY}`,
        },
        body: JSON.stringify({
          query: query,
          search_depth: "advanced",
          max_results: 5,
          include_answer: true,
          include_raw_content: false,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Tavily search failed for query "${query}":`, errorText);
        return JSON.stringify({
          error: `Search failed with status: ${response.status}`,
          details: errorText,
        });
      }

      const data = await response.json();
      console.log(`Tavily search successful for query "${query}"`);

      return JSON.stringify(data);
    } catch (error) {
      console.error(
        `An exception occurred during web search for "${query}":`,
        error
      );
      return JSON.stringify({
        error: "An exception occurred during the search.",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  };
}
