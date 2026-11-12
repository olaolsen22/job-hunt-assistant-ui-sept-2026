# Spec Delta

## Purpose

Defines how short-lived toast notifications look and behave across the app, so every confirmation,
warning and error reads the same way on phones, tablets and desktops.

## ADDED Requirements

### Requirement: Toast kinds

Every toast SHALL be one of five kinds, each with a fixed color and icon: success (success color,
check icon), error (error color, alert icon), warning (warning color, triangle-alert icon), info
(neutral color, info icon) and undoable (neutral color, an icon for the undone action). No toast
SHALL render without a kind's color, so a non-success message never appears in the success color.

#### Scenario: Removal is not shown as a success

- **WHEN** the owner removes an entry from a CV and the removal toast appears
- **THEN** it uses the neutral color, not the success color, and offers Undo

#### Scenario: Every error has an icon

- **WHEN** any error toast appears, including the generic "Something went wrong" message
- **THEN** it uses the error color and the alert icon

### Requirement: Toast position

Toasts SHALL appear at the bottom right of the screen. On phones they SHALL span the width minus the
page margin, at the bottom, so they never cover the header, the menu button or the page's actions at
the top. While a sticky bottom bar is shown, toasts SHALL sit above it.

#### Scenario: Phone

- **WHEN** a toast appears on a 375px wide screen
- **THEN** it sits at the bottom of the screen and the header and the top page actions stay visible

#### Scenario: Sticky bottom bar

- **WHEN** a toast appears while a sticky bottom bar is shown (a save bar, or the skills or
  companies selection bar)
- **THEN** the toast sits just above the bar, so the bar's buttons stay visible and usable

#### Scenario: Desktop

- **WHEN** a toast appears on a 1440px wide screen
- **THEN** it sits in the bottom right corner at a fixed width

### Requirement: Toast durations

Success toasts SHALL close after 4 seconds, info toasts after 5 seconds, and error, warning and
undoable toasts after 8 seconds. Hovering a toast SHALL pause its timer. The update-available toast
SHALL stay until it is dismissed or acted on. Every toast SHALL have a close button. Toasts SHALL NOT
show a progress bar.

#### Scenario: Undo window

- **WHEN** an undoable toast appears
- **THEN** it stays for 8 seconds unless closed, and shows no progress bar

#### Scenario: Update available stays

- **WHEN** a new app version is available
- **THEN** the update-available toast stays with its Reload action until dismissed

### Requirement: Toast actions

A toast SHALL have at most one action, styled as a neutral outline button at the app's normal touch
size. The update-available Reload SHALL be the only solid primary toast action.

#### Scenario: Consistent action buttons

- **WHEN** toasts with Undo, View listing and Daily limits in Settings actions appear
- **THEN** all three actions share the same style and size

### Requirement: Toast stacking

At most 3 toasts SHALL be visible at once. A toast with the same message as one already visible SHALL
replace it instead of stacking a copy.

#### Scenario: Repeated error

- **WHEN** the same save fails twice in a row
- **THEN** only one copy of the error toast is visible

#### Scenario: Many toasts

- **WHEN** four different toasts are raised in quick succession
- **THEN** no more than 3 are visible

### Requirement: Toast copy

Toast titles SHALL use sentence case with no trailing full stop and SHALL name the affected item when
it is known. A description SHALL be added only when it gives a next step or the remaining state. API
error messages SHALL be shown as the API sends them.

#### Scenario: Archive names the listing

- **WHEN** the owner archives the listing "Frontend Developer" from the listings list
- **THEN** the toast says "Archived Frontend Developer" and offers Undo

### Requirement: No undo of an undo

Toasts that confirm an Undo or an Unarchive SHALL be plain success toasts without an Undo action.

#### Scenario: Unarchive

- **WHEN** the owner presses Undo on the Archived toast, or unarchives a listing from the list
- **THEN** a success toast confirms it without offering Undo again

### Requirement: Blocked actions explained as warnings

When an action is refused because of unsaved changes or a missing prerequisite, the app SHALL explain
it with a warning toast, not an info or success toast.

#### Scenario: Unsaved changes block adding a language

- **WHEN** the owner tries to add a language to a CV template with unsaved changes
- **THEN** a warning toast says to save or discard the changes first

### Requirement: No redundant confirmation toasts

The app SHALL NOT show a success toast for an action whose control already shows the result, such as
a copy button that changes to "Copied". Failures of such actions SHALL still show an error toast.

#### Scenario: Copy as text

- **WHEN** the owner copies a tailored CV or cover letter as text and the copy works
- **THEN** the button shows it was copied and no toast appears

#### Scenario: Copy fails

- **WHEN** the clipboard write is refused
- **THEN** an error toast says the copy failed
