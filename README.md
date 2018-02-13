# hg-auto-semver
Automatically bump versions according to parents branch name.

## How it works
hg-auto-semver checks for the merged branches between the current revision and the latest tag.
- If a branch contains `breaking-feature-` it'll bump the MAJOR version.
- Otherwise, if a branch contains `feature-`, it'll bump the MINOR version.
- Otherwise it will bump a PATCH version.

Note: If no tag exists on the current branch it will use the latest merged branch to bump the version

## Usage

```
npm install coveo-hg-auto-semver --save
```

To your package.json add
```
"scripts": {
  "hg-auto-semver": "hg-auto-semver"
}
```

In your CI, run
```
npm run hg-auto-semver
```

Enjoy auto version bumping!
