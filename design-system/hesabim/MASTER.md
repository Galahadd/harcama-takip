# Hesabım dashboard design system

## Scope

Harcamalar, Yatırımlar and Ayarlar share this system. The standalone video login remains independent.
Existing API contracts, ownership boundaries, parsing and financial calculations are unchanged.

## References and selection

- UI/UX Pro Max: Minimalism & Swiss Style and Data-Dense Dashboard recommendations; readable values, visible filters, keyboard navigation, reduced motion and explicit empty/loading/error states.
- [AdminCN — Shadcn Admin Dashboard Template](https://21st.dev/community/templates/admincn-shadcn-admin-dashboard-template): listed with price 0 in the 21st MCP catalog. The public preview was reviewed. Source download on 21st is paid; no gated source was retrieved or copied. Original components implement the dashboard layout direction using the project's existing dependencies.
- [MotionSites AI Runtime](https://motionsites.ai/?prompt=ai-runtime): the user-selected free prompt was retrieved through the connected plugin. Only its exact hosted background video is used; its landing-page copy, statistics, fonts and navigation are not imported.

## Visual decisions

- Fixed deep-navy sidebar on desktop; three labeled bottom navigation destinations on mobile.
- Full-viewport AI Runtime video canvas, a dark contrast scrim, white page headings and opaque white data panels; coordinated dark panels when dark mode is selected. Navigation and financial data keep their existing layout and typography.
- Violet primary actions and featured totals connect the app to the existing login.
- Green/red indicate financial gain/loss with numeric signs and labels. Gold is reserved for gold assets and installment metadata.
- Plus Jakarta Sans with system fallback; tabular numbers for values and table cells.
- 8/12/16/24/32px spacing; 12–16px card radii; subtle borders and shadows.
- One clear add-record primary action per page. Filters remain separate from mutations.
- Native modal dialogs contain expense entry, statement preview/import and investment entry. Persistent records stay in the main page.

## Data presentation

- No invented balances, price history or growth percentages.
- Expense charts aggregate small categories when needed; complete category amounts remain available.
- Installment charts use existing server projections, not estimated cashflow.
- Investment composition uses saved gram equivalents; current value still uses the existing 22/24-carat quotes and calculation helpers.
- Search, filters, visible sort state, selection and ten-row pagination keep tables manageable.
- Ownership and create/update/delete calls remain server-enforced and unchanged.

## Motion and accessibility

- Only the decorative AI Runtime video moves continuously. The existing persistent motion preference pauses playback; reduced motion and hidden tabs also pause it. A static CSS backdrop remains if the media cannot load or autoplay is blocked. No video autoplay attribute is used, so accessibility preferences are checked before playback.
- No chart entrance animation. Loading placeholders reserve chart/table space.
- Inputs have visible labels; icon controls have names; tables have captions and scrollable named regions.
- Native dialogs trap focus, close on Escape, and restore focus to their triggers.
- Theme and motion preferences synchronize between settings and the app shell and persist in browser storage.

## Responsive validation

Target widths: 375/390, 768, 1024 and 1440px. Only data tables may scroll horizontally within their region. No document-level horizontal overflow.
