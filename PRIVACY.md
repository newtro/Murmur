# Privacy Policy

**Last updated: February 6, 2026**

## Overview

Murmur is an open-source desktop application for AI-powered voice dictation. This privacy policy explains how Murmur handles your data.

## Data Collection

Murmur does **not** collect, store, or transmit any personal data to us. The application runs entirely on your device.

## Audio Data

- Audio is captured locally on your device only while you are actively recording.
- Audio recordings are held temporarily in memory during processing and are **not** saved to disk.
- When using cloud transcription providers (Groq, OpenAI, Mistral), audio is sent directly from your device to the selected provider's API for transcription. Murmur does not act as an intermediary and does not retain copies of audio sent to these services.
- When using local transcription (Whisper), audio never leaves your device.

## Third-Party API Services

If you choose to use cloud-based providers, your data is subject to their respective privacy policies:

- **OpenAI**: https://openai.com/privacy
- **Groq**: https://groq.com/privacy-policy
- **Mistral**: https://mistral.ai/terms/#privacy-policy
- **Anthropic**: https://www.anthropic.com/privacy
- **Google (Gemini)**: https://ai.google.dev/terms

API keys you configure are stored locally on your device in a SQLite database and are never shared with anyone other than the respective API provider.

## Local Storage

Murmur stores the following data locally on your device:

- Application settings and preferences
- API keys for configured providers
- Transcription history (if enabled)

This data is stored in a local SQLite database and is never transmitted externally.

## Analytics and Telemetry

Murmur does **not** include any analytics, telemetry, crash reporting, or tracking of any kind.

## Network Requests

Murmur only makes network requests when:

1. Sending audio to a cloud transcription provider you have configured
2. Sending text to an LLM provider you have configured
3. Downloading local model files (when using local Whisper)

No other network requests are made.

## Children's Privacy

Murmur does not knowingly collect any data from children under 13.

## Changes to This Policy

Changes to this privacy policy will be posted in this repository. The "Last updated" date at the top will be revised accordingly.

## Contact

For privacy-related questions, please open an issue at https://github.com/newtro/Murmur/issues.

## Open Source

Murmur is open source under the MIT License. You can audit the complete source code at https://github.com/newtro/Murmur to verify these privacy practices.
