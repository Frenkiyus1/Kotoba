# KOTOBA UI v4

Static runnable prototype for the Japanese-learning product.

## Run

From this folder:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

Do not open the HTML files directly with `file://` if you want the most reliable browser behavior for microphone, speech and future API calls.

## Main flow

1. `index.html` — homepage
2. `start.html` — one gateway for login/register
3. `onboarding.html` — level, goal, Kaizen daily minutes, Shukan study time
4. `dashboard.html` — daily plan and adaptive recommendations
5. `roadmap.html` — normal JLPT route
6. `lesson.html` — Shuhari lesson + selection dictionary
7. `biology.html` — Biology × Japanese route
8. `biology-lesson.html` — cell lesson + dictionary + Shuhari
9. `review.html` — context-driven flashcards with simplified spaced repetition
10. `personalized.html` — exercises generated from stored mistakes
11. `conversation.html` — daily speaking scenarios
12. `progress.html` — progress and habit tracking
13. `profile.html` — learner settings

## Dictionary interaction

On `lesson.html` or `biology-lesson.html`:

1. Highlight a Japanese word or sentence.
2. Right click the highlighted text.
3. Choose `辞書で調べる`.
4. The AI gate asks `どんなことを知りたいですか？`.
5. Ask a specific question in Japanese, e.g. `この文ではどういう意味ですか？`.
6. Dictionary details are shown.
7. A looked-up word is automatically added to `今日の単語` and appears in `review.html`.

The included dictionary is a local demo dataset. For full Japanese-Vietnamese coverage, set `window.KOTOBA_DICTIONARY_ENDPOINT` to a backend endpoint that accepts JSON `{ selection, context, question }` and returns the same entry shape.

## AI conversation hook

The frontend calls `/api/ai/conversation` with the scenario, current text and up to 20 previous messages. The Worker calls Cloudflare Workers AI using the `AI` binding and the learner level stored in D1. API errors are visible and the learner can retry; changing scenarios resets conversation history.

## Storage

Prototype state is stored in browser `localStorage`:

- account and onboarding preferences
- daily task completion
- flashcards / review schedule
- mistake history
- basic progress

No production authentication or database is included.
