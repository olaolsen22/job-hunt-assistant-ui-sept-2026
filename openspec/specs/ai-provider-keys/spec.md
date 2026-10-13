# ai-provider-keys Specification

## Purpose

Lets the owner run built-in AI on their own provider keys, cap each personal key's daily calls, and see which key
pays for a run.

## Requirements

### Requirement: Owner-only key sections

The Settings page SHALL show "Provider keys" and then "Daily limits" below "AI model" only when the signed-in user is
the Owner. A Guest SHALL see only "AI model", and no provider-key or limit request SHALL be sent for a Guest.

#### Scenario: Guest

- **WHEN** a Guest opens Settings
- **THEN** only the AI model section shows and neither `providerKeys` nor `llmCallLimits` is requested

### Requirement: Provider keys section

The section SHALL list one row per provider returned by `providerKeys`: its name, "Key •••• <last4>" with the date it
was added when configured, otherwise "Not set". A configured row SHALL offer Replace and Remove; an unconfigured row
SHALL offer Set key. Set and Replace SHALL open a modal with a single password field; the key SHALL be sent only as
a GraphQL variable and SHALL NOT be stored, logged or shown again, and the field SHALL be cleared when the modal
closes. Remove SHALL ask for confirmation. A `ProviderKeyError` SHALL show its message in the modal (or as a toast
for Remove) and leave the row unchanged. After a successful set or remove, the row SHALL show the returned metadata
and the models and daily limits SHALL be fetched again. While loading the section SHALL show a loading state; if
loading fails it SHALL show an error.

#### Scenario: Set a key

- **WHEN** the owner enters a key for `openai` and saves
- **THEN** `setProviderKey` is sent with the key as a variable, the modal closes, the row shows "Key •••• 9xQ2",
  and the models are re-fetched

#### Scenario: Invalid key

- **WHEN** `setProviderKey` returns a `ProviderKeyError` with code `invalid-key`
- **THEN** the modal stays open with the error message and the row still shows "Not set"

#### Scenario: Remove a key

- **WHEN** the owner confirms removing the `anthropic` key
- **THEN** `removeProviderKey` is sent, the row shows "Not set", and the models are re-fetched

### Requirement: Daily limits section

The section SHALL list one row per entry of `llmCallLimits`, showing "No limit" when `dailyRequestLimit` is null,
"Paused" when it is 0, otherwise "<requestsConsumed> of <dailyRequestLimit> used" with remaining requests and the
reset time. An Edit action SHALL open a modal to choose No limit, Pause, or a positive daily number, saved with
`setLlmCallLimit`; an error SHALL show its message in the modal. The section SHALL say that the app's shared Gemini
key has no limit here. With no rows it SHALL show an empty state pointing to adding a provider key.

#### Scenario: Set a daily allowance

- **WHEN** the owner sets `openai` to 50
- **THEN** `setLlmCallLimit` is sent with 50 and the row shows "0 of 50 used" with the reset time

#### Scenario: Pause a provider

- **WHEN** the owner chooses Pause for `mistral`
- **THEN** `setLlmCallLimit` is sent with 0 and the row shows "Paused"

### Requirement: Key source shown

In the AI model select, a model whose `keySource` is `USER` SHALL be marked as using the owner's own key. The paid-AI
notice SHALL say runs are billed to the app's AI key when the default model uses the shared key, and to "your own
<provider> key" when it uses the owner's key, adding the remaining daily requests when that provider has a limit.

#### Scenario: Default on own key

- **WHEN** the default model is `openai:gpt-4.1-mini` with key source `USER` and `openai` has 12 requests left
- **THEN** the notice says runs are billed to your own OpenAI key with 12 requests left today
