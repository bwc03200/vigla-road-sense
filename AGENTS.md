<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Moto navigation presentation is composed from read-only HUD components; NavigationOverlay remains mounted and owns the engine, arrival and trip teardown to preserve navigation lifecycle.
- HUD proximity presentation uses existing route milestones and a separate pure threshold helper; it must not alter POI layer visibility or the proximity-alert engine.
- Initialize locale deterministically, then restore it after hydration through the versioned language policy; this avoids browser-locale overrides and resets legacy automatic selections once.
- Share uploaded branding through ViglaLogo and CDN asset pointers; derive small app icons from the artwork without lettering for legibility, while favicons remain real public files.
