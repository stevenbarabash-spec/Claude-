# Jarvis — a personal voice assistant for iPhone

A SwiftUI app you build and install yourself (free Apple ID works) that:

- 🎙️ **Listens to voice commands** — tap the mic (or say "Hey Siri, ask Jarvis…") and speak naturally.
- ✉️ **Writes emails for you** — "Email Sarah about moving the meeting to Friday" → Claude drafts it, the iOS mail sheet opens pre-filled, you hit send.
- 💬 **Drafts text replies** — "Text Mike that I'm running 15 minutes late" → Claude writes the message, the iMessage sheet opens pre-filled.
- 🔔 **Sends you notifications** — "Remind me to call the dentist at 3pm", plus an optional scheduled daily briefing.
- 🎵 **Controls Spotify** — "Play Bohemian Rhapsody" opens Spotify straight into the song.
- 🧠 **Answers anything else** — everything that isn't a command goes to Claude and the answer is spoken back with a synthesized voice.
- 🗣️ **Siri integration** — App Intents expose "Ask Jarvis" so you can trigger it hands-free via Siri or the Action Button.

## What iOS allows (honest capability matrix)

| You asked for | What's possible on iOS | How this app does it |
|---|---|---|
| Voice commands | ✅ Fully, while app is open | `SFSpeechRecognizer` live transcription |
| Always-on "Hey Jarvis" wake word | ❌ Apple doesn't allow background mic access | Use **"Hey Siri, ask Jarvis"** (App Intent) or map the **Action Button** to the Ask Jarvis shortcut |
| Write & send emails | ⚠️ Apps can draft but can't send silently | Claude drafts → pre-filled mail sheet → you tap Send (one tap) |
| Read incoming texts / auto-reply | ❌ Apps cannot read SMS/iMessage | You dictate the reply → Claude polishes it → pre-filled message sheet → you tap Send |
| Notifications | ✅ Fully | `UserNotifications` — voice-created reminders + daily briefing |
| Open Spotify & play a song | ✅ | `spotify:search:` deep link (or full playback control if you add the Spotify iOS SDK later) |

## Project layout

```
Jarvis/
├── JarvisApp.swift              # App entry point
├── ContentView.swift            # Main UI: mic button, transcript, response
├── SettingsView.swift           # Claude API key + daily briefing settings
├── Core/
│   ├── JarvisViewModel.swift    # Orchestrates listen → route → act → speak
│   ├── CommandRouter.swift      # Turns a transcript into an action
│   ├── ClaudeService.swift      # Claude API client (drafting + Q&A)
│   └── KeychainHelper.swift     # Stores your API key in the Keychain
├── Speech/
│   ├── SpeechRecognizer.swift   # Live speech-to-text
│   └── SpeechSynthesizer.swift  # Jarvis talks back
├── Actions/
│   ├── SpotifyController.swift  # Deep links into Spotify
│   ├── EmailComposer.swift      # Pre-filled mail sheet
│   ├── MessageComposer.swift    # Pre-filled iMessage sheet
│   └── NotificationManager.swift# Reminders + daily briefing
└── Intents/
    └── JarvisAppIntents.swift   # "Hey Siri, ask Jarvis" shortcuts
```

## Build & install (on your Mac)

You need: a Mac with **Xcode 15+**, an iPhone (iOS 17+), and a free Apple ID.

### Option A — XcodeGen (recommended, zero clicking)

```bash
brew install xcodegen
git clone <this repo> && cd <repo>
xcodegen generate
open Jarvis.xcodeproj
```

### Option B — manual

1. Xcode → New Project → iOS App → name it `Jarvis`, SwiftUI, Swift.
2. Delete the generated `ContentView.swift`/`JarvisApp.swift`, then drag the `Jarvis/` folder from this repo into the project (check "Copy items if needed").
3. In the target's **Info** tab add:
   - `NSMicrophoneUsageDescription` — "Jarvis listens for your voice commands."
   - `NSSpeechRecognitionUsageDescription` — "Jarvis transcribes what you say."
   - `LSApplicationQueriesSchemes` — array with one item: `spotify`

### Then, for either option

1. Select the Jarvis target → **Signing & Capabilities** → set *Team* to your Apple ID (Personal Team).
2. Plug in your iPhone, pick it as the run destination, press **⌘R**.
3. On the phone: Settings → General → VPN & Device Management → trust your developer certificate.
4. Open the app → Settings gear → paste your **Claude API key** (get one at [console.anthropic.com](https://console.anthropic.com)).
5. Grant microphone, speech-recognition, and notification permissions when prompted.

> Free Apple ID builds expire after 7 days — just press ⌘R again to reinstall. A paid developer account ($99/yr) removes that limit and enables TestFlight.

## Try saying

- "Play Daft Punk"
- "Email John about rescheduling tomorrow's standup to 2pm"
- "Text Anna that I'll be there in 20 minutes"
- "Remind me to take out the trash at 8pm"
- "What's the capital of Mongolia?"

## Extending it

- **Real Spotify playback control** (play/pause/skip without leaving the app): add the [Spotify iOS SDK](https://developer.spotify.com/documentation/ios) and a Spotify developer app token.
- **Calendar awareness**: add `EventKit` and feed today's events into the daily briefing prompt.
- **Better hands-free**: map the iPhone **Action Button** to the "Ask Jarvis" shortcut for one-press activation.
