# Jarvis — a personal AI voice assistant for iPhone

A SwiftUI app (plus a widget, a share-sheet extension, and a custom keyboard) you build and install yourself. Speak to it, and it acts.

## What it does

| Say / do | What happens |
|---|---|
| "What's my day look like?" | Reads your **calendar** and speaks a Claude-written morning briefing |
| "Email Sarah about moving the meeting" | Claude drafts the full email, recipient resolved from **Contacts**, mail sheet pre-filled — or **actually sent via Gmail** if connected |
| "Check my email" | **Gmail autopilot**: reads unread mail, triages it (urgent/work/newsletter…), drafts replies, sends them when you approve — one tap, really sent |
| "Text Anna I'm running late" | Claude writes the message, number resolved from Contacts, iMessage sheet pre-filled |
| "Play Daft Punk" | Opens **Spotify** straight into the search results |
| "Turn off the living room lights" / "movie night" | **HomeKit** — scenes and switches, no confirmation needed |
| "Remind me to call the dentist at 3" | Local **notification** at 3:00 |
| "Remind me to water the plants when I get home" | **Geofenced** reminder at your saved Home location |
| "How did I sleep this week?" | **HealthKit** digest: sleep, workouts, steps — narrated by Claude |
| 📷 camera button | **Jarvis Vision** — photograph anything, ask about it (menus, plants, contracts) |
| Share sheet → Jarvis | Send articles/text from any app; Jarvis summarizes and extracts action items |
| **Jarvis Keyboard** in any app | Copy a received message → tap ✨ → three Claude-drafted replies, tap to insert (works inside iMessage/WhatsApp/Slack) |
| Lock-screen **widget** | Your next events; tap for a spoken briefing |
| "Hey Siri, ask Jarvis" / Action Button | Hands-free entry via App Intents ("Jarvis briefing" works too) |
| Anything else | Claude answers, spoken aloud |

The interface is a dark, futuristic **animated orb** — it breathes when idle, reacts to your voice level while listening, spins while processing, and ripples while speaking. Tap the orb to talk.

**Jarvis's voice:** with a free [elevenlabs.io](https://elevenlabs.io) API key (Settings → Jarvis voice), Jarvis speaks with a deep cinematic British voice (ElevenLabs "Daniel"). Without one, it automatically picks the best British voice on your iPhone — download a premium one under Settings → Accessibility → Spoken Content → Voices → English (UK) for a big free upgrade.

## What iOS will never allow (so you don't chase it)

- ❌ Always-listening "Hey Jarvis" wake word (Siri is the only wake word — use "Hey Siri, ask Jarvis" or map the **Action Button** to the Ask Jarvis shortcut)
- ❌ Reading incoming iMessages/SMS or sending texts silently (the keyboard extension is the legal workaround for drafting anywhere)
- ❌ Sending via Apple Mail silently (Gmail API is the workaround — it *can* really send)

## Repo layout

```
Jarvis/            Main app
  Core/            View model, command router, Claude client, Keychain
  Speech/          Speech-to-text + text-to-speech
  Actions/         Spotify, mail/message sheets, notifications
  Services/        Calendar, Contacts, HomeKit, Health, Gmail, Places
  Views/           Inbox triage, Vision, Shared items
  Intents/         Siri App Intents
JarvisWidget/      Lock/home-screen agenda widget
JarvisShare/       Share-sheet extension
JarvisKeyboard/    Reply-drafting keyboard extension
Shared/            App-group storage shared by all targets
project.yml        XcodeGen project definition (4 targets)
```

## Build & install

You need a Mac with **Xcode 15+**, an iPhone on **iOS 17+**, and an Apple ID.

```bash
brew install xcodegen
git clone <this repo> && cd <repo>
# 1. Pick your own identifiers (must be globally unique):
#    - replace "com.yourname" in project.yml
#    - replace "group.com.yourname.jarvis" in project.yml AND Shared/AppGroup.swift
xcodegen generate
open Jarvis.xcodeproj
```

Then in Xcode:

1. For **each of the 4 targets**: Signing & Capabilities → set *Team* to your Apple ID.
2. Plug in your iPhone, select it, **⌘R**.
3. On the phone: Settings → General → VPN & Device Management → trust your certificate.
4. In the app: Settings gear → paste your **Claude API key** ([console.anthropic.com](https://console.anthropic.com)).
5. Grant permissions as prompted (mic, speech, notifications; calendar/contacts/health/home/location are requested on first use of each feature).

> **Free Apple ID note:** free "personal team" signing supports HealthKit, HomeKit, and App Groups, but builds expire after 7 days (re-run ⌘R). Push notifications need a paid developer account. If signing complains about an entitlement, delete that entitlement from `project.yml`, regenerate, and that one feature degrades gracefully.

### Gmail autopilot setup (optional, ~5 minutes, free)

1. [console.cloud.google.com](https://console.cloud.google.com) → new project → **Enable APIs** → Gmail API.
2. OAuth consent screen → External → add yourself as a test user.
3. Credentials → **Create OAuth client ID** → type **iOS** → bundle ID `com.yourname.Jarvis`.
4. Copy the client ID (`…apps.googleusercontent.com`) into Jarvis Settings → Connect Gmail.

### Keyboard setup (optional)

iPhone Settings → General → Keyboard → Keyboards → Add New Keyboard → **Jarvis Keyboard** → tap it → **Allow Full Access** (needed for clipboard + network). Then enable "Share API key with Jarvis Keyboard" in the app's settings.

### Hands-free & automation ideas

- Map the **Action Button** (Settings → Action Button → Shortcut → Ask Jarvis).
- Shortcuts app → Automation → time of day → **Jarvis Briefing** = spoken briefing every morning when you pick up the phone.
- Add the **Jarvis Agenda** widget to your lock screen.

## Notes

- Everything runs on-device except calls to the Claude API (and the Gmail API when you use it). Keys live in the Keychain; the keyboard uses opt-in app-group storage.
- The keyboard uses Haiku (fast/cheap) for reply suggestions; the app uses Sonnet — change models in `ClaudeService.swift` / `KeyboardViewController.swift`.
- Not built here: a push-notification server for *proactive* alerts ("your 2pm was cancelled") — that requires a backend and a paid Apple developer account. Ask Jarvis's author (me) when you want it.
