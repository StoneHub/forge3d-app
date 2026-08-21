# Issue tracker: GitHub

Forge3D issues and specs live in the GitHub repository at `StoneHub/forge3d-app`. Use the `gh` CLI for issue operations.

## Conventions

- Create an issue with `gh issue create --repo StoneHub/forge3d-app`.
- Read an issue and its discussion with `gh issue view <number> --repo StoneHub/forge3d-app --comments`.
- List issues with `gh issue list --repo StoneHub/forge3d-app` and the filters needed for the task.
- Comment with `gh issue comment <number> --repo StoneHub/forge3d-app`.
- Apply or remove labels with `gh issue edit <number> --repo StoneHub/forge3d-app`.
- Close an issue with `gh issue close <number> --repo StoneHub/forge3d-app`.

## Pull requests as a triage surface

PRs as a request surface: no.

GitHub shares one number space across issues and pull requests. Resolve an ambiguous reference with `gh pr view <number> --repo StoneHub/forge3d-app`, then fall back to `gh issue view`.

## Skill operations

When a skill says "publish to the issue tracker," create a GitHub issue in `StoneHub/forge3d-app`.

When a skill says "fetch the relevant ticket," read the issue and its comments from `StoneHub/forge3d-app`.

For work with blocking edges, use GitHub sub-issues and native issue dependencies when the repository supports them. Otherwise, put `Blocked by: #<number>` at the top of the dependent issue.
