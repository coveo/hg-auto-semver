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
    const publishedVersions = JSON.stringify(execSync(`npm show . versions -json`, {encoding: 'utf8'}));
    let newVersion;
    do {
        newVersion = execSync(`npm version ${type}`, {encoding: 'utf8'}).trim().substr(1);
    } while(publishedVersions.indexOf(newVersion) !== -1)
    return newVersion;
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