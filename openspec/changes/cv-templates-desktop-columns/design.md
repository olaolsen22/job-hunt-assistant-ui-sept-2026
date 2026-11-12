# Design

## Context

`rework-cv-template-flow` (uncommitted) left `/cv-templates` as one full-width column, and `new.vue` and `[id].vue`
inside `max-w-3xl`. `Editor.vue` renders the AI actions, then `CvContentEditor`, then a Layout card whose fields sit
in a `md:grid-cols-2` grid. The default layout's sidebar leaves about 800px of content at 1024 and about 1200px at 1440. ui-ux-expert was consulted. Its advice is followed except where noted below.

## Decisions

1. **List grid:** `grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-3`. Rows become cards with `h-full flex
flex-col`, and actions sit at the bottom. The row's `md:flex-row` inline layout goes, because cards are narrow
   in the grid. Skeleton and empty states use `col-span-full`. `xl` rather than `lg`, because at 800px a single
   card reads better than two 390px ones.
2. **Page split:** `grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]`, replacing
   `max-w-3xl`. The arbitrary track value is needed for a fixed rail beside a fluid main column; Tailwind has no
   default for it. The profile page's `lg:grid-cols-3` would squeeze the CV text to about 530px at 1024.
3. **Rail inside Editor:** `cvTemplates/Editor.vue` already owns the Layout card and the save bar, so it holds
   the grid itself and takes a `#rail` slot for the page's cards (the new template's Details). This replaces the
   planned `LayoutCard` extraction, which would have needed the same grid in two pages. The rail has `lg:sticky
lg:top-4 lg:self-start lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto lg:p-px`, where `p-px` keeps card borders
   from being clipped. Layout fields stay two columns on tablet and stack in the rail.
4. **Source order:** below `lg` both columns are `display: contents`, so their children sit in the single-column
   order (the Details card `order-first`, the content, Layout, then the save bar `order-last`). The save bar's
   sticky containing block also stays the page on phone.
5. **Kept as is (deviates from ui-ux-expert):** Save/Create and language tabs stay where they are. Moving them is a
   flow change the owner didn't ask for, and the header already holds them.

## Risks

- A sticky rail inside the scroll container: check that the default layout's main element scrolls, not the window,
  and adjust `top` accordingly. Verify with screenshots at 1024 and 1440.
- The tailored CV page shares `CvContentEditor` but is untouched.
