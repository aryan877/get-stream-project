import OpenAI from "openai";
import type { AssistantStream } from "openai/lib/AssistantStream";
import type { Channel, MessageResponse, StreamChat } from "stream-chat";

export class OpenAIResponseHandler {
  private message_text = "";
  private chunk_counter = 0;
  private run_id = "";

  constructor(
    private readonly openai: OpenAI,
    private readonly openAiThread: OpenAI.Beta.Threads.Thread,
    private readonly assistantStream: AssistantStream,
    private readonly chatClient: StreamChat,
    private readonly channel: Channel,
    private readonly message: MessageResponse
  ) {
    this.chatClient.on("ai_indicator.stop", this.handleStopGenerating);
  }

  run = async () => {
    for await (const event of this.assistantStream) {
      await this.handle(event);
    }
  };

  dispose = () => {
    this.chatClient.off("ai_indicator.stop", this.handleStopGenerating);
  };

  private handleStopGenerating = async () => {
    console.log("Stop generating");
    if (!this.openai || !this.openAiThread) {
      console.log("OpenAI not initialized");
      return;
    }

    this.openai.beta.threads.runs.cancel(this.openAiThread.id, this.run_id);
    await this.chatClient.partialUpdateMessage(this.message.id, {
      set: { generating: false },
    });
    await this.channel.sendEvent({
      type: "ai_indicator.clear",
      cid: this.message.cid,
      message_id: this.message.id,
    });
  };

  private handle = async (
    event: OpenAI.Beta.Assistants.AssistantStreamEvent
  ) => {
    try {
      const { cid, id } = this.message;
      console.log(`Handling OpenAI event: ${event.event}`, { cid, id });

      switch (event.event) {
        case "thread.run.requires_action":
          console.log("Sending AI_STATE_EXTERNAL_SOURCES indicator");
          await this.channel.sendEvent({
            type: "ai_indicator.update",
            ai_state: "AI_STATE_EXTERNAL_SOURCES",
            cid: cid,
            message_id: id,
          });
          break;
        case "thread.message.created":
          console.log("Sending AI_STATE_GENERATING indicator");
          await this.channel.sendEvent({
            type: "ai_indicator.update",
            ai_state: "AI_STATE_GENERATING",
            cid: cid,
            message_id: id,
          });
          break;
        case "thread.message.delta":
          const content = event.data.delta.content;
          if (!content || content[0]?.type !== "text") return;
          this.message_text += content[0].text?.value ?? "";

          console.log(
            `Delta received: chunk ${this.chunk_counter}, text length: ${this.message_text.length}`
          );

          if (
            this.chunk_counter % 15 === 0 ||
            (this.chunk_counter < 8 && this.chunk_counter % 2 === 0)
          ) {
            const text = this.message_text;
            console.log(`Sending partial update: ${text.substring(0, 100)}...`);
            await this.chatClient.partialUpdateMessage(id, {
              set: { text, generating: true },
            });
          }
          this.chunk_counter += 1;
          break;
        case "thread.message.completed":
          const text = this.message_text;
          console.log(`Message completed with text length: ${text.length}`);
          await this.chatClient.partialUpdateMessage(id, {
            set: { text, generating: false },
          });
          await this.channel.sendEvent({
            type: "ai_indicator.clear",
            cid: cid,
            message_id: id,
          });
          break;
        case "thread.run.step.created":
          this.run_id = event.data.id;
          console.log(`Run step created: ${this.run_id}`);
          break;
        case "thread.run.failed":
          const errorMessage =
            event.data.last_error?.message ?? "Thread run failed";
          console.error(`Thread run failed: ${errorMessage}`);
          await this.handleError(new Error(errorMessage));
          break;
      }
    } catch (error) {
      console.error("Error handling event:", error);
      this.handleError(error as Error);
    }
  };

  private handleError = async (error: Error) => {
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
  };
}
