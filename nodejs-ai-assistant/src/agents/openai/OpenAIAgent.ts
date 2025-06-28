import OpenAI from "openai";
import type { Channel, DefaultGenerics, Event, StreamChat } from "stream-chat";
import type { AIAgent } from "../types";
import { OpenAIResponseHandler } from "./OpenAIResponseHandler";

export class OpenAIAgent implements AIAgent {
  private openai?: OpenAI;
  private assistant?: OpenAI.Beta.Assistants.Assistant;
  private openAiThread?: OpenAI.Beta.Threads.Thread;
  private lastInteractionTs = Date.now();

  private handlers: OpenAIResponseHandler[] = [];

  constructor(
    readonly chatClient: StreamChat,
    readonly channel: Channel
  ) {}

  dispose = async () => {
    this.chatClient.off("message.new", this.handleMessage);
    await this.chatClient.disconnectUser();

    this.handlers.forEach((handler) => handler.dispose());
    this.handlers = [];
  };

  get user() {
    return this.chatClient.user;
  }

  getLastInteraction = (): number => this.lastInteractionTs;

  init = async () => {
    const apiKey = process.env.OPENAI_API_KEY as string | undefined;
    if (!apiKey) {
      throw new Error("OpenAI API key is required");
    }

    this.openai = new OpenAI({ apiKey });
    this.assistant = await this.openai.beta.assistants.create({
      name: "Stream AI Writing Assistant",
      instructions: this.getWritingAssistantPrompt(),
      model: "gpt-4o",
      tools: [{ type: "code_interpreter" }],
    });
    this.openAiThread = await this.openai.beta.threads.create();

    this.chatClient.on("message.new", this.handleMessage);
  };

  private getWritingAssistantPrompt = (context?: string): string => {
    return `You are a powerful AI Writing Assistant. Your main goal is to directly help users write content. When a user gives you a topic or a prompt, your first priority is to generate the requested content. If the prompt is ambiguous, you can ask for clarification, but always default to generating text. You can also help with brainstorming, outlining, and revising.

**Core Directives:**
1.  **Direct Generation**: When the user asks you to write something, write it directly. Don't just provide suggestions on how they could write it.
2.  **Assume the Role of a Writer**: Act as a co-writer. Your output should be ready to be used in their document.
3.  **Follow Instructions**: Pay close attention to requests for a specific tone, style, length, or format.
4.  **Offer Follow-ups (Optional)**: After generating content, you can *optionally* provide a few concise suggestions for how to continue, expand, or revise the generated text. Keep these suggestions brief and at the end of your response. Use the format:
**Suggestions:**
- [Suggestion 1]
- [Suggestion 2]

**Writing Context**: ${context || "General writing assistance"}

Remember: You're a co-writer. Your primary job is to write. Be direct, helpful, and ready to generate content.`;
  };

  private handleMessage = async (e: Event<DefaultGenerics>) => {
    if (!this.openai || !this.openAiThread || !this.assistant) {
      console.log("OpenAI not initialized");
      return;
    }

    if (!e.message || e.message.ai_generated) {
      console.log("Skip handling ai generated message");
      return;
    }

    const message = e.message.text;
    if (!message) return;

    this.lastInteractionTs = Date.now();

    const writingTask = (e.message.custom as { writingTask?: string })
      ?.writingTask;
    const context = writingTask ? `Writing Task: ${writingTask}` : undefined;
    const instructions = this.getWritingAssistantPrompt(context);

    await this.openai.beta.threads.messages.create(this.openAiThread.id, {
      role: "user",
      content: message,
    });

    const { message: channelMessage } = await this.channel.sendMessage({
      text: "",
      ai_generated: true,
      generating: true,
    });

    await this.channel.sendEvent({
      type: "ai_indicator.update",
      ai_state: "AI_STATE_THINKING",
      cid: channelMessage.cid,
      message_id: channelMessage.id,
    });

    const run = this.openai.beta.threads.runs.stream(this.openAiThread.id, {
      assistant_id: this.assistant.id,
      instructions: instructions,
    });

    const handler = new OpenAIResponseHandler(
      this.openai,
      this.openAiThread,
      run,
      this.chatClient,
      this.channel,
      channelMessage
    );
    void handler.run();
    this.handlers.push(handler);
  };
}
