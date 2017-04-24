#!/usr/bin/env node
'use strict';

const execSync = require('child_process').execSync;

const Version = {
    PATCH: 'patch',
    MINOR: 'minor',
    MAJOR: 'major'
};

function getParentBranch() {
    return execSync('hg log --rev "p2(.)" --template "{branch}"');
}

function bump(type) {
    return execSync(`npm version ${type}`);
}

try {
    const branch = getParentBranch();
    const breakingFeatureRegex = /^breaking-feature-/igm;
    const featureRegex = /^feature-/igm;

    if (branch && breakingFeatureRegex.test(branch)) {
        console.log('Branch name contains "breaking-feature-", bumping a MAJOR version');
        bump(Version.MAJOR);
    } else if (branch && featureRegex.test(branch)) {
        console.log('Branch name contains "feature-", bumping a MINOR version');
        bump(Version.MINOR);
    } else {
        console.log('Branch name doesn\'t contains "breaking-feature-" or "feature-", bumping a PATCH version');
        bump(Version.PATCH);
    }
} catch (err) {
    // We don't want our CI to have an error, just log it.
    console.log(err);
}