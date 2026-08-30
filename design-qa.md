# Design QA

## Comparison target

- Source visual truth: `/var/folders/7y/jrz7vkm90jz146xmd_5fttdh0000gn/T/codex-clipboard-f41bd6c8-1c90-4f39-8cbe-b7ea8ae0034b.png`
- Source crops: `design-source-summary.png`, `design-source-iglesia.png`, `design-source-invitados.png`
- Browser-rendered implementation: `http://localhost:4173/`
- Implementation captures: `implementation-mobile-screen.png`, `implementation-iglesia-screen.png`, `implementation-invitados-screen.png`
- Side-by-side evidence: `design-comparison.png`, `design-comparison-iglesia.png`, `design-comparison-invitados.png`
- State: iPhone, light theme, mock data, wedding date not configured, default filters.

## Viewport and normalization

- App-owned screen measured in the browser: 393 x 852 CSS px at devicePixelRatio 1.
- Browser viewport used for the fidelity pass: 1400 x 1200 CSS px.
- The in-app browser screenshot surface returned 1400 x 1002 px. The visible app region was cropped at 393 x 826 px and padded by 26 px only below the runtime-owned safe area. The app element itself measured exactly 393 x 852 px before every capture.
- Source artboards measured approximately 344 x 742 px inside the supplied board and were normalized to 393 x 852 px.
- Device bezel, live status bar, home indicator and Android navigation bar are template-owned runtime chrome. The supplied source omits them, so fidelity judgments apply to the app-owned content below the status bar.

## Full-view comparison evidence

- Resumen: `design-comparison.png`
- Iglesia: `design-comparison-iglesia.png`
- Invitados: `design-comparison-invitados.png`

The three boards compare the normalized source on the left and the browser-rendered implementation on the right. No extra focused crop was needed because the normalized 393 px captures preserve readable titles, metadata, badges, icons and card edges at original detail.

## Required fidelity surfaces

- Fonts and typography: Instrument Serif 400 is used for display titles and numbers. Instrument Sans 400/500/600 is used for UI copy. The hierarchy, line height and compact label scale match the source. Runtime status chrome keeps the device system font by design.
- Spacing and layout rhythm: 18 px page gutters, 20-22 px radii, compact 8-14 px vertical gaps and elevated white surfaces reproduce the source rhythm. Persistent bottom navigation reserves the real device safe area.
- Colors and tokens: paper `#F5F1EC`, surface `#FFFFFF`, ink `#1C1917`, terracotta `#C0563D`, sage `#6F7F63` and the urgent tint map directly to the supplied specification. Contrast remains readable in labels, buttons and form states.
- Image quality and asset fidelity: the source contains no photographic or illustrative assets. All interface icons use one installed Radix icon family. Progress rings are data visualizations, not image substitutes. Device assets remain owned by the protected mobile runtime.
- Copy and content: the visible Spanish copy is coherent and preserves the source labels and realistic mock names. The placeholder wedding date remains explicit because the real date was not provided.
- Interaction states: navigation, responsibility filters, guest filters, search, sheets, optimistic task completion, RSVP, transport, local persistence, keyboard dismissal, empty states, disabled form actions and connection success/error copy are implemented.
- Responsiveness and accessibility: verified at iPhone 393 x 852 and Pixel 10 427 x 952. Pixel reported matching scroll and client widths of 427 px with no horizontal overflow. Controls have semantic names, minimum practical tap targets and reduced-motion fallbacks.

## Comparison history

### Iteration 1

- P1 bottom navigation labels could sit under the iOS home indicator. Fixed by sizing and padding from the runtime device safe-area token.
- P1 focusing a simulated input could leave the device screen scrolled after the keyboard closed. Fixed by restoring the protected screen scroll position whenever the keyboard closes or the app screen changes.
- P2 the Invitados back affordance shifted the title away from the source. Removed it because the persistent navigation already provides the return path.
- P2 the default Invitados state did not surface the two recently confirmed groups shown in the source. Reordered the visible feed while keeping the remaining pending groups available below.
- P2 completed Iglesia rows were denser than the source. Removed completed-row metadata and added the corte confirmation indicator to the active row.

### Iteration 2

- Re-captured Resumen, Iglesia and Invitados without the preview cursor.
- Side-by-side review found no remaining actionable P0, P1 or P2 mismatch. The live status bar, device bezel, safe-area height and settings gear are accepted functional/runtime differences.

## Primary interactions tested

- Opened all bottom-navigation destinations.
- Marked a task complete, reloaded, confirmed persistence, and restored the fixture.
- Changed Familia Restrepo to Confirmado and Transporte Interno, reloaded, confirmed persistence, and restored the fixture.
- Searched for Ana María Gómez and confirmed the filtered result.
- Set a wedding date, confirmed the formatted date and countdown, then restored the placeholder state.
- Switched to Pixel 10 and checked that the interface has no horizontal overflow.
- Checked browser console warnings and errors: none.

## Verification

- `npm run check:runtime`: passed.
- `npm run build`: passed.
- `npm run test:sites`: 4 tests passed.
- `node --check < apps-script/Codigo.gs`: passed.

## Follow-up polish

- P3: the summary adds a settings gear and subtle row chevrons that are not present in the source. They are intentionally retained as functional affordances.

final result: passed
