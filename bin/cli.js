#!/usr/bin/env node
'use strict';

const execSync = require('child_process').execSync;

const Version = {
    PATCH: 'patch',
    MINOR: 'minor',
    MAJOR: 'major'
};

function getParentBranches() {
    const currentRev = execSync('hg id -i').toString().trim();
    const currentBranch = execSync('hg id --branch').toString().trim();
    const lastestTag = execSync(`hg log -r "." -b ${currentBranch} --template "{latesttag}"`).toString().trim();

    let branches = [];
    if (lastestTag) {
        branches = execSync(`hg log -r "parents(ancestor(${lastestTag}, ${currentRev})::${currentRev} - ancestor(${lastestTag}, ${currentRev}))" --template "{branch} "`).toString().trim().split(' ');
    } else {
        branches = [execSync('hg log --rev "p2(.)" --template "{branch}"').toString().trim()];
    }
    // remove empty branch and duplicates
    branches = branches.filter((branch, index, arr) => branch && arr.lastIndexOf(branch) === index);
    console.log('detected branches:', branches);
    return branches;
}

function bump(type) {
    const publishedVersions = JSON.stringify(execSync(`npm show . versions -json`, {encoding: 'utf8'}));
    let newVersion;
    do {
        newVersion = execSync(`npm version ${type}`, {encoding: 'utf8'}).trim().substr(1);
    } while(publishedVersions.indexOf(newVersion) !== -1);
    return newVersion;
}

try {
    const breakingFeatureRegex = /^breaking-feature-/igm;
    const featureRegex = /^feature-/igm;
    const branches = getParentBranches();
    let toBump = Version.PATCH;

    branches.forEach(branch => {
        if (breakingFeatureRegex.test(branch)) {
            toBump = Version.MAJOR;
        } else if (toBump === Version.PATCH && featureRegex.test(branch)) {
            toBump = Version.MINOR;
        }
    });

    if (toBump === Version.MAJOR) {
        console.log('Branch name contains "breaking-feature-", bumping a MAJOR version');
    } else if (toBump === Version.MINOR) {
        console.log('Branch name contains "feature-", bumping a MINOR version');
    } else {
        console.log('Branch name doesn\'t contains "breaking-feature-" or "feature-", bumping a PATCH version');
    }
    bump(toBump);
} catch (err) {
    // We don't want our CI to have an error, just log it.
    console.log(err);
}