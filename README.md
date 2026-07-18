# Moonlit Storybook MVP

A deployable personalized children's story generator built with Next.js.

## Included
- Guided parent story setup
- 5, 10, or 16-page stories
- OpenAI and Anthropic backend adapters
- Built-in demo mode when no API key is configured
- Editable page-by-page review
- Illustration direction for every page
- Page-turn-style reading experience
- Browser-based draft saving
- Responsive layout

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3000.

## Connect Claude

In `.env.local`:

```bash
STORY_PROVIDER=anthropic
ANTHROPIC_API_KEY=your_key_here
ANTHROPIC_MODEL=claude-sonnet-4-5
```

## Connect OpenAI

```bash
STORY_PROVIDER=openai
OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4.1-mini
```

## Deploy to Vercel

1. Upload this folder to a GitHub repository or run `vercel` from the project folder.
2. Add the same environment variables in Vercel Project Settings.
3. Deploy.

## Current limitation

This version creates illustration prompts but does not yet call an image-generation API. That is the intended next layer after the story-writing flow is approved.

## Reliability + Cover Update

This build adds automatic retry and safer JSON parsing for story generation, rotating progress messages, stronger character continuity instructions for page art, and optional generated cover artwork.
