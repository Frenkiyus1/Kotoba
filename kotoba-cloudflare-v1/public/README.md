# KOTOBA frontend

HTML, CSS and browser scripts for the Cloudflare Worker/D1 Japanese-learning app.

## Run

Run `npm run dev` from the parent `kotoba-cloudflare-v1` folder for the frontend and API. See the project README for database setup.

For a static layout preview only, run `python -m http.server 8000` from this folder and open `http://localhost:8000`. A static server does not provide login, saved learning state or Workers AI. Use localhost or HTTPS instead of opening HTML with `file://` for browser audio.

## Main flow

1. `index.html` — homepage
2. `start.html` — login/register
3. `onboarding.html` — JLPT level, goal, daily minutes and study time
4. `dashboard.html` — daily plan and recommendations
5. `roadmap.html` — JLPT route
6. `lesson.html` — Shu/Ha/Ri sample lesson and selection dictionary
7. `biology.html` / `biology-lesson.html` — biology route and sample lesson
8. `review.html` — topic flashcards and spaced repetition
9. `personalized.html` — practice based on recorded mistakes
10. `conversation.html` — Japanese conversation scenarios
11. `progress.html` / `profile.html` — learning records and settings
12. `guide.html` — learner instructions

## Dictionary interaction

In a supported lesson:

1. Select a Japanese word or sentence.
2. Press the visible selection lookup button on desktop or touch devices; right-click lookup is also available.
3. Choose Meaning or Reading, or type an optional question and press Lookup. Microphone input is optional.
4. Inspect the result. A suitable word is added to personal flashcards; long selections are not saved as cards.

The frontend calls `/api/dictionary`. Known entries can also fall back to `dictionary-data.js`, including a kana reading lookup. For broader coverage, `window.KOTOBA_DICTIONARY_ENDPOINT` can point to an endpoint accepting JSON `{ selection, context, question }` and returning the same entry shape. Errors and a timeout leave lookup controls available for retry.

## Flashcards and contents

Review supports Japanese → Vietnamese and Vietnamese → Japanese. Reverse cards show only the Vietnamese meaning on the front; the Japanese term, reading and example appear after flipping. Click, Enter and Space flip the card. Switching direction preserves the selected topic and current position, resets to the front, and does not change the review schedule. Direction is remembered per account in this browser.

The learning contents disclosure links available pages and lesson phases. Phase links switch the existing Shu/Ha/Ri tabs and can be opened directly via the URL hash. Unpublished lessons are not advertised as available.

## Furigana

Lessons, dictionary results, review cards, personal exercises and chat bubbles use native HTML ruby annotations. The Furigana button toggles readings; profile settings also support revealing them on hover, tap or keyboard focus. The choice is stored per account in this browser. Copying and dictionary selection retain the original text without the reading annotations.

Readings come from `dictionary-data.js`, the learner's deck and the supplemental lesson vocabulary in `furigana.js`. Kanji compounds and okurigana are aligned to supplied kana; unknown words and ambiguous alignments stay unchanged. A custom card's Reading field supplies its furigana. No external pronunciation service is called.

## Listening and speaking

`speech.js` shares one speech-recognition session and one playback session across lessons, dictionary lookup and conversation. Starting another session stops the previous one. It restores button state after completion, errors and timeouts, and ignores stale callbacks.

Recognition uses supported browser speech APIs in Japanese. Microphone, permission, network and browser-support errors are visible; editable text remains available. Conversation sends a final recognized sentence to the teacher; a lesson microphone only fills the answer field for the learner to check.

Playback uses a Japanese browser/device voice when available. The conversation Listen button replays the latest teacher reply, including after automatic playback is blocked. Missing voices and playback errors are reported. Automated checks simulate browser audio; physical microphones and installed voices need device testing.

## AI conversation and support

`/api/ai/conversation` receives the scenario, current text and up to 20 previous messages. The Worker calls Cloudflare Workers AI using the `AI` binding and the learner level stored in D1. N5 responses are prompted to use short, simple sentences and kana for difficult kanji. API errors preserve the entered question for retry; changing scenarios resets history.

The bottom-right support widget calls `/api/ai/support` for concise app guidance. It is available before login, uses the same Workers AI binding, and does not access account state or change data. Quick-help buttons are labeled as existing guidance separately from AI replies. Questions remain available after an error, and support history stays only in the current page's memory. The compact panel keeps input and Send reachable when a phone keyboard reduces the viewport height.

## Storage and verification

Authentication and saved preferences, vocabulary, review schedules and progress use the Worker/D1 backend. The browser stores the session token and per-account display choices such as language, furigana and review direction, plus a local state cache.

Run `npm test` from the project folder. Tests use an in-memory database and mocked AI/browser speech APIs; they do not call a live Cloudflare account or verify audio hardware.
