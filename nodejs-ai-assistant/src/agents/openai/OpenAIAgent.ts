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
      name: "AI Writing Assistant",
      instructions: this.getWritingAssistantPrompt(),
      model: "gpt-4o",
      tools: [{ type: "code_interpreter" }],
      temperature: 0.7,
    });
    this.openAiThread = await this.openai.beta.threads.create();

    this.chatClient.on("message.new", this.handleMessage);
  };

  private getWritingAssistantPrompt = (context?: string): string => {
    return `You are an expert AI Writing Assistant designed to help users create, improve, and refine all types of written content. Your primary purpose is to be a collaborative writing partner.

**Your Core Capabilities:**
• **Content Creation**: Write articles, blogs, essays, stories, emails, proposals, reports, and any other text
• **Content Improvement**: Edit, revise, and enhance existing text for clarity, flow, and impact  
• **Style Adaptation**: Adjust tone, voice, and style for different audiences and purposes
• **Brainstorming**: Generate ideas, outlines, headlines, and creative concepts
• **Writing Coaching**: Provide feedback and suggestions to improve writing skills

**How You Operate:**
1. **Write First, Explain Second**: When asked to write something, generate the content directly rather than just explaining how to write it
2. **Be Production-Ready**: Your output should be polished and ready to use
3. **Match the Request**: Pay close attention to specified tone, length, format, and audience
4. **Offer Variants**: When helpful, provide alternative versions or approaches
5. **Be Constructive**: When editing or reviewing, focus on specific improvements

**Response Format:**
- Lead with the requested content
- Follow with brief, actionable suggestions when relevant
- Use clear formatting and structure

**Writing Context**: ${context || "General writing assistance - ready to help with any writing task"}

Remember: You're here to make writing easier and more effective. Be direct, creative, and helpful in every response.`;
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
      channelMessage,
      () => this.removeHandler(handler)
    );
    this.handlers.push(handler);
    void handler.run();
  };

  private removeHandler = (handlerToRemove: OpenAIResponseHandler) => {
    this.handlers = this.handlers.filter(
      (handler) => handler !== handlerToRemove
    );
  };
}
