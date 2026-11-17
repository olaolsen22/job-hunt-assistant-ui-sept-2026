# Nuxt UI v4 — props, slots and events of the components this app uses

Generated from https://ui.nuxt.com/raw/docs/components/<name>.md (Nuxt UI 4.11, Nov 2026). Native
HTML/router attributes are omitted. Every component also takes `ui` (slot class overrides) and `class`.
For types and examples, fetch that URL.

## UAlert

- props: title description icon avatar color variant orientation actions close closeIcon
- slots: leading title description actions close
- emits: update:open

## UBadge

- props: label color variant size square icon avatar leading leadingIcon trailing trailingIcon
- slots: leading default trailing

## UButton

- props: label color activeColor variant activeVariant size square block loadingAuto onClick icon avatar leading leadingIcon trailing trailingIcon loading loadingIcon autofocus disabled name type active to href external
- slots: leading default trailing

## UCard

- props: title description variant
- slots: header title description default footer

## UCheckbox

- props: label description color variant size indicator highlight icon indeterminateIcon disabled required name value id defaultValue modelValue trueValue falseValue autofocus
- slots: label description
- emits: change update:modelValue

## UCollapsible

- props: disabled defaultOpen open unmountOnHide
- slots: default content
- emits: update:open

## UDropdownMenu

- props: size items checkedIcon loadingIcon externalIcon content arrow portal labelKey descriptionKey filter filterFields ignoreFilter disabled defaultOpen open modal searchTerm
- slots: default item item-leading item-label item-description item-trailing empty content-top content-bottom
- emits: update:open update:searchTerm

## UEmpty

- props: icon avatar loading loadingIcon title description actions variant size
- slots: header leading title description body actions footer

## UFieldGroup

- props: size orientation
- slots: default

## UFormField

- props: name errorPattern label description help error hint size required eagerValidation validateOnInputDelay orientation
- slots: label hint description help error default

## UForm

- props: id schema state validate validateOn disabled name validateOnInputDelay transform nested loadingAuto
- slots: default
- emits: submit error

## UInputMenu

- props: id type placeholder color variant size required autofocus autofocusDelay trailingIcon selectedIcon deleteIcon clear clearIcon content arrow portal virtualize valueKey labelKey descriptionKey items defaultValue modelValue modelModifiers multiple highlight fixed mode createItem filterFields ignoreFilter disabled open defaultOpen name resetSearchTermOnBlur resetSearchTermOnSelect resetModelValueOnClear highlightOnHover loop openOnClick openOnFocus by icon avatar leading leadingIcon trailing loading loadingIcon readonly searchTerm
- slots: leading default trailing empty item item-leading item-label item-description item-trailing tags-item-text tags-item-delete content-top content-bottom create-item-label
- emits: update:open change blur focus create clear highlight remove-tag update:modelValue update:searchTerm

## UInput

- props: id name type placeholder color variant size required autofocus autofocusDelay disabled highlight fixed modelValue defaultValue modelModifiers icon avatar leading leadingIcon trailing trailingIcon loading loadingIcon max maxlength min minlength pattern readonly step
- slots: leading default trailing
- emits: update:modelValue blur change

## UModal

- props: title description content overlay scrollable transition fullscreen portal close closeIcon dismissible open defaultOpen modal unmountOnHide
- slots: default content header title description actions close body footer
- emits: leave after:leave enter after:enter close:prevent update:open

## UPagination

- props: firstIcon prevIcon nextIcon lastIcon ellipsisIcon color variant activeColor activeVariant showControls size to defaultPage disabled itemsPerPage page showEdges siblingCount total
- slots: first prev next last ellipsis item
- emits: update:page

## URadioGroup

- props: legend valueKey labelKey descriptionKey items modelValue defaultValue size variant color highlight orientation indicator disabled loop name required
- slots: legend label description
- emits: update:modelValue change

## USelectMenu

- props: id placeholder searchInput color variant size required trailingIcon selectedIcon clear clearIcon content arrow portal virtualize valueKey labelKey descriptionKey items defaultValue modelValue modelModifiers multiple highlight fixed createItem filterFields ignoreFilter autofocus autofocusDelay disabled open defaultOpen name resetSearchTermOnBlur resetSearchTermOnSelect resetModelValueOnClear highlightOnHover loop by icon avatar leading leadingIcon trailing loading loadingIcon searchTerm
- slots: leading default trailing empty item item-leading item-label item-description item-trailing content-top content-bottom create-item-label
- emits: update:open change blur focus create clear highlight update:modelValue update:searchTerm

## USelect

- props: id placeholder color variant size trailingIcon selectedIcon content arrow portal valueKey labelKey descriptionKey items defaultValue modelValue modelModifiers multiple highlight fixed autofocus autofocusDelay disabled open defaultOpen nullableValue name required icon avatar leading leadingIcon trailing loading loadingIcon
- slots: leading default trailing item item-leading item-label item-description item-trailing content-top content-bottom
- emits: update:modelValue update:open change blur focus

## USkeleton

- props:
- slots: default

## USlideover

- props: title description content overlay transition side inset portal close closeIcon dismissible open defaultOpen modal unmountOnHide
- slots: default content header title description actions close body footer
- emits: leave after:leave enter after:enter close:prevent update:open

## USwitch

- props: color size highlight loading loadingIcon checkedIcon uncheckedIcon label description disabled id name required value defaultValue modelValue trueValue falseValue autofocus
- slots: label description
- emits: change update:modelValue

## UTable

- props: data columns caption meta virtualize empty sticky loading loadingColor loadingAnimation globalFilterOptions columnFiltersOptions columnPinningOptions columnSizingOptions visibilityOptions sortingOptions groupingOptions expandedOptions rowSelectionOptions rowPinningOptions paginationOptions facetedOptions onSelect onHover onContextmenu state onStateChange defaultColumn getRowId getSubRows initialState globalFilter columnFilters columnOrder columnVisibility columnPinning columnSizing columnSizingInfo rowSelection rowPinning sorting grouping expanded pagination
- slots: expanded empty loading caption body-top body-bottom

## UTabs

- props: items color variant size orientation content valueKey labelKey defaultValue modelValue activationMode unmountOnHide
- slots: leading default trailing content list-leading list-trailing
- emits: update:modelValue

## UTextarea

- props: id name placeholder color variant size required autofocus autofocusDelay autoresize autoresizeDelay disabled rows maxrows highlight fixed defaultValue modelValue modelModifiers icon avatar leading leadingIcon trailing trailingIcon loading loadingIcon maxlength minlength readonly
- slots: leading default trailing
- emits: update:modelValue blur change

## UToast

- props: title description icon avatar color orientation close closeIcon actions duration progress defaultOpen open type
- slots: leading title description actions close
- emits: pause escapeKeyDown resume swipeStart swipeMove swipeCancel swipeEnd update:open

## Item shapes

- `UDropdownMenu` item: `label`, `icon`, `color`, `kbds`, `disabled`, `type: 'label' | 'separator' |
'checkbox' | 'link'`, `checked` + `onUpdateChecked` (checkbox), `to`, `children` (sub-menu),
  `onSelect(e)`, `slot`. Group with nested arrays: `[[edit, duplicate], [remove]]`.
- `UTabs` item: `label`, `icon`, `value`, `disabled`, `content`, `slot: 'x' as const`.
- `USelect` / `USelectMenu` / `UInputMenu` / `URadioGroup` items: primitives or objects with
  `label`, `value` (or set `label-key` / `value-key`), `description`, `icon`, `disabled`;
  `type: 'label' | 'separator'` for headings. `USelectMenu` without `value-key` binds the whole object.
