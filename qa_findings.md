# Visual QA Findings

- The teal-first landing preserves contrast and hierarchy on desktop. The global theme switcher initially overlapped the top-right workspace action, so it has been repositioned away from the primary navigation.
- Final desktop verification confirms the theme switcher now clears the primary action, while the teal canvas, aqua action color, and brass evidence accent remain visually distinct.
- Mobile verification confirms the workspace onboarding flow retains readable teal surfaces, aqua actions, and hierarchy at a 375 px viewport.
- Desktop verification confirms the public landing and calibration flow preserve the same readable hierarchy under the persisted teal theme system; the mode preference is stored client-side and toggled through the global control.
- Explicit `/ ?theme=dark` and `/ ?theme=light` previews verify distinct, legible teal modes on both the public landing and workspace-entry calibration route. Aqua remains the action color, while brass remains reserved for evidence and progress cues.
