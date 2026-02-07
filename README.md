# Murmur

An open-source AI voice dictation desktop app. A free alternative to [Wispr Flow](https://wispr.ai).

![Murmur](Murmur-logo.png)

## Features

- **Voice-to-text dictation** - Press a hotkey, speak, and your words are transcribed and pasted into any application
- **Multiple transcription providers** - Choose from Groq, OpenAI, Mistral, or local Whisper models
- **AI text processing** - Optionally clean up or polish transcriptions using LLMs (OpenAI, Anthropic, Google Gemini, Groq, Mistral, or local Ollama)
- **Privacy-first local option** - Run entirely offline with local Whisper models
- **Cross-platform** - Built with Electron for Windows, macOS, and Linux

## How It Works

1. Press the global hotkey to start recording
2. Speak your text
3. Release to stop recording
4. Audio is transcribed using your chosen provider
5. Text is optionally processed by an LLM (clean up filler words, polish for clarity)
6. Result is automatically pasted into your active application

## Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/newtro/Murmur.git
cd murmur

# Install dependencies
npm install

# Start in development mode
npm start
```

### Building

```bash
# Package the app
npm run package

# Create platform installers
npm run make
```

## Configuration

### Recommended: Mistral AI (Free Tier)

If you're new to Murmur, [Mistral AI](https://mistral.ai) is a great place to start. Their **free Experiment plan** gives you API access for both transcription and text processing — no credit card required, just a verified phone number.

1. Sign up at [console.mistral.ai](https://console.mistral.ai)
2. Activate the **Experiment** plan (free)
3. Generate an API key
4. In Murmur, select **Mistral** as both your transcription and LLM provider and paste your key

This lets you use **Voxtral** for transcription and models like **Mistral Small** for text processing at no cost. Note that API requests on the free plan may be used by Mistral to improve their models.

### Transcription Providers

| Provider | Description | API Key Required |
|----------|-------------|------------------|
| **Groq** | Fast cloud transcription with Whisper | Yes |
| **OpenAI** | GPT-4o transcription or Whisper-1 | Yes |
| **Mistral** | Voxtral cloud transcription | Yes ([free tier available](https://mistral.ai/pricing)) |
| **Local** | On-device Whisper (privacy-first) | No |

### LLM Providers (for text processing)

| Provider | Models | API Key Required |
|----------|--------|------------------|
| **Groq** | Llama 4 Scout, Llama 3.3 70B | Yes |
| **OpenAI** | GPT-4o, GPT-4o Mini | Yes |
| **Anthropic** | Claude Haiku 4.5, Sonnet 4.5, Opus 4.5 | Yes |
| **Google Gemini** | Gemini 2.5 Flash, Gemini 2.5 Pro | Yes |
| **Mistral** | Mistral Small, Medium, Large | Yes ([free tier available](https://mistral.ai/pricing)) |
| **Ollama** | Any local model | No |

### Processing Modes

- **Raw** - No processing, just transcription
- **Clean** - Remove filler words, add punctuation
- **Polish** - Full rewrite for clarity and flow

## Development

```bash
npm start              # Start in development mode with hot-reload
npm run lint           # Run ESLint
npm run typecheck      # Run TypeScript type checking
```

## Architecture

Built with:
- **Electron** - Cross-platform desktop framework
- **React** - UI components
- **TypeScript** - Type safety
- **Vite** - Fast builds and HMR
- **JSON file store** - Local settings and history storage
- **uiohook-napi** - Global hotkey capture

## License

MIT

## Acknowledgments

Inspired by [Wispr Flow](https://wispr.ai) - if you want a polished commercial solution, check them out!
