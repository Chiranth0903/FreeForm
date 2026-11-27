# FreeForm AI

A voice-guided Chrome extension that helps you fill an enrollment form one answer at a time. It reads a question aloud, listens to your answer, and asks for confirmation before writing it into the form.

Current extension version: **1.2.3**.

## Features

- Spoken questions and voice answers with yes/no confirmation.
- English India, US, and UK recognition options.
- Pause/resume, field selection, typed answers, and rescanning for newly visible fields.
- Voice commands for navigation, corrections, and undo.
- Support for standard visible text inputs, textareas, selects, radio groups, and checkboxes.
- Local demo and automated tests, with no npm dependencies or API keys.
- You review and submit the form yourself; the extension never submits it.

## Install in Chrome

### Easiest option: ready-to-install ZIP

1. Download [FreeForm-AI-Ready-to-Install.zip](voice-form/FreeForm-AI-Ready-to-Install.zip) using GitHub's download button.
2. Right-click the ZIP and choose **Extract All**.
3. Open `chrome://extensions` in Chrome and enable **Developer mode**.
4. Click **Load unpacked** and choose the extracted folder with `manifest.json` directly inside it.
5. Open the [supported enrollment form](https://form.123formbuilder.com/7008640/health-insurance-enrollment-form).
6. Click **FreeForm AI** in Chrome's Extensions menu, then **Start conversation**. Allow microphone access when prompted.

Chrome cannot load the ZIP itself. If it says "Manifest file is missing or unreadable", choose the folder that directly contains `manifest.json`, `background.js`, `assistant.js`, and `voice-session.js`.

### Install from source

Download this repository using **Code > Download ZIP** and extract it, or clone it:

```sh
git clone https://github.com/Chiranth0903/FreeForm.git
cd FreeForm
```

At `chrome://extensions`, enable Developer mode, click Load unpacked, and select **`voice-form/extension`** inside the extracted or cloned repository. The repository root is not the extension folder.

Node.js is only needed for the optional demo and tests, not for extension installation.

## How to use

1. Start the conversation and wait for the spoken question.
2. Speak your answer, then pause briefly.
3. When asked to confirm, say **yes** to fill the field or **no** to retry.
4. Continue through the fields, review the page, complete CAPTCHA manually, and submit yourself.

Ordinary answers wait for a short pause; yes/no confirmations can act on the first recognized word. Use the typed answer box when speech recognition gets spelling wrong. The microphone pauses while the assistant speaks.

| Command | Purpose |
| --- | --- |
| `skip` | Skip the current field |
| `back` | Return to the previous field |
| `stop` | Stop the conversation |
| `undo` | Undo a field change |
| `go to FIELD` | Navigate to a named field |
| `change FIELD to VALUE` | Request a correction and confirm it |

Example email: `alex at example dot com`. Use explicit dates such as `15 October 2005` or `2005-10-15`; ambiguous numeric dates are rejected. Select/radio answers must match available choices. Checkboxes accept yes/no.

## Local demo

With a recent Node.js version that supports `node --test`, run from the repository root:

```sh
node voice-form/serve.cjs
```

Open http://127.0.0.1:8765 in Chrome and activate the extension. Use fictional details. Stop the server with Ctrl+C.

## Tests

From the repository root:

```sh
node --test voice-form/test.cjs voice-form/voice-session.test.cjs
```

The 17 automated tests cover URL restrictions, permissions, date parsing, answer confirmation, speech timing, recognition restarts, microphone denial, cancellation, startup, and a complete simulated conversation. They simulate browser speech events; real microphone recognition and end-to-end filling of the live website still need manual verification.

## How it works

`background.js` handles the extension button, checks the active page URL, and injects `voice-session.js` and `assistant.js`. The page assistant discovers supported fields and coordinates spoken prompts, recognition, confirmation, and field updates. Commands use deterministic matching rather than an LLM.

The extension uses Manifest V3 with `activeTab` and `scripting` permissions. It does not request persistent access to all websites.

## Project files

| Path | Contents |
| --- | --- |
| `voice-form/extension/` | Loadable Chrome extension and manifest |
| `voice-form/demo/index.html` | Sample form for testing |
| `voice-form/serve.cjs` | Local demo server |
| `voice-form/test.cjs` | Extension and field-handling tests |
| `voice-form/voice-session.test.cjs` | Speech-session tests |
| `voice-form/FreeForm-AI-Ready-to-Install.zip` | Recommended shareable installation package |
| Other ZIPs in `voice-form/` | Earlier packages retained as project history; use the ready-to-install ZIP above |

## Scope and privacy

Currently enabled only for the enrollment URL above and `localhost` / `127.0.0.1`. This is a focused prototype, not a general assistant for every website.

No application backend, analytics, API keys, or answer persistence are used. Chrome speech recognition may send audio to its recognition provider and may require internet access. Microphone permission belongs to the current website because recognition runs on the page.

Custom widgets, iframes, shadow DOM, signatures, uploads, passwords, and conditional or multi-page sections may require manual handling. Segmented date controls work only when their segments expose editable inputs or contenteditable elements. CAPTCHA is always manual. Speech accuracy depends on your microphone, pronunciation, network, and Chrome's speech service.

## Troubleshooting and updates

- **Manifest missing:** Fully extract the package, then select the folder directly containing `manifest.json`. For repository downloads, that folder is `voice-form/extension`.
- **Nothing happens on another website:** Open the supported enrollment form or localhost demo before activating the extension.
- **Microphone denied:** Allow microphone access for the page in Chrome's site settings and start again.
- **Recognition connection errors:** Check your internet connection and retry; use typed answers when necessary.
- **New fields appear:** Click Rescan.
- **Updating source files:** Click Reload for FreeForm AI at `chrome://extensions`, then click the extension icon again. Refresh the form only if needed, as that may clear entered answers.
